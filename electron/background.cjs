// Background jobs that run in the main process, so they keep working while the
// window is closed to the tray (no renderer = very little memory):
//  - pull new recap files from the sync URL (GitHub later) every hour
//  - notify about new recaps and tracked items that hit their target price
//  - a morning summary notification
//  - quit automatically when the PC is busy (games, heavy work) and we're in the background
const { app, net, Notification, powerMonitor } = require('electron');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const HOUR = 3600e3;
const DEFAULT_SYNC_URL = 'https://raw.githubusercontent.com/TASTTYCHEESE/Hardware-Tracker/main/recaps/';

function start(ctx) {
  const { readSettings, patchSettings, recapsDir, showWindow, isWindowVisible, onRecapsChanged } = ctx;

  // ---- helpers ---------------------------------------------------------------
  const readRecaps = () => {
    const out = [];
    for (const name of fs.readdirSync(recapsDir())) {
      if (!name.endsWith('.json')) continue;
      try {
        out.push(JSON.parse(fs.readFileSync(path.join(recapsDir(), name), 'utf8')));
      } catch {
        /* skip */
      }
    }
    return out;
  };
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  function notify(title, body, target) {
    if (readSettings().notify === false || !Notification.isSupported()) return;
    const n = new Notification({ title, body });
    n.on('click', () => showWindow(target));
    n.show();
  }
  const firstSentence = (s = '') => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim().slice(0, 220);

  // ---- 1. sync recaps from a URL ----------------------------------------------
  // The URL points at a folder with an index.json listing the recap file names,
  // e.g. https://raw.githubusercontent.com/<you>/hardware-tracker/main/recaps/
  async function sync() {
    const base = (readSettings().syncUrl || DEFAULT_SYNC_URL).trim();
    if (!/^https:\/\//.test(base)) return { added: 0, error: 'No sync URL set' };
    const root = base.endsWith('/') ? base : `${base}/`;
    try {
      const res = await net.fetch(`${root}index.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const index = await res.json();
      const files = (Array.isArray(index) ? index : index.files || []).filter((f) => /^[\w.-]+\.json$/.test(f) && f !== 'index.json');
      let added = 0;
      for (const f of files) {
        const dest = path.join(recapsDir(), f);
        if (fs.existsSync(dest) && !/^(daily|weekly)-/.test(f)) continue;
        const r = await net.fetch(root + f, { cache: 'no-store' });
        if (!r.ok) continue;
        const text = await r.text();
        JSON.parse(text); // validate
        if (fs.existsSync(dest) && fs.readFileSync(dest, 'utf8') === text) continue;
        fs.writeFileSync(dest, text);
        added++;
      }
      patchSettings({ lastSync: Date.now(), lastSyncError: '' });
      return { added };
    } catch (e) {
      patchSettings({ lastSync: Date.now(), lastSyncError: String(e.message || e) });
      return { added: 0, error: String(e.message || e) };
    }
  }

  // ---- 2. notifications for new recaps and price targets -----------------------
  function checkNotifications() {
    const s = readSettings();
    const recaps = readRecaps();
    // New recaps (first run: mark all as seen silently)
    const seen = new Set(s.seenRecaps || []);
    const fresh = recaps.filter((r) => r && r.id && !seen.has(r.id));
    if (s.seenRecaps !== undefined) {
      for (const r of fresh.slice(0, 3)) {
        const drops = (r.alerts || []).filter((a) => a.to < a.from);
        notify(
          r.type === 'weekly' ? 'Weekly hardware recap' : r.type === 'daily' ? 'Daily hardware recap' : 'Hardware recap',
          drops.length ? `${r.title}. Price drops: ${drops.map((d) => `${d.item} (${d.region})`).join(', ')}` : r.title,
          'today',
        );
      }
    }
    if (fresh.length || s.seenRecaps === undefined) patchSettings({ seenRecaps: [...seen, ...fresh.map((r) => r.id)] });

    // Tracked items at or below target
    const prices = recaps.flatMap((r) => r.prices || []);
    const done = new Set(s.watchNotified || []);
    const newKeys = [];
    for (const w of s.watchlist || []) {
      const h = prices.filter((p) => p.model === w.model && p.region === w.region).sort((a, b) => a.date.localeCompare(b.date));
      const p = h[h.length - 1];
      if (!p || p.price > w.target) continue;
      const key = `${w.id}|${p.date}|${p.price}`;
      if (done.has(key)) continue;
      newKeys.push(key);
      if (s.watchNotified !== undefined) notify(`Price target hit: ${w.model}`, `${p.price} ${p.currency} in ${w.region} (your target: ${w.target} ${w.currency})`, 'tracking');
    }
    if (newKeys.length || s.watchNotified === undefined) patchSettings({ watchNotified: [...done, ...newKeys] });
  }

  // ---- 3. morning summary ------------------------------------------------------
  function morning() {
    const s = readSettings();
    if (s.morningSummary === false) return;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    // between 8:10 and 12:00, once per day, as soon as today's recap exists
    if (mins < 8 * 60 + 10 || mins > 12 * 60 || s.lastMorning === today()) return;
    const r = readRecaps().find((x) => x.date === today() && x.type !== 'catchup');
    if (!r) return;
    patchSettings({ lastMorning: today() });
    notify(`Good morning: ${r.title}`, firstSentence(r.summary), 'today');
  }

  // ---- 4. quit when the PC is busy (only while in the background) --------------
  let lastCpu = os.cpus();
  let busyStreak = 0;
  function cpuBusyPercent() {
    const cur = os.cpus();
    let idle = 0;
    let total = 0;
    cur.forEach((c, i) => {
      const p = lastCpu[i] ? lastCpu[i].times : { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
      const t = c.times;
      const dIdle = t.idle - p.idle;
      const dTotal = t.user + t.nice + t.sys + t.idle + t.irq - (p.user + p.nice + p.sys + p.idle + p.irq);
      idle += dIdle;
      total += dTotal;
    });
    lastCpu = cur;
    return total > 0 ? 100 * (1 - idle / total) : 0;
  }
  function busyCheck() {
    const cpu = cpuBusyPercent();
    const memFree = os.freemem() / os.totalmem();
    if (readSettings().autoQuitWhenBusy === false || isWindowVisible()) {
      busyStreak = 0;
      return;
    }
    const busy = cpu > 85 || memFree < 0.1;
    busyStreak = busy ? busyStreak + 1 : 0;
    if (busyStreak >= 3) {
      // 3 checks in a row (about 3 minutes) of heavy load: get out of the way.
      patchSettings({ lastAutoQuit: Date.now(), lastAutoQuitReason: memFree < 0.1 ? 'low memory' : 'high CPU load' });
      app.quit();
    }
  }

  // ---- schedule ---------------------------------------------------------------
  const tick = async () => {
    const r = await sync();
    if (r.added) onRecapsChanged();
    checkNotifications();
    morning();
  };
  setTimeout(tick, 15e3); // shortly after start, not during startup
  setInterval(tick, HOUR);
  setInterval(morning, 10 * 60e3);
  setInterval(busyCheck, 60e3);
  // Catch up after the PC wakes from sleep.
  powerMonitor.on('resume', () => setTimeout(tick, 30e3));

  let debounce;
  return {
    sync,
    // called by the folder watcher
    recapsChanged() {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        checkNotifications();
        morning();
      }, 2000);
    },
  };
}

module.exports = { start };

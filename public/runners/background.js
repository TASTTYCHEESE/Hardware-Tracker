// Hardware Tracker for Android: background checks while the app is closed.
// Runs in Capacitor Background Runner (no DOM, no localStorage). The app copies the
// settings this needs into CapacitorKV with the "syncSettings" event.
// Every ~15 minutes (when Android allows it) it sends notifications for:
//   - new daily/weekly recaps (with price drops)
//   - tracked items that hit their target price
//   - news headlines that match the user's keywords
//   - the morning summary (once a day after 8:10)

var RECAPS = 'https://raw.githubusercontent.com/TASTTYCHEESE/Hardware-Tracker/main/recaps/';
var FEEDS = ['https://www.tomshardware.com/feeds/all', 'https://www.techpowerup.com/rss/news', 'https://wccftech.com/feed/', 'https://www.kitguru.net/feed/'];

function kvGet(k, fallback) {
  try {
    var v = CapacitorKV.get(k);
    var s = v && typeof v === 'object' ? v.value : v;
    return s ? JSON.parse(s) : fallback;
  } catch (e) {
    return fallback;
  }
}
function kvSet(k, v) {
  CapacitorKV.set(k, JSON.stringify(v));
}
var nextId = Date.now() % 100000;
function notify(title, body) {
  // No scheduleAt: it means "now" (the plugin reads a given time as local time, which can delay it by hours).
  CapacitorNotifications.schedule([{ id: nextId++, title: title, body: body, smallIcon: 'ic_stat_notify', autoCancel: true }]);
}
function today() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .trim();
}
function hash(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

async function getJson(url) {
  var r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return JSON.parse(await r.text());
}

async function checkRecaps(s) {
  var root = (s.syncUrl || RECAPS).replace(/\/?$/, '/');
  var idx = await getJson(root + 'index.json?t=' + Math.floor(Date.now() / 600000));
  var files = (Array.isArray(idx) ? idx : idx.files || []).filter(function (f) { return /^[\w.-]+\.json$/.test(f) && f !== 'index.json'; });
  files.sort();
  var recent = files.slice(-14); // newest two weeks is plenty for new recaps and current prices
  var recaps = [];
  for (var i = 0; i < recent.length; i++) {
    try { recaps.push(await getJson(root + recent[i])); } catch (e) { /* skip */ }
  }
  // 1. new recaps
  var seen = kvGet('seenRecaps', null);
  var first = seen === null;
  seen = seen || [];
  var fresh = recaps.filter(function (r) { return r && r.id && seen.indexOf(r.id) < 0; });
  if (!first && s.notify !== false) {
    fresh.slice(-3).forEach(function (r) {
      var drops = (r.alerts || []).filter(function (a) { return a.to < a.from; });
      notify(
        r.type === 'weekly' ? 'Weekly hardware recap' : r.type === 'daily' ? 'Daily hardware recap' : 'Hardware recap',
        drops.length ? r.title + '. Price drops: ' + drops.map(function (d) { return d.item + ' (' + d.region + ')'; }).join(', ') : r.title,
      );
    });
  }
  if (fresh.length || first) kvSet('seenRecaps', seen.concat(fresh.map(function (r) { return r.id; })).slice(-200));

  // 2. tracked items at or below their target
  var prices = [];
  recaps.forEach(function (r) { (r.prices || []).forEach(function (p) { prices.push(p); }); });
  var done = kvGet('watchNotified', null);
  var firstW = done === null;
  done = done || [];
  var added = [];
  (s.watchlist || []).forEach(function (w) {
    var h = prices.filter(function (p) { return p.model === w.model && p.region === w.region; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var p = h[h.length - 1];
    if (!p || p.price > w.target) return;
    var key = w.id + '|' + p.date + '|' + p.price;
    if (done.indexOf(key) >= 0) return;
    added.push(key);
    if (!firstW && s.notify !== false) notify('Price target hit: ' + w.model, p.price + ' ' + p.currency + ' in ' + w.region + ' (your target: ' + w.target + ' ' + w.currency + ')');
  });
  if (added.length || firstW) kvSet('watchNotified', done.concat(added).slice(-300));

  // 3. morning summary
  var d = new Date();
  var mins = d.getHours() * 60 + d.getMinutes();
  if (s.morningSummary !== false && mins >= 490 && mins <= 720 && kvGet('lastMorning', '') !== today()) {
    var r = recaps.filter(function (x) { return x.date === today() && x.type !== 'catchup'; })[0];
    if (r) {
      kvSet('lastMorning', today());
      var sum = String(r.summary || '');
      var m = sum.match(/^.*?[.!?](\s|$)/);
      notify('Good morning: ' + r.title, (m ? m[0] : sum).trim().slice(0, 200));
    }
  }
}

async function checkKeywords(s) {
  var kws = (s.newsKeywords || []).filter(Boolean);
  if (!kws.length || s.notify === false) return;
  var res = kws.map(function (k) { return { k: k, re: new RegExp('(^|[^\\w])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\w])', 'i') }; });
  var seen = kvGet('newsSeen', null);
  var first = seen === null;
  seen = seen || [];
  var hits = [];
  for (var i = 0; i < FEEDS.length; i++) {
    var xml;
    try {
      var r = await fetch(FEEDS[i]);
      if (!r.ok) continue;
      xml = await r.text();
    } catch (e) {
      continue;
    }
    var items = xml.split(/<item[\s>]/i).slice(1, 40);
    items.forEach(function (it) {
      var t = it.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (!t) return;
      var title = decode(t[1]);
      var id = hash(title);
      if (seen.indexOf(id) >= 0) return;
      for (var j = 0; j < res.length; j++) {
        if (res[j].re.test(title)) {
          seen.push(id);
          hits.push({ title: title, kw: res[j].k });
          break;
        }
      }
    });
  }
  if (!first) {
    if (hits.length === 1) notify('News about "' + hits[0].kw + '"', hits[0].title);
    else if (hits.length > 1) notify(hits.length + ' new articles match your keywords', hits.slice(0, 3).map(function (h) { return h.title; }).join(' · '));
  }
  kvSet('newsSeen', seen.slice(-400));
}

addEventListener('syncSettings', function (resolve, reject, args) {
  try {
    kvSet('settings', args || {});
    resolve();
  } catch (e) {
    reject(e);
  }
});

addEventListener('checkForUpdates', async function (resolve, reject) {
  var s = kvGet('settings', {});
  try {
    try { await checkRecaps(s); } catch (e) { console.error('recaps: ' + e); }
    try { await checkKeywords(s); } catch (e) { console.error('keywords: ' + e); }
    kvSet('lastRun', Date.now());
    resolve();
  } catch (e) {
    reject(e);
  }
});

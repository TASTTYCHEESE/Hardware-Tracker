// Collects the app's interface texts for the translation dictionaries (src/i18n/*.json).
// Usage: node tools/i18n/collect.cjs <url of a built app, e.g. http://localhost:5181/> <catalog folder> <out.json>
// Walks through every section, tab and a few product pages at desktop and phone width, with news
// sites blocked, so only the app's own texts (not live news) are collected.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const [URL_, CAT, OUT] = process.argv.slice(2);

function grab() {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT']);
  const ok = (s) => {
    const t = s.trim();
    if (t.length < 2 || t.length > 200 || !/\p{L}{2}/u.test(t) || /^https?:\/\//.test(t)) return false;
    if (/\d/.test(t) && t.split(/\s+/).every((w) => /^[^\p{Ll}]/u.test(w) || /\d/.test(w))) return false;
    return true;
  };
  const skipped = (el) => {
    for (let e = el; e; e = e.parentElement) {
      if (SKIP.has(e.tagName) || e.getAttribute('translate') === 'no' || e.classList.contains('notranslate')) return true;
      // live content: news, articles, product lists
      if (e.matches('.news-item, .reader, .hw-list, .hw-grid, .bell-list, .cal-body')) return true;
    }
    return false;
  };
  const out = new Set();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === 3) {
      if (!skipped(n.parentElement) && ok(n.nodeValue)) out.add(n.nodeValue.trim());
    } else if (!skipped(n)) {
      for (const a of ['placeholder', 'title', 'aria-label']) {
        const v = n.getAttribute(a);
        if (v && ok(v)) out.add(v.trim());
      }
    }
  }
  return [...out];
}

(async () => {
  const all = new Set();
  const b = await chromium.launch();
  for (const phone of [false, true]) {
    const p = await b.newPage(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1400, height: 900 } });
    await p.route('**/*', (r) => {
      const u = r.request().url();
      if (u.startsWith('http://localhost')) return r.fallback();
      if (u.includes('/catalog/')) {
        const f = path.join(CAT, path.basename(new URL(u).pathname));
        return fs.existsSync(f) ? r.fulfill({ path: f, contentType: 'application/json' }) : r.fulfill({ status: 404 });
      }
      return r.abort();
    });
    const take = async () => (await p.evaluate(grab)).forEach((s) => all.add(s));
    const click = async (sel) => {
      const el = await p.$(sel);
      if (!el) return false;
      await el.click().catch(() => {});
      await p.waitForTimeout(500);
      return true;
    };
    await p.goto(URL_);
    await p.waitForTimeout(1500);
    // turn on optional sections so their texts are collected too
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('hwt-settings') || '{}');
      localStorage.setItem('hwt-settings', JSON.stringify({ ...s, dropWatchOn: true }));
    });
    await p.reload();
    await p.waitForTimeout(1500);
    const navs = await p.$$eval('.nav', (a) => a.length);
    for (let i = 0; i < navs; i++) {
      const nb = (await p.$$('.nav'))[i];
      if (!nb) break;
      await nb.click().catch(() => {});
      await p.waitForTimeout(600);
      await take();
      const tabs = await p.$$eval('.topbar .seg-btn', (a) => a.length);
      for (let t = 0; t < tabs; t++) {
        const tb = (await p.$$('.topbar .seg-btn'))[t];
        if (!tb) break;
        await tb.click().catch(() => {});
        await p.waitForTimeout(700);
        await take();
        // inner tabs (Buy or wait?, Benchmarks, Prices)
        const inner = await p.$$eval('.content .seg-btn', (a) => a.length);
        for (let k = 0; k < Math.min(inner, 8); k++) {
          const btns = await p.$$('.content .seg-btn');
          if (!btns[k]) break;
          await btns[k].click().catch(() => {});
          await p.waitForTimeout(300);
          await take();
        }
        // a few product pages
        if (await p.$('.hw-tile')) {
          for (const name of ['Graphics cards', 'Processors', 'GPU chips', 'Memory']) {
            if (await click(`.hw-tile:has-text("${name}")`)) {
              await take();
              if (await click('.hw-row')) await take();
              await p.goBack().catch(() => {});
              await p.waitForTimeout(400);
            }
          }
        }
      }
    }
    await p.close();
  }
  await b.close();
  const list = [...all].sort();
  fs.writeFileSync(OUT, JSON.stringify(list, null, 1));
  console.log(`${list.length} texts`);
})();

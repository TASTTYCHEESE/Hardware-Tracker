// Builds the interface dictionaries src/i18n/<lang>.json from the texts collected by collect.cjs,
// using Google Translate's public endpoint. Existing entries are kept, so hand fixes survive.
// Usage: node tools/i18n/translate.cjs <texts.json> [lang ...]
const fs = require('fs');
const path = require('path');
const [TEXTS, ...only] = process.argv.slice(2);
const LANGS = ['zh-CN', 'hi', 'es', 'fr', 'pt', 'ru', 'id', 'de', 'ja', 'tr', 'vi', 'ko', 'it', 'pl', 'uk', 'nl', 'bg'];
const DIR = path.join(__dirname, '..', '..', 'src', 'i18n');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gt(text, to) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      return j[0].map((p) => p[0]).join('');
    } catch (e) {
      if (i >= 7) throw e;
      await sleep(Math.min(60000, 3000 * 2 ** i)); // Google rate-limits busy clients (HTTP 429)
    }
  }
}

(async () => {
  const texts = JSON.parse(fs.readFileSync(TEXTS, 'utf8'));
  fs.mkdirSync(DIR, { recursive: true });
  for (const lang of only.length ? only : LANGS) {
    const file = path.join(DIR, `${lang}.json`);
    const dict = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    const todo = texts.filter((t) => !(t in dict) && !t.includes('\n'));
    const batches = [];
    let cur = [];
    let len = 0;
    for (const t of todo) {
      if (cur.length && (len + t.length > 1500 || cur.length >= 50)) {
        batches.push(cur);
        cur = [];
        len = 0;
      }
      cur.push(t);
      len += t.length + 1;
    }
    if (cur.length) batches.push(cur);
    for (const b of batches) {
      let lines = (await gt(b.join('\n'), lang)).split('\n');
      if (lines.length !== b.length) {
        lines = [];
        for (const t of b) lines.push(await gt(t, lang));
      }
      // batch translation sometimes drops the capital letter at the start of a line
      const cap = (src, out) => (/^\p{Lu}/u.test(src) && /^\p{Ll}/u.test(out) ? out[0].toUpperCase() + out.slice(1) : out);
      b.forEach((t, i) => (dict[t] = cap(t, lines[i].trim())));
      await sleep(300);
    }
    const sorted = Object.fromEntries(Object.keys(dict).sort().map((k) => [k, dict[k]]));
    fs.writeFileSync(file, JSON.stringify(sorted, null, 1) + '\n');
    console.log(lang, Object.keys(sorted).length, `(+${todo.length})`);
  }
})();

// Saves the news feeds and exchange rates the app reads into <out>/snapshot/, for the web version.
// Browsers can't read most news sites directly (CORS), so the web app falls back to these copies.
// Usage: node tools/web/snapshot.mjs dist-web
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.argv[2] || 'dist', 'snapshot');
mkdirSync(out, { recursive: true });
const urls = new Set();
for (const f of ['src/lib/feeds.ts', 'src/lib/fx.ts']) {
  for (const m of readFileSync(f, 'utf8').matchAll(/url:\s*'(https:\/\/[^']+)'/g)) urls.add(m[1]);
}
const files = {};
let n = 0;
await Promise.all(
  [...urls].map(async (url) => {
    const name = `${++n}.txt`;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HardwareTracker-web/1.0)' }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      writeFileSync(join(out, name), await r.text());
      files[url] = name;
      console.log('ok  ', url);
    } catch (e) {
      console.log('fail', url, e.message);
    }
  }),
);
writeFileSync(join(out, 'index.json'), JSON.stringify({ updated: new Date().toISOString(), files }, null, 1));

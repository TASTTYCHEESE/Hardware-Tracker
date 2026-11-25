import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Electron (and later Capacitor) load the built files from file://, where
// `crossorigin` on module scripts makes the browser refuse them.
const stripCrossorigin = (): Plugin => ({
  name: 'strip-crossorigin',
  transformIndexHtml: (html) => html.replace(/\s+crossorigin(="[^"]*")?/g, ''),
});

// Offline use: ship a copy of the hardware catalog (catalog/*.json, rebuilt twice a week) inside
// the app, so PC Hardware, Compare and the rest work without internet from the first start.
const bundleCatalog = (): Plugin => ({
  name: 'bundle-catalog',
  apply: 'build',
  closeBundle() {
    const src = new URL('./catalog/', import.meta.url);
    if (!existsSync(src)) return;
    const out = new URL('./dist/offline-catalog/', import.meta.url);
    mkdirSync(out, { recursive: true });
    for (const f of readdirSync(src)) if (/^[a-z0-9-]+\.json$/.test(f)) copyFileSync(new URL(f, src), new URL(f, out));
  },
});

export default defineConfig({ plugins: [react(), stripCrossorigin(), bundleCatalog()], base: './', define: { __APP_VERSION__: JSON.stringify(version) } });

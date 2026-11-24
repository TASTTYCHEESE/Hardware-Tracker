import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Electron (and later Capacitor) load the built files from file://, where
// `crossorigin` on module scripts makes the browser refuse them.
const stripCrossorigin = (): Plugin => ({
  name: 'strip-crossorigin',
  transformIndexHtml: (html) => html.replace(/\s+crossorigin(="[^"]*")?/g, ''),
});

export default defineConfig({ plugins: [react(), stripCrossorigin()], base: './', define: { __APP_VERSION__: JSON.stringify(version) } });

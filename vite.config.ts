import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Electron (and later Capacitor) load the built files from file://, where
// `crossorigin` on module scripts makes the browser refuse them.
const stripCrossorigin = (): Plugin => ({
  name: 'strip-crossorigin',
  transformIndexHtml: (html) => html.replace(/\s+crossorigin(="[^"]*")?/g, ''),
});

export default defineConfig({ plugins: [react(), stripCrossorigin()], base: './' });

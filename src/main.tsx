import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Web version: a small service worker so it installs to the home screen and opens offline.
if (!window.hwt && location.protocol === 'https:' && 'serviceWorker' in navigator && !(window as { Capacitor?: unknown }).Capacitor) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

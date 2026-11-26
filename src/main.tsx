import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// If anything in the app crashes while drawing, React would otherwise remove everything and leave
// an empty screen: show the error with a Reload button instead (public/startup-guard.js).
class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error, info: { componentStack?: string | null }) {
    const where = (info.componentStack || '').trim().split('\n')[0]?.trim() || '';
    (window as { __hwtBootFail?: (m: string) => void }).__hwtBootFail?.(`${e?.message || e}${where ? ` ${where}` : ''}`);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Guard>
      <App />
    </Guard>
  </StrictMode>,
);

// Web version: a small service worker so it installs to the home screen and opens offline.
if (!window.hwt && location.protocol === 'https:' && 'serviceWorker' in navigator && !(window as { Capacitor?: unknown }).Capacitor) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

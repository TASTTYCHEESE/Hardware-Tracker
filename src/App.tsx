import { useEffect, useState } from 'react';
import { Reader } from './components/Reader';
import { api } from './lib/platform';
import { useData } from './lib/useData';
import { Overview } from './components/Overview';
import { News } from './components/News';
import { Prices } from './components/Prices';
import { Today } from './components/Today';
import { Archive } from './components/Archive';
import { Alerts } from './components/Alerts';
import { Tracking } from './components/Tracking';
import { SettingsPage } from './components/Settings';

type Section = 'today' | 'overview' | 'prices' | 'settings';

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '★' },
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'prices', label: 'Prices', icon: '↗' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

/** Sub-tabs shown along the top of each section. */
const SUBTABS: Record<Section, { id: string; label: string }[]> = {
  today: [
    { id: '0', label: 'Today' },
    { id: '1', label: 'Yesterday' },
    { id: '2', label: 'Day before' },
  ],
  overview: [
    { id: 'overview', label: 'Overview' },
    { id: 'news', label: 'Live news' },
    { id: 'archive', label: 'Archive' },
  ],
  prices: [
    { id: 'prices', label: 'Prices' },
    { id: 'alerts', label: 'Price alerts' },
    { id: 'tracking', label: 'Tracking' },
  ],
  settings: [],
};

export default function App() {
  const data = useData();
  const [section, setSection] = useState<Section>('today');
  const [sub, setSub] = useState<Record<Section, string>>({ today: '0', overview: 'overview', prices: 'prices', settings: '' });
  const [recapId, setRecapId] = useState<string>();
  const [reading, setReading] = useState<string | null>(null);

  // Open every external link (news, sources, alerts) in the in-app reader.
  // Ctrl/Shift/middle-click still goes to the normal browser.
  useEffect(() => {
    if (api.platform !== 'desktop') return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest('a');
      if (!a || !/^https?:\/\//.test(a.href) || a.closest('.reader')) return;
      e.preventDefault();
      setReading(a.href);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // The tray menu / morning notification can ask for a specific page.
  useEffect(() => window.hwt?.onNavigate?.((target: string) => go(target)), []);

  const dropCount = data.alerts.filter((a) => a.to < a.from).length;
  const hitCount = data.watchHits.length;

  /** Navigate by old-style page id ("news", "alerts", "recap:<id>", ...). */
  function go(v: string) {
    setReading(null);
    if (v.startsWith('recap:')) {
      setRecapId(v.slice(6));
      return open('overview', 'archive');
    }
    const map: Record<string, [Section, string]> = {
      today: ['today', '0'],
      overview: ['overview', 'overview'],
      news: ['overview', 'news'],
      archive: ['overview', 'archive'],
      prices: ['prices', 'prices'],
      alerts: ['prices', 'alerts'],
      tracking: ['prices', 'tracking'],
      settings: ['settings', ''],
    };
    const [s, t] = map[v] ?? ['today', '0'];
    open(s, t);
  }
  function open(s: Section, t: string) {
    setSection(s);
    setSub((cur) => ({ ...cur, [s]: t }));
  }

  const current = sub[section];
  const tabs = SUBTABS[section];

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          <span className="logo">HT</span>
          <div>
            <strong>Hardware Tracker</strong>
            <div className="muted small">GPU · CPU · RAM</div>
          </div>
        </div>
        {NAV.map((n) => (
          <button key={n.id} className={section === n.id ? 'nav active' : 'nav'} onClick={() => { setReading(null); setSection(n.id); }}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            {n.id === 'prices' && hitCount + dropCount > 0 && <span className="pill">{hitCount + dropCount}</span>}
          </button>
        ))}
        <div className="sidebar-foot muted small">
          Daily recap 8:00 · Weekly recap Mon 8:00
          <br />
          (Sofia time)
        </div>
      </nav>
      <main className="main">
        {reading && <Reader url={reading} onClose={() => setReading(null)} onNavigate={setReading} />}
        {tabs.length > 0 && (
          <div className="topbar">
            <div className="seg">
              {tabs.map((t) => (
                <button key={t.id} className={current === t.id ? 'seg-btn on' : 'seg-btn'} onClick={() => open(section, t.id)}>
                  {t.label}
                  {t.id === 'alerts' && dropCount > 0 && <span className="seg-count good">{dropCount}</span>}
                  {t.id === 'tracking' && hitCount > 0 && <span className="seg-count good">{hitCount}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="content">
          {section === 'today' && <Today data={data} go={go} offset={Number(current) || 0} />}
          {section === 'overview' && current === 'overview' && <Overview data={data} go={go} />}
          {section === 'overview' && current === 'news' && <News data={data} />}
          {section === 'overview' && current === 'archive' && <Archive data={data} selected={recapId} select={setRecapId} />}
          {section === 'prices' && current === 'prices' && <Prices data={data} />}
          {section === 'prices' && current === 'alerts' && <Alerts data={data} />}
          {section === 'prices' && current === 'tracking' && <Tracking data={data} />}
          {section === 'settings' && <SettingsPage data={data} />}
        </div>
      </main>
    </div>
  );
}

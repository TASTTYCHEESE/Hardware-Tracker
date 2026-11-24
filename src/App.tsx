import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Hardware, resetHardwareViews } from './components/Hardware';
import { Updates } from './components/Updates';
import { Compare } from './components/Compare';
import { BuyAdvisor } from './components/BuyAdvisor';
import { Launches } from './components/Launches';
import { keywordHits } from './lib/newsAlerts';
import type { UpdateInfo } from './lib/platform';

type Section = 'today' | 'overview' | 'prices' | 'hardware' | 'settings' | 'updates';

const NAV: { id: Section; label: string; icon: string; short?: string }[] = [
  { id: 'today', label: 'Today', icon: '★' },
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'prices', label: 'Prices', icon: '↗' },
  { id: 'hardware', label: 'PC Hardware', icon: '▦', short: 'Hardware' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'updates', label: 'Updates', icon: '⟳' },
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
    { id: 'launches', label: 'Launch calendar' },
    { id: 'archive', label: 'Archive' },
  ],
  prices: [
    { id: 'prices', label: 'Prices' },
    { id: 'alerts', label: 'Price alerts' },
    { id: 'tracking', label: 'Tracking' },
  ],
  hardware: [
    { id: 'hardware', label: 'Hardware' },
    { id: 'peripherals', label: 'Peripherals' },
    { id: 'compare', label: 'Compare' },
    { id: 'buy', label: 'Buy or wait?' },
  ],
  settings: [],
  updates: [],
};

const HOME_SUB: Record<Section, string> = { today: '0', overview: 'overview', prices: 'prices', hardware: 'hardware', settings: '', updates: '' };

/** One place in the app. Back / forward (mouse buttons 4 and 5, Alt+←/→) move through these. */
interface Loc {
  section: Section;
  sub: string;
  /** PC Hardware: open category and product */
  cat: string | null;
  item: string | null;
}
const same = (a: Loc, b: Loc) => a.section === b.section && a.sub === b.sub && a.cat === b.cat && a.item === b.item;

export default function App() {
  const data = useData();
  const [hist, setHist] = useState<{ list: Loc[]; i: number }>({ list: [{ section: 'today', sub: '0', cat: null, item: null }], i: 0 });
  const loc = hist.list[hist.i];
  const section = loc.section;
  // Last tab used in each section, so switching sections comes back to it.
  const [sub, setSub] = useState<Record<Section, string>>(HOME_SUB);
  // Bumped to reset a page to its starting state (clicking the menu you're already on).
  const [nonce, setNonce] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const nav = (next: Partial<Loc>) => {
    const h = histRef.current;
    const cur = h.list[h.i];
    const n = { ...cur, ...next };
    if (same(n, cur)) return;
    setSub((x) => ({ ...x, [n.section]: n.sub }));
    const list = [...h.list.slice(0, h.i + 1), n].slice(-200);
    histRef.current = { list, i: list.length - 1 };
    setHist(histRef.current);
  };
  const readingRef = useRef<string | null>(null);
  const histRef = useRef(hist);
  histRef.current = hist;
  const step = (d: -1 | 1) => {
    // Back first closes the article reader if it's open.
    if (readingRef.current) {
      if (d === -1) setReading(null);
      return;
    }
    const h = histRef.current;
    const i = Math.min(h.list.length - 1, Math.max(0, h.i + d));
    if (i === h.i) return;
    setSub((x) => ({ ...x, [h.list[i].section]: h.list[i].sub }));
    histRef.current = { ...h, i };
    setHist(histRef.current);
  };
  const goHome = (s: Section, t: string) => {
    setReading(null);
    resetHardwareViews();
    nav({ section: s, sub: t, cat: null, item: null });
    setNonce((n) => n + 1);
    contentRef.current?.scrollTo(0, 0);
  };

  // Mouse back / forward buttons (4 and 5), Alt+Left / Alt+Right, and the Windows app commands.
  useEffect(() => {
    let last = 0;
    const fire = (d: -1 | 1) => {
      if (Date.now() - last < 250) return;
      last = Date.now();
      step(d);
    };
    const onMouse = (e: MouseEvent) => {
      if (e.button !== 3 && e.button !== 4) return;
      e.preventDefault();
      if (e.type === 'mouseup') fire(e.button === 3 ? -1 : 1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      fire(e.key === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('mousedown', onMouse);
    window.addEventListener('mouseup', onMouse);
    window.addEventListener('keydown', onKey);
    const off = window.hwt?.onHistory?.((d: number) => fire(d < 0 ? -1 : 1));
    return () => {
      window.removeEventListener('mousedown', onMouse);
      window.removeEventListener('mouseup', onMouse);
      window.removeEventListener('keydown', onKey);
      off?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    api.updateInfo?.().then((i) => i && setUpdate(i)).catch(() => {});
    return api.onUpdateStatus?.(setUpdate);
  }, []);
  const [recapId, setRecapId] = useState<string>();
  const [reading, setReading] = useState<string | null>(null);
  readingRef.current = reading;

  // Open every external link (news, sources, alerts) in the in-app reader.
  // Ctrl/Shift/middle-click still goes to the normal browser.
  useEffect(() => {
    if (api.platform === 'web') return; // a browser can't load other sites' pages for the reader
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
  // Unread keyword alerts in Live news (shown like notifications on the menu and tab).
  const newsUnread = useMemo(() => {
    const seen = new Set(data.settings.newsSeen ?? []);
    return keywordHits(data.feed.articles, data.settings.newsKeywords ?? []).filter((h) => !seen.has(h.a.id)).length;
  }, [data.feed.articles, data.settings.newsKeywords, data.settings.newsSeen]);
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
      hardware: ['hardware', 'hardware'],
      compare: ['hardware', 'compare'],
      buy: ['hardware', 'buy'],
      launches: ['overview', 'launches'],
      peripherals: ['hardware', 'peripherals'],
      settings: ['settings', ''],
      updates: ['updates', ''],
    };
    const [s, t] = map[v] ?? ['today', '0'];
    open(s, t);
  }
  function open(s: Section, t: string) {
    nav({ section: s, sub: t, cat: null, item: null });
  }

  const current = loc.sub;
  const tabs = SUBTABS[section];

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          <span className="logo">HT</span>
          <div>
            <strong>Hardware Tracker</strong>
            <div className="muted small">News · Prices · Specs</div>
          </div>
        </div>
        {NAV.map((n) => (
          <button key={n.id} className={section === n.id ? 'nav active' : 'nav'} onClick={() => {
              if (section === n.id) return goHome(n.id, HOME_SUB[n.id]);
              setReading(null);
              nav({ section: n.id, sub: sub[n.id], cat: null, item: null });
            }}>
            <span className="nav-icon">{n.icon}</span>
            <span className="nav-label">{n.label}</span>
            <span className="nav-short">{n.short ?? n.label}</span>
            {n.id === 'prices' && hitCount + dropCount > 0 && <span className="pill">{hitCount + dropCount}</span>}
            {n.id === 'overview' && newsUnread > 0 && <span className="pill alert" title="New keyword alerts in Live news">{newsUnread}</span>}
            {n.id === 'updates' && update?.state === 'ready' && <span className="pill" title="Update ready">New</span>}
          </button>
        ))}
        <div className="sidebar-foot muted small">
          Daily recap 8:00 · Weekly recap Mon 8:00
          <br />
          (Sofia time)
        </div>
      </nav>
      <main className="main">
        {reading && <Reader url={reading} onClose={() => setReading(null)} onNavigate={setReading} translate={data.settings.translateNews !== false} />}
        {tabs.length > 0 && (
          <div className="topbar">
            <div className="seg">
              {tabs.map((t) => (
                <button key={t.id} className={current === t.id ? 'seg-btn on' : 'seg-btn'} onClick={() => (current === t.id ? goHome(section, t.id) : (setReading(null), open(section, t.id)))}>
                  {t.label}
                  {t.id === 'alerts' && dropCount > 0 && <span className="seg-count good">{dropCount}</span>}
                  {t.id === 'tracking' && hitCount > 0 && <span className="seg-count good">{hitCount}</span>}
                  {t.id === 'news' && newsUnread > 0 && <span className="seg-count alert">{newsUnread}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="content" ref={contentRef} key={nonce}>
          {section === 'today' && <Today data={data} go={go} offset={Number(current) || 0} />}
          {section === 'overview' && current === 'overview' && <Overview data={data} go={go} />}
          {section === 'overview' && current === 'news' && <News data={data} openReader={api.platform !== 'web' ? setReading : undefined} />}
          {section === 'overview' && current === 'launches' && <Launches />}
          {section === 'overview' && current === 'archive' && <Archive data={data} selected={recapId} select={setRecapId} />}
          {section === 'prices' && current === 'prices' && <Prices data={data} />}
          {section === 'prices' && current === 'alerts' && <Alerts data={data} />}
          {section === 'prices' && current === 'tracking' && <Tracking data={data} />}
          {section === 'hardware' && current === 'compare' && <Compare data={data} />}
          {section === 'hardware' && current === 'buy' && <BuyAdvisor data={data} />}
          {section === 'hardware' && (current === 'hardware' || current === 'peripherals') && <Hardware
              key={current}
              group={current === 'peripherals' ? 'peripherals' : 'hardware'}
              cat={loc.cat}
              item={loc.item}
              navigate={(cat, item, group) => nav({ cat, item, ...(group ? { sub: group } : {}) })}
              data={data}
              onCompare={(cat, id) => {
                const cur = data.settings.compare;
                const ids = cur && cur.cat === cat ? cur.ids.filter((x) => x !== id) : [];
                data.setSettings({ compare: { cat, ids: [...ids, id].slice(-4) } });
                nav({ sub: 'compare', cat: null, item: null });
              }}
            />}
          {section === 'settings' && <SettingsPage data={data} />}
          {section === 'updates' && <Updates data={data} info={update} setInfo={setUpdate} />}
        </div>
      </main>
    </div>
  );
}

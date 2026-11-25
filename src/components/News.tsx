import { useMemo, useState } from 'react';
import { keywordHits } from '../lib/newsAlerts';
import { isNvidiaDriver } from '../lib/feeds';
import { langName } from '../lib/translate';
import type { AppData } from '../lib/useData';
import type { Category } from '../lib/types';
import { CatBadge, catLabel } from './Common';
import { ago } from '../lib/format';
import { OfflineNote } from './OfflineBadge';

const FILTERS: (Category | 'All' | 'Drivers')[] = ['All', 'GPU', 'CPU', 'RAM', 'Industry', 'Other', 'Drivers'];


export function News({ data, openReader }: { data: AppData; openReader?: (url: string) => void }) {
  const [cat, setCat] = useState<Category | 'All' | 'Drivers'>('All');
  const [q, setQ] = useState('');
  const [bell, setBell] = useState(false);
  const [kw, setKw] = useState('');
  const keywords = data.settings.newsKeywords ?? [];
  const seen = useMemo(() => new Set(data.settings.newsSeen ?? []), [data.settings.newsSeen]);
  const hits = useMemo(() => keywordHits(data.feed.articles, keywords), [data.feed.articles, keywords.join('|')]);
  const unread = hits.filter((h) => !seen.has(h.a.id));
  const markSeen = (ids: string[]) =>
    data.setSettings({ newsSeen: [...new Set([...(data.settings.newsSeen ?? []), ...ids])].slice(-2000) });
  const addKw = () => {
    const k = kw.trim();
    if (!k || keywords.some((x) => x.toLowerCase() === k.toLowerCase())) return setKw('');
    // Articles already in the feed when you add a keyword don't count as new.
    const old = keywordHits(data.feed.articles, [k]).map((h) => h.a.id);
    data.setSettings({ newsKeywords: [...keywords, k], newsSeen: [...new Set([...(data.settings.newsSeen ?? []), ...old])].slice(-2000) });
    setKw('');
  };
  const list = data.feed.articles.filter(
    (a) => (cat === 'All' || (cat === 'Drivers' ? isNvidiaDriver(a) : a.category === cat)) && (!q || `${a.title} ${a.summary}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div className="page">
      <OfflineNote what="Live news" />
      <div className="section-head">
        <h1>Live news</h1>
        <div className="row">
          <div className="bell-wrap">
            <button className={bell ? 'bell on' : 'bell'} onClick={() => setBell((b) => !b)} title="Keyword alerts">
              🔔{unread.length > 0 && <span className="bell-count">{unread.length > 99 ? '99+' : unread.length}</span>}
            </button>
            {bell && (
              <div className="bell-panel card">
                <div className="bell-head">
                  <strong>Keyword alerts</strong>
                  {unread.length > 0 && (
                    <button className="link small" onClick={() => markSeen(unread.map((h) => h.a.id))}>
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="bell-kws">
                  {keywords.map((k) => (
                    <span key={k} className="chip on">
                      {k}
                      <button className="chip-x" title={`Stop alerts for "${k}"`} onClick={() => data.setSettings({ newsKeywords: keywords.filter((x) => x !== k) })}>
                        ×
                      </button>
                    </span>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addKw();
                    }}
                  >
                    <input className="search small-input" placeholder={keywords.length ? 'Add a keyword…' : 'Add a keyword, e.g. RTX 5070 Super'} value={kw} onChange={(e) => setKw(e.target.value)} />
                  </form>
                </div>
                <div className="bell-list">
                  {!keywords.length && <p className="muted small">Add words you care about. When a new headline mentions one, it shows up here and the bell lights up.</p>}
                  {keywords.length > 0 && !hits.length && <p className="muted small">No headlines mention your keywords right now. New ones will show up here.</p>}
                  {hits.slice(0, 40).map((h) => (
                    <button
                      key={h.a.id}
                      className={seen.has(h.a.id) ? 'bell-item' : 'bell-item unread'}
                      onClick={() => {
                        markSeen([h.a.id]);
                        if (openReader) openReader(h.a.link);
                        else window.open(h.a.link, '_blank');
                      }}
                    >
                      {!seen.has(h.a.id) && <span className="dot" />}
                      <span>
                        <span className="bell-title">{h.a.title}</span>
                        <span className="muted small">
                          "{h.kw}" · {h.a.source} · {ago(h.a.date)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <span className="muted small">{data.feedUpdated ? `Updated ${ago(data.feedUpdated)}` : ''}</span>
          <button className="btn small" onClick={data.refreshFeeds} disabled={data.feedLoading}>
            {data.feedLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      <div className="toolbar">
        <div className="tabs">
          {FILTERS.map((f) => (
            <button key={f} className={f === cat ? 'tab active' : 'tab'} onClick={() => setCat(f)}>
              {f === 'Drivers' ? 'Nvidia drivers' : catLabel(f)}
              <span className="count">
                {f === 'All' ? data.feed.articles.length : f === 'Drivers' ? data.feed.articles.filter(isNvidiaDriver).length : data.feed.articles.filter((a) => a.category === f).length}
              </span>
            </button>
          ))}
        </div>
        <input className="search" placeholder="Search headlines (e.g. 5090, X3D, DDR5)…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {data.feed.errors.length > 0 && (
        <p className="muted small">Couldn't reach: {data.feed.errors.map((e) => e.name).join(', ')}. You can change feeds in Settings.</p>
      )}
      <div className="feed">
        {list.map((a) => (
          <a key={a.id} className="feed-item" href={a.link} target="_blank" rel="noreferrer">
            <div className="feed-meta">
              <CatBadge c={a.category} />
              <span className="muted small">
                {a.source} · {ago(a.date)}
              </span>
            </div>
            <h4 title={a.origTitle ? `Original: ${a.origTitle}` : undefined}>{a.title}</h4>
            {a.lang && <div className="muted small translated">Translated from {langName(a.lang)} · opens the translated page</div>}
            {a.summary && <p className="muted">{a.summary}</p>}
          </a>
        ))}
        {!list.length && !data.feedLoading && <p className="muted">Nothing matches.</p>}
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { AppData } from '../lib/useData';
import type { Category } from '../lib/types';
import { CatBadge } from './Common';
import { ago } from '../lib/format';

const FILTERS: (Category | 'All')[] = ['All', 'GPU', 'CPU', 'RAM', 'Industry', 'Other'];

export function News({ data }: { data: AppData }) {
  const [cat, setCat] = useState<Category | 'All'>('All');
  const [q, setQ] = useState('');
  const list = data.feed.articles.filter(
    (a) => (cat === 'All' || a.category === cat) && (!q || `${a.title} ${a.summary}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div className="page">
      <div className="section-head">
        <h1>Live news</h1>
        <div className="row">
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
              {f}
              <span className="count">{f === 'All' ? data.feed.articles.length : data.feed.articles.filter((a) => a.category === f).length}</span>
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
            <h4>{a.title}</h4>
            {a.summary && <p className="muted">{a.summary}</p>}
          </a>
        ))}
        {!list.length && !data.feedLoading && <p className="muted">Nothing matches.</p>}
      </div>
    </div>
  );
}

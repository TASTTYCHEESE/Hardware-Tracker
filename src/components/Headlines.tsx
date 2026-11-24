import { useState } from 'react';
import type { Category, FeedArticle } from '../lib/types';
import { CatBadge, catLabel } from './Common';

const ORDER: Category[] = ['GPU', 'CPU', 'RAM', 'Industry', 'Other'];

/** A single tidy list of headlines with category filter chips. */
export function HeadlineColumns({ articles, empty, limit = 15 }: { articles: FeedArticle[]; empty?: string; showTime?: boolean; limit?: number }) {
  const [cat, setCat] = useState<Category | 'All'>('All');
  const [all, setAll] = useState(false);
  if (!articles.length) return <p className="muted">{empty ?? 'No headlines.'}</p>;
  const counts = Object.fromEntries(ORDER.map((c) => [c, articles.filter((a) => a.category === c).length]));
  const list = articles.filter((a) => cat === 'All' || a.category === cat).sort((a, b) => b.date - a.date);
  const shown = all ? list : list.slice(0, limit);
  return (
    <div>
      <div className="chips">
        <button className={cat === 'All' ? 'chip on' : 'chip'} onClick={() => setCat('All')}>
          All <span className="muted small">{articles.length}</span>
        </button>
        {ORDER.filter((c) => counts[c]).map((c) => (
          <button key={c} className={cat === c ? 'chip on' : 'chip'} onClick={() => setCat(c)}>
            {catLabel(c)} <span className="muted small">{counts[c]}</span>
          </button>
        ))}
      </div>
      <div className="hl-list">
        {shown.map((a) => (
          <a className="hl" key={a.id} href={a.link} target="_blank" rel="noreferrer">
            <span className="hl-time muted small">
              {a.date ? new Date(a.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
            <CatBadge c={a.category} />
            <span className="hl-title">{a.title}</span>
            <span className="hl-src muted small">{a.source}</span>
          </a>
        ))}
      </div>
      {list.length > shown.length && (
        <button className="btn small ghost show-more" onClick={() => setAll(true)}>
          Show all {list.length}
        </button>
      )}
    </div>
  );
}

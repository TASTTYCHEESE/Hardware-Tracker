import { useEffect, useMemo, useState } from 'react';
import type { AppData } from '../lib/useData';
import type { FeedArticle } from '../lib/types';
import { api, localDay } from '../lib/platform';
import { RecapView } from './Recaps';
import { HeadlineColumns } from './Headlines';
import { fmtDate } from '../lib/format';

const TYPE_LABEL = { daily: 'Daily', weekly: 'Weekly', catchup: 'Catch-up' } as const;

/** Browsable history: one entry per day with that day's recap(s) and every headline the app saw. */
export function Archive({ data, selected, select }: { data: AppData; selected?: string; select: (v: string) => void }) {
  const [days, setDays] = useState<string[]>([]);
  const [articles, setArticles] = useState<FeedArticle[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    api.listArchiveDays().then(setDays).catch(() => setDays([]));
  }, [data.archiveVersion]);

  const allDays = useMemo(() => {
    const s = new Set([...days, ...data.recaps.map((r) => r.date)]);
    return [...s].filter((d) => d <= localDay()).sort().reverse();
  }, [days, data.recaps]);

  // `selected` may be a day or a recap id (from "Open recap" links).
  const selRecap = data.recaps.find((r) => r.id === selected);
  const day = selRecap?.date ?? (selected && allDays.includes(selected) ? selected : allDays[0]);

  useEffect(() => {
    if (!day) return;
    api.readArchiveDay(day).then(setArticles).catch(() => setArticles([]));
  }, [day, data.archiveVersion]);

  const recaps = data.recaps
    .filter((r) => r.date === day)
    .sort((a, b) => (a.id === selRecap?.id ? -1 : b.id === selRecap?.id ? 1 : 0));
  const filtered = q ? articles.filter((a) => `${a.title} ${a.summary}`.toLowerCase().includes(q.toLowerCase())) : articles;

  return (
    <div className="split">
      <aside className="recap-list">
        <div className="recap-list-head">
          <h2>Archive</h2>
          <button className="btn small ghost" title="Import recap .json files" onClick={async () => {
            if (await api.importRecaps()) data.reloadRecaps();
          }}>
            Import
          </button>
        </div>
        {allDays.map((d) => {
          const rs = data.recaps.filter((r) => r.date === d);
          return (
            <button key={d} className={d === day ? 'recap-item active' : 'recap-item'} onClick={() => select(d)}>
              <span className="recap-title">
                {d === localDay() ? 'Today' : new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="row tight">
                {rs.map((r) => (
                  <span key={r.id} className={`badge type-${r.type}`}>
                    {TYPE_LABEL[r.type]}
                  </span>
                ))}
                {days.includes(d) && <span className="badge">Headlines</span>}
              </span>
              {rs[0] && <span className="muted small clamp">{rs[0].title}</span>}
            </button>
          );
        })}
        {!allDays.length && <p className="muted small">Nothing archived yet.</p>}
      </aside>
      <div className="page">
        {day && <h1 className="muted-h">{fmtDate(day)}</h1>}
        {recaps.map((r) => (
          <section key={r.id} className="panel">
            <RecapView r={r} />
          </section>
        ))}
        <section className="block">
          <div className="block-head">
            <h2>Headlines from this day</h2>
            <input className="search narrow-search" placeholder="Search this day…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <HeadlineColumns articles={filtered} empty="No saved headlines for this day. The app saves headlines from the day you first open it." />
        </section>
      </div>
    </div>
  );
}

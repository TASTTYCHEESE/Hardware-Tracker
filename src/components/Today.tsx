import { useEffect, useState } from 'react';
import type { AppData } from '../lib/useData';
import type { FeedArticle } from '../lib/types';
import { api, localDay } from '../lib/platform';
import { RecapView } from './Recaps';
import { HeadlineColumns } from './Headlines';
import { ago, fmtDate } from '../lib/format';

const LABEL = ['Today', 'Yesterday', 'Day before'];

/** Today (offset 0), yesterday (1) or the day before (2): that day's recap plus its headlines. */
export function Today({ data, go, offset = 0 }: { data: AppData; go: (v: string) => void; offset?: number }) {
  // Re-render after midnight so the days roll over while the app stays open.
  const [now, setNow] = useState(localDay());
  useEffect(() => {
    const t = setInterval(() => setNow(localDay()), 60_000);
    return () => clearInterval(t);
  }, []);
  const day = localDay(new Date(`${now}T12:00:00`).getTime() - offset * 86400e3);

  const [archived, setArchived] = useState<FeedArticle[]>([]);
  useEffect(() => {
    api.readArchiveDay(day).then(setArchived).catch(() => setArchived([]));
  }, [day, data.archiveVersion]);

  const recap = data.recaps.find((r) => r.date === day && r.type !== 'catchup') ?? data.recaps.find((r) => r.date === day);
  const latest = data.recaps.find((r) => r.type !== 'catchup');
  // Today: live headlines plus anything saved earlier today; past days: the archive.
  const live = offset === 0 ? data.feed.articles.filter((a) => localDay(a.date) === day) : [];
  const seen = new Set(live.map((a) => a.id));
  const articles = [...live, ...archived.filter((a) => !seen.has(a.id))];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{LABEL[offset]}</h1>
          <p className="muted">{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button className="link" onClick={() => go('archive')}>
          Older days in the Archive →
        </button>
      </header>

      {recap ? (
        <section className="panel">
          <RecapView key={recap.id} r={recap} />
        </section>
      ) : (
        <section className="card">
          <h3>{offset === 0 ? "Today's recap isn't here yet" : 'No recap for this day'}</h3>
          <p className="muted">
            {offset === 0
              ? 'The daily recap is written every morning at about 7:50 (Sofia time); on Mondays it is the weekly recap with price trends.'
              : 'Recaps start from November 24, 2026, the day the tracker was set up.'}
            {offset === 0 && latest ? (
              <>
                {' '}
                The latest one is from {fmtDate(latest.date)}.{' '}
                <button className="link" onClick={() => go(`recap:${latest.id}`)}>
                  Open it
                </button>
              </>
            ) : null}
          </p>
        </section>
      )}

      <section className="block">
        <div className="block-head">
          <h2>Headlines</h2>
          {offset === 0 && (
            <div className="row">
              <span className="muted small">{data.feedUpdated ? `Updated ${ago(data.feedUpdated)}` : ''}</span>
              <button className="btn small ghost" onClick={data.refreshFeeds} disabled={data.feedLoading}>
                {data.feedLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          )}
        </div>
        <HeadlineColumns
          key={day}
          articles={articles}
          empty={offset === 0 ? (data.feedLoading ? 'Loading…' : 'No headlines published today yet.') : 'No saved headlines for this day. The app saves headlines from the day you first open it.'}
        />
      </section>
    </div>
  );
}

import type { AppData } from '../lib/useData';
import { CATS, CatBadge, DirBadge } from './Common';
import { HeadlineColumns } from './Headlines';
import { REGION_LABEL, ago, fmtDate, fmtPct, money, pct } from '../lib/format';

const CAT_NAME = { GPU: 'Graphics cards', CPU: 'Processors', RAM: 'Memory' } as const;

/** Market dashboard: where prices are heading, the biggest drops, and the latest headlines. */
export function Overview({ data, go }: { data: AppData; go: (v: string) => void }) {
  const latest = data.recaps[0];
  const trendSrc = data.recaps.find((r) => r.trends?.length);
  const drops = data.alerts.filter((a) => a.to < a.from).slice(0, 3);
  if (!latest) return null;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">Where PC hardware prices are heading, and what's new.</p>
        </div>
      </header>

      <button className="banner" onClick={() => go(`recap:${latest.id}`)}>
        <span className={`badge type-${latest.type}`}>{latest.type === 'catchup' ? 'Catch-up' : latest.type === 'weekly' ? 'Weekly' : 'Daily'}</span>
        <span className="banner-title">{latest.title}</span>
        <span className="muted small">{fmtDate(latest.date)} · Read →</span>
      </button>

      {trendSrc?.trends && (
        <section className="block">
          <div className="block-head">
            <h2>Price direction</h2>
            <span className="muted small">as of {fmtDate(trendSrc.date)} · hover a market for details</span>
          </div>
          <div className="pulse-grid">
            {CATS.map((c) => {
              const rows = trendSrc.trends!.filter((t) => t.category === c);
              if (!rows.length) return null;
              return (
                <div className="pulse" key={c}>
                  <div className="pulse-head">
                    <CatBadge c={c} />
                    <span className="pulse-name">{CAT_NAME[c as keyof typeof CAT_NAME]}</span>
                  </div>
                  {rows.map((t) => (
                    <div className="pulse-row" key={t.region} title={t.note}>
                      <span>{REGION_LABEL[t.region]}</span>
                      <DirBadge d={t.direction} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {drops.length > 0 && (
        <section className="block">
          <div className="block-head">
            <h2>Biggest price drops</h2>
            <button className="link" onClick={() => go('alerts')}>
              All alerts →
            </button>
          </div>
          <div className="drop-list">
            {drops.map((a, i) => (
              <div className="drop" key={i}>
                <div>
                  <strong>{a.item}</strong>
                  <div className="muted small">{REGION_LABEL[a.region]}</div>
                </div>
                <div className="drop-price">
                  <s className="muted">{money(a.from, a.currency)}</s>
                  <strong>{money(a.to, a.currency)}</strong>
                  <DirBadge d="down" text={fmtPct(pct(a.from, a.to))} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="block">
        <div className="block-head">
          <h2>Latest headlines</h2>
          <button className="link" onClick={() => go('news')}>
            All news{data.feedUpdated ? ` · updated ${ago(data.feedUpdated)}` : ''} →
          </button>
        </div>
        <HeadlineColumns articles={data.feed.articles} limit={8} empty={data.feedLoading ? 'Loading…' : 'No live headlines yet. Check your connection or the feeds in Settings.'} />
      </section>
    </div>
  );
}

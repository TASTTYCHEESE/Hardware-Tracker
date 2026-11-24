import { useState } from 'react';
import type { Category, Recap } from '../lib/types';
import { CatBadge, DirBadge } from './Common';
import { REGION_LABEL, fmtDate, fmtPct, money, pct, safeUrl } from '../lib/format';

const TYPE_LABEL = { daily: 'Daily recap', weekly: 'Weekly recap', catchup: 'Catch-up' } as const;
const CAT_LABEL: Record<Category, string> = { GPU: 'GPUs', CPU: 'CPUs', RAM: 'RAM', Industry: 'Industry & people', Other: 'Other' };

type Tab = 'summary' | 'news' | 'prices';

/** One recap, split into Summary / News / Prices tabs so it never becomes one long wall of text. */
export function RecapView({ r, compact = false }: { r: Recap; compact?: boolean }) {
  const [tab, setTab] = useState<Tab>('summary');
  const [cat, setCat] = useState<Category | 'All'>('All');
  const newsCount = r.sections.reduce((n, s) => n + s.items.length, 0);
  const hasPrices = !!(r.alerts?.length || r.trends?.length);
  const sections = r.sections.filter((s) => cat === 'All' || s.category === cat);

  return (
    <article className={compact ? 'recap compact' : 'recap'}>
      <div className="recap-head">
        <div className="hero-meta">
          <span className={`badge type-${r.type}`}>{TYPE_LABEL[r.type]}</span>
          <span className="muted small">{fmtDate(r.date)}</span>
        </div>
        <h2 className="recap-title-lg">{r.title}</h2>
      </div>

      <div className="seg">
        <button className={tab === 'summary' ? 'seg-btn on' : 'seg-btn'} onClick={() => setTab('summary')}>
          Summary
        </button>
        <button className={tab === 'news' ? 'seg-btn on' : 'seg-btn'} onClick={() => setTab('news')}>
          News <span className="seg-count">{newsCount}</span>
        </button>
        {hasPrices && (
          <button className={tab === 'prices' ? 'seg-btn on' : 'seg-btn'} onClick={() => setTab('prices')}>
            Prices {r.alerts?.length ? <span className="seg-count good">{r.alerts.length} drops</span> : null}
          </button>
        )}
      </div>

      {tab === 'summary' && (
        <div className="recap-body">
          <p className="lead">{r.summary}</p>
          {r.takeaways && r.takeaways.length > 0 && (
            <div className="takeaway-box">
              <div className="eyebrow">What it means for you</div>
              <ul className="takeaways">
                {r.takeaways.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="row">
            <button className="btn small ghost" onClick={() => setTab('news')}>
              Read the {newsCount} stories →
            </button>
            {hasPrices && (
              <button className="btn small ghost" onClick={() => setTab('prices')}>
                See prices →
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'news' && (
        <div className="recap-body">
          {r.sections.length > 1 && (
            <div className="chips">
              {(['All', ...r.sections.map((s) => s.category)] as (Category | 'All')[]).map((c) => (
                <button key={c} className={c === cat ? 'chip on' : 'chip'} onClick={() => setCat(c)}>
                  {c === 'All' ? 'All' : CAT_LABEL[c]}
                </button>
              ))}
            </div>
          )}
          {sections.map((s) => (
            <section key={s.category} className="story-group">
              <div className="eyebrow">{CAT_LABEL[s.category]}</div>
              {s.items.map((it) => (
                <div className="story" key={it.headline}>
                  <h4>
                    {it.headline}
                    {it.status === 'rumor' && <span className="badge rumor">Rumor</span>}
                  </h4>
                  <p>{it.detail}</p>
                  {it.sources && it.sources.length > 0 && (
                    <div className="story-src">
                      {it.sources.map((src) => (
                        <a key={src.url} href={safeUrl(src.url)} target="_blank" rel="noreferrer">
                          {src.title.split(':')[0]}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {tab === 'prices' && (
        <div className="recap-body">
          {r.alerts && r.alerts.length > 0 && (
            <>
              <div className="eyebrow">Price drops</div>
              <div className="drop-list">
                {r.alerts.map((a, i) => (
                  <div className="drop" key={i}>
                    <div>
                      <strong>{a.item}</strong>
                      <div className="muted small">{REGION_LABEL[a.region]}</div>
                    </div>
                    <div className="drop-price">
                      <s className="muted">{money(a.from, a.currency)}</s>
                      <strong>{money(a.to, a.currency)}</strong>
                      <DirBadge d={a.to < a.from ? 'down' : 'up'} text={fmtPct(pct(a.from, a.to))} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {r.trends && r.trends.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 24 }}>
                Direction by market
              </div>
              {(['GPU', 'CPU', 'RAM'] as Category[]).map((c) => {
                const rows = r.trends!.filter((t) => t.category === c);
                if (!rows.length) return null;
                return (
                  <div key={c} className="trend-block">
                    <CatBadge c={c} />
                    {rows.map((t, i) => (
                      <details key={i} className="trend-line">
                        <summary>
                          <span>{REGION_LABEL[t.region]}</span>
                          <DirBadge d={t.direction} text={t.change} />
                        </summary>
                        <p className="muted small">{t.note}</p>
                      </details>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </article>
  );
}

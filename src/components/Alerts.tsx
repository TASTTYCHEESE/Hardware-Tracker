import type { AppData } from '../lib/useData';
import { CatBadge, DirBadge } from './Common';
import { REGION_LABEL, fmtDate, fmtPct, money, pct, safeUrl } from '../lib/format';

export function Alerts({ data }: { data: AppData }) {
  const list = [...data.alerts].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="page">
      <div className="section-head">
        <h1>Price alerts</h1>
        <span className="muted small">Notable drops flagged by the daily and weekly recaps, major markets only (US, Germany/EU, UK, Japan).</span>
      </div>
      <div className="alert-grid">
        {list.map((a, i) => (
          <div className="card alert" key={i}>
            <div className="alert-top">
              <CatBadge c={a.category} />
              <span className="muted">{REGION_LABEL[a.region]}</span>
              <span className="muted small right">{fmtDate(a.date)}</span>
            </div>
            <h4>{a.item}</h4>
            <div className="alert-price">
              <s>{money(a.from, a.currency)}</s> → <strong>{money(a.to, a.currency)}</strong>
              <DirBadge d={a.to < a.from ? 'down' : 'up'} text={fmtPct(pct(a.from, a.to))} />
            </div>
            {a.note && <div className="muted small">{a.note}</div>}
            {a.source && (
              <a className="small" href={safeUrl(a.source.url)} target="_blank" rel="noreferrer">
                {a.source.title}
              </a>
            )}
          </div>
        ))}
      </div>
      {!list.length && <p className="muted">No price drops flagged yet.</p>}
    </div>
  );
}

import { useMemo, useState } from 'react';
import type { AppData } from '../lib/useData';
import { COUNTRIES } from '../lib/regions';
import { SUGGESTED_MODELS, dropFor, type DropWatch } from '../lib/watch';
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
      {data.settings.dropWatchOn ? (
        <MyDrops data={data} />
      ) : (
        <p className="muted small my-drops-hint">Want an alert when a part you're looking for gets cheaper? Turn on "My price-drop alerts" in Settings → Notifications.</p>
      )}
    </div>
  );
}

const MIN_OPTIONS: [number, string][] = [
  [0, 'Any price drop'],
  [5, 'Price drops of 5% or more'],
  [10, 'Price drops of 10% or more'],
  [20, 'Price drops of 20% or more'],
];

/** Your own list: parts you're looking for, flagged when their price goes down. */
function MyDrops({ data }: { data: AppData }) {
  const list = data.settings.dropWatch ?? [];
  const models = useMemo(() => [...new Set([...SUGGESTED_MODELS, ...data.prices.map((p) => p.model)])].sort(), [data.prices]);
  const [model, setModel] = useState('RTX 5070');
  const [region, setRegion] = useState(() => data.settings.priceRegions?.[0] ?? 'US');
  const [minPct, setMinPct] = useState(0);
  const save = (next: DropWatch[]) => data.setSettings({ dropWatch: next });
  const add = () => {
    if (!model.trim()) return;
    save([...list, { id: `d${Date.now()}`, model: model.trim(), region, minPct }]);
  };
  const country = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;

  return (
    <section className="block my-drops">
      <h2>My price-drop alerts</h2>
      <p className="muted small">Add what you're looking for. It's flagged here, and you get a notification, when its price goes down.</p>
      <div className="watch-grid">
        {list.map((w) => {
          const d = dropFor(w, data.prices);
          const h = data.prices.filter((p) => p.model === w.model && p.region === w.region).sort((a, b) => a.date.localeCompare(b.date));
          const last = h[h.length - 1];
          return (
            <div key={w.id} className={`card alert ${d ? 'drop-hit' : ''}`}>
              <div className="alert-top">
                <span className="muted">{country(w.region)}</span>
                <span className="muted small right">{MIN_OPTIONS.find(([v]) => v === w.minPct)?.[1] ?? 'Any price drop'}</span>
              </div>
              <h4 translate="no">{w.model}</h4>
              {d ? (
                <div className="alert-price">
                  <s>{money(d.prev.price, d.prev.currency)}</s> → <strong>{money(d.last.price, d.last.currency)}</strong>
                  <DirBadge d="down" text={fmtPct(-d.pct)} />
                </div>
              ) : last ? (
                <div className="muted small">
                  Latest: {money(last.price, last.currency)} ({fmtDate(last.date)}). No drop yet.
                </div>
              ) : (
                <div className="muted small">No price recorded for this part in this country yet.</div>
              )}
              <button className="link small" onClick={() => save(list.filter((x) => x.id !== w.id))}>
                Remove
              </button>
            </div>
          );
        })}
      </div>
      <div className="card add-watch">
        <label>
          <span className="muted small">Part</span>
          <input list="hwt-drop-models" className="input" value={model} onChange={(e) => setModel(e.target.value)} />
          <datalist id="hwt-drop-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label>
          <span className="muted small">Country</span>
          <select className="select" value={region} onChange={(e) => setRegion(e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted small">Alert me on</span>
          <select className="select" value={minPct} onChange={(e) => setMinPct(Number(e.target.value))}>
            {MIN_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={add}>
          Add alert
        </button>
      </div>
    </section>
  );
}

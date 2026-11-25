import { useMemo, useState } from 'react';
import type { AppData } from '../lib/useData';
import { COUNTRIES } from '../lib/regions';
import { REGION_LABEL, money, pct, fmtPct } from '../lib/format';
import { SUGGESTED_MODELS as SUGGESTED, historyFor, type WatchItem } from '../lib/watch';
import { DirBadge, Sparkline } from './Common';


/** Watchlist: pick a part + country + target price, get a notification when it drops to the target. */
export function Tracking({ data }: { data: AppData }) {
  const list = data.watchlist;
  const models = useMemo(() => [...new Set([...SUGGESTED, ...data.prices.map((p) => p.model)])].sort(), [data.prices]);
  const [model, setModel] = useState('RTX 5070');
  const [region, setRegion] = useState('BG');
  const [target, setTarget] = useState('');
  const currency = COUNTRIES.find((c) => c.code === region)?.currency ?? 'USD';

  const save = (next: WatchItem[]) => data.setSettings({ watchlist: next });
  const add = () => {
    const t = Number(target.replace(',', '.'));
    if (!t || t <= 0) return;
    save([...list, { id: `w${Date.now()}`, model, region, target: t, currency }]);
    setTarget('');
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Tracking</h1>
          <p className="muted">Pick a part, a country and the price you'd pay. You'll get a notification when it drops to that price.</p>
        </div>
      </header>

      <div className="watch-grid">
        {list.map((w) => {
          const h = historyFor(w, data.prices);
          const last = h[h.length - 1];
          const prev = h[h.length - 2];
          const hit = last && last.price <= w.target;
          const gap = last ? last.price - w.target : 0;
          return (
            <div key={w.id} className={hit ? 'watch hit' : 'watch'}>
              <div className="watch-top">
                <div>
                  <strong>{w.model}</strong>
                  <div className="muted small">{REGION_LABEL[w.region as keyof typeof REGION_LABEL] ?? w.region}</div>
                </div>
                <button className="chip-x" title="Stop tracking" onClick={() => save(list.filter((x) => x.id !== w.id))}>
                  ×
                </button>
              </div>
              <div className="watch-prices">
                <div>
                  <div className="muted small">Now</div>
                  <div className="watch-now">{last ? money(last.price, last.currency) : '—'}</div>
                </div>
                <div>
                  <div className="muted small">Your target</div>
                  <div className="watch-target">{money(w.target, w.currency)}</div>
                </div>
                <Sparkline values={h.map((p) => p.price)} w={110} h={34} />
              </div>
              <div className="watch-status">
                {!last && <span className="muted small">No price yet. It will appear after the next weekly recap.</span>}
                {last && hit && <span className="hit-text">✓ At or below your target!</span>}
                {last && !hit && (
                  <span className="muted small">
                    {money(gap, last.currency)} to go (needs a {Math.abs(pct(last.price, w.target)).toFixed(0)}% drop)
                  </span>
                )}
                {prev && last && <DirBadge d={last.price < prev.price ? 'down' : last.price > prev.price ? 'up' : 'flat'} text={fmtPct(pct(prev.price, last.price))} />}
              </div>
            </div>
          );
        })}
      </div>

      <section className="block">
        <h2 style={{ marginBottom: 14 }}>Track something new</h2>
        <div className="card add-watch">
          <label>
            <span className="muted small">Part</span>
            <input list="hwt-models" className="input" value={model} onChange={(e) => setModel(e.target.value)} />
            <datalist id="hwt-models">
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
            <span className="muted small">Target price ({currency})</span>
            <input className="input" inputMode="decimal" placeholder="e.g. 650" value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          </label>
          <button className="btn" onClick={add} disabled={!target}>
            Track
          </button>
        </div>
        <p className="muted small">
          Prices come from the daily and weekly recaps. Use the same part names as on the Prices page so the app can match them. Live
          shop prices (more frequent updates) are coming later.
        </p>
      </section>
    </div>
  );
}

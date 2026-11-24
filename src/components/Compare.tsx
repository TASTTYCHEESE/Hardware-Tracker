import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/platform';
import type { AppData } from '../lib/useData';
import { META_KEYS, formatValue, type CatalogCategory, type CatalogIndex, type CatalogItem } from '../lib/catalog';
import { perfFor } from '../lib/perf';
import { saveElementAsImage } from '../lib/image';
import { modelName } from './PriceProducts';
import { money } from '../lib/format';

type Group = 'hardware' | 'peripherals';
const MAX = 4;

/** For these specs a lower number is better; for other numbers, higher is better. */
const LOWER = new Set(['tdp', 'weight_g', 'launch_price_usd', 'response_time', 'cas_latency', 'first_word_latency', 'process_nm', 'psu', 'pop_rank', 'price', 'value']);
/** Numbers that aren't better or worse. */
const NEUTRAL = new Set(['length_mm', 'slots', 'steam_peak_month', 'year', 'thickness_mm', 'die_mm2', 'transistors_m']);

const catCache = new Map<string, CatalogCategory>();
export async function loadCategory(id: string) {
  if (!catCache.has(id)) catCache.set(id, await api.catalogCategory(id));
  return catCache.get(id)!;
}

/** Latest price for a GPU / CPU in the user's first country, from the recaps. */
function latestPrice(data: AppData, item: CatalogItem, category: 'GPU' | 'CPU') {
  const m = modelName(item).toLowerCase().replace(/[^a-z0-9]/g, '');
  const region = data.settings.priceRegions?.[0] ?? 'US';
  const pts = data.prices.filter((p) => p.category === category && p.region === region && p.model.toLowerCase().replace(/[^a-z0-9]/g, '') === m);
  return pts[pts.length - 1];
}

export function Compare({ data }: { data: AppData }) {
  const [index, setIndex] = useState<CatalogIndex | null>(null);
  const [err, setErr] = useState('');
  const saved = data.settings.compare ?? { cat: 'gpu', ids: [] };
  const [group, setGroup] = useState<Group>('hardware');
  const [cat, setCat] = useState<CatalogCategory | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.catalogIndex().then(setIndex).catch((e) => setErr(String(e.message || e)));
  }, []);
  useEffect(() => {
    if (!index) return;
    const info = index.categories.find((c) => c.id === saved.cat);
    if (info) setGroup(info.group);
    setCat(null);
    loadCategory(saved.cat).then(setCat).catch((e) => setErr(String(e.message || e)));
  }, [index, saved.cat]);

  const setSaved = (next: { cat: string; ids: string[] }) => data.setSettings({ compare: next });
  const cats = (index?.categories ?? []).filter((c) => c.group === group && c.count > 0).sort((a, b) => a.name.localeCompare(b.name));
  const picked = (cat ? saved.ids.map((id) => cat.items.find((i) => i.id === id)).filter(Boolean) : []) as CatalogItem[];

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!cat || !words.length) return [];
    return cat.items
      .filter((i) => !saved.ids.includes(i.id) && words.every((w) => `${i.name} ${i.maker}`.toLowerCase().includes(w)))
      .sort((a, b) => ((a.pop_rank as number) ?? 1e9) - ((b.pop_rank as number) ?? 1e9) || (b.year ?? 0) - (a.year ?? 0))
      .slice(0, 8);
  }, [cat, q, saved.ids.join()]);

  // Rows: every spec any picked product has, in the category's order.
  const rows = useMemo(() => {
    if (!cat || !picked.length) return [];
    const out: { k: string; label: string; unit?: string }[] = [
      { k: 'maker', label: 'Manufacturer' },
      { k: 'year', label: 'Released' },
    ];
    for (const f of cat.fields) if (f.k !== 'date' && !META_KEYS.has(f.k) && picked.some((p) => p[f.k] !== undefined && p[f.k] !== '')) out.push(f);
    for (const p of picked)
      for (const k of Object.keys(p))
        if (!META_KEYS.has(k) && !out.some((r) => r.k === k) && k !== 'date' && typeof p[k] !== 'object') out.push({ k, label: k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) });
    return out;
  }, [cat, picked.map((p) => p.id).join()]);

  // Price and value rows for GPUs and CPUs.
  const pc = cat?.id === 'gpu' ? 'GPU' : cat?.id === 'cpu' ? 'CPU' : null;
  const extra = pc
    ? picked.map((p) => {
        const src = p.kind === 'Retail card' && typeof p.chip_id === 'string' ? cat!.items.find((i) => i.id === p.chip_id) ?? p : p;
        const perf = perfFor(modelName(src), pc);
        const last = latestPrice(data, src, pc);
        const price = last?.price ?? perf?.msrp;
        return { perf: perf?.score, price, cur: last ? last.currency : 'USD', priceNote: last ? `latest, ${last.region}` : perf?.msrp ? 'MSRP' : '', value: perf && price ? price / perf.score : undefined };
      })
    : [];

  const best = (vals: (number | undefined)[], k: string) => {
    const nums = vals.filter((v): v is number => typeof v === 'number');
    if (nums.length < 2 || NEUTRAL.has(k) || new Set(nums).size < 2) return undefined;
    return LOWER.has(k) ? Math.min(...nums) : Math.max(...nums);
  };

  if (err) return <div className="page muted">{err}</div>;
  if (!index) return <div className="page muted">Loading the hardware catalog…</div>;

  return (
    <div className="page">
      <div className="section-head">
        <h1>Compare</h1>
        <span className="muted small">Put up to {MAX} products side by side. The best value in each row is highlighted.</span>
      </div>
      <div className="toolbar">
        <div className="tabs">
          {(['hardware', 'peripherals'] as Group[]).map((g) => (
            <button
              key={g}
              className={group === g ? 'tab active' : 'tab'}
              onClick={() => {
                setGroup(g);
                const first = index.categories.filter((c) => c.group === g && c.count > 0).sort((a, b) => a.name.localeCompare(b.name))[0];
                if (first) setSaved({ cat: g === 'hardware' ? 'gpu' : first.id, ids: [] });
              }}
            >
              {g === 'hardware' ? 'Hardware' : 'Peripherals'}
            </button>
          ))}
        </div>
        <select className="select" value={saved.cat} onChange={(e) => setSaved({ cat: e.target.value, ids: [] })}>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {picked.length < MAX && (
          <div className="cmp-search">
            <input className="search" placeholder={cat ? `Add a product to compare (search ${cat.name.toLowerCase()})…` : 'Loading…'} value={q} onChange={(e) => setQ(e.target.value)} disabled={!cat} />
            {results.length > 0 && (
              <div className="cmp-results card">
                {results.map((r) => (
                  <button
                    key={r.id}
                    className="add-row"
                    onClick={() => {
                      setSaved({ cat: saved.cat, ids: [...saved.ids, r.id] });
                      setQ('');
                    }}
                  >
                    <span>
                      <strong>{r.name}</strong> <span className="muted small">{[r.maker, r.year, r.kind].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="small">+ Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {picked.length > 0 && (
          <>
            <button
              className="btn small"
              onClick={async () => {
                setMsg('Saving…');
                setMsg(await saveElementAsImage(boxRef.current, `Compare ${picked.map((p) => p.name).join(' vs ')}`).catch((e) => `Couldn't save: ${e.message || e}`));
              }}
            >
              Save as image
            </button>
            <button className="link small" onClick={() => setSaved({ cat: saved.cat, ids: [] })}>
              Clear
            </button>
          </>
        )}
        {msg && <span className="muted small">{msg}</span>}
      </div>

      {!cat && <p className="muted">Loading…</p>}
      {cat && picked.length === 0 && (
        <div className="card">
          <p>Search above to add products, or open any product in Hardware or Peripherals and click "⇄ Compare".</p>
          <p className="muted small">Products are compared within one category: graphics card with graphics card, mouse with mouse.</p>
        </div>
      )}
      {cat && picked.length > 0 && (
        <div className="cmp-box" ref={boxRef}>
          <table className="ptable cmp-table">
            <thead>
              <tr>
                <th>{cat.name}</th>
                {picked.map((p) => (
                  <th key={p.id}>
                    <div className="cmp-name">{p.name}</div>
                    <button className="chip-x" data-no-export title="Remove" onClick={() => setSaved({ cat: saved.cat, ids: saved.ids.filter((x) => x !== p.id) })}>
                      ×
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pc && (
                <>
                  <tr>
                    <th>Gaming performance (approx.)</th>
                    {extra.map((x, i) => {
                      const b = best(extra.map((e) => e.perf), 'perf');
                      return <td key={i} className={b !== undefined && x.perf === b ? 'best' : ''}>{x.perf ?? <span className="muted">–</span>}</td>;
                    })}
                  </tr>
                  <tr>
                    <th>Price</th>
                    {extra.map((x, i) => (
                      <td key={i}>
                        {x.price ? money(x.price, x.cur) : <span className="muted">–</span>}
                        {x.priceNote && <div className="muted small">{x.priceNote}</div>}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th>Price per performance point</th>
                    {extra.map((x, i) => {
                      const b = best(extra.map((e) => e.value), 'value');
                      return <td key={i} className={b !== undefined && x.value === b ? 'best' : ''}>{x.value ? money(x.value, x.cur) : <span className="muted">–</span>}</td>;
                    })}
                  </tr>
                </>
              )}
              {rows.map((r) => {
                const vals = picked.map((p) => p[r.k]);
                const b = best(vals.map((v) => (typeof v === 'number' ? v : undefined)), r.k);
                const allSame = vals.every((v) => String(v ?? '') === String(vals[0] ?? ''));
                return (
                  <tr key={r.k} className={allSame && picked.length > 1 ? 'same' : ''}>
                    <th>{r.label}</th>
                    {vals.map((v, i) => (
                      <td key={i} className={b !== undefined && v === b ? 'best' : ''}>
                        {v === undefined || v === '' ? <span className="muted">–</span> : r.k === 'year' ? String(v) : formatValue(v, r.unit)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">
            Green = best in that row (higher is better, except power draw, weight, price, latency and similar). Performance and value use approximate review averages; prices are the latest
            weekly price in your first price-tracker country, or the launch price (MSRP) when there's none yet. Hardware Tracker · {new Date().toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}

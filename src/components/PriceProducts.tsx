import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/platform';
import type { CatalogItem } from '../lib/catalog';
import { RAM_KITS, RAM_SPEEDS, parseRam, ramLabel } from '../lib/ram';

export type PCat = 'GPU' | 'CPU' | 'RAM';
export interface PriceProduct {
  model: string;
  category: PCat;
  core?: boolean;
}

export const PRODUCTS_URL = 'https://raw.githubusercontent.com/TASTTYCHEESE/Hardware-Tracker/main/prices/products.json';
const ISSUE_URL = 'https://github.com/TASTTYCHEESE/Hardware-Tracker/issues/new';

/** Product names the way the recaps write them: "RTX 4070 SUPER", "Ryzen 7 9800X3D", "Arc B580". */
export function modelName(item: CatalogItem): string {
  return item.name
    .replace(/^(GeForce|Radeon|AMD|Intel)\s+/i, '')
    .replace(/^(Radeon|Intel)\s+/i, '')
    .replace(/\s+(\d+)\s+GB$/i, ' $1GB')
    .trim();
}
export const key = (m: string) => m.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** The weekly price list (prices/products.json in the repo). */
export function useProductList() {
  const [list, setList] = useState<PriceProduct[] | null>(null);
  useEffect(() => {
    api
      .fetchText(`${PRODUCTS_URL}?t=${Math.floor(Date.now() / 3600e3)}`)
      .then((t) => setList(JSON.parse(t).products ?? []))
      .catch(() => setList([]));
  }, []);
  return list;
}

const catalogCache: Record<string, CatalogItem[]> = {};

export function AddProducts({
  mine,
  setMine,
  weekly,
  close,
}: {
  mine: PriceProduct[];
  setMine: (next: PriceProduct[]) => void;
  weekly: PriceProduct[];
  close: () => void;
}) {
  const [tab, setTab] = useState<PCat>('GPU');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [err, setErr] = useState('');
  const weeklyKeys = useMemo(() => new Set(weekly.map((p) => key(p.model))), [weekly]);
  const mineKeys = new Set(mine.map((p) => key(p.model)));

  useEffect(() => {
    if (tab === 'RAM') return;
    const id = tab === 'GPU' ? 'gpu' : 'cpu';
    if (catalogCache[id]) return setItems(catalogCache[id]);
    setItems(null);
    api
      .catalogCategory(id)
      .then((c) => {
        // Products sold in shops (they have a PCPartPicker rank), most popular first.
        const list = c.items
          .filter((i) => typeof i.pop_rank === 'number' && (id === 'cpu' || i.kind === 'GPU chip') && !/mobile|max-q|laptop/i.test(i.name))
          .sort((a, b) => (a.pop_rank as number) - (b.pop_rank as number));
        catalogCache[id] = list;
        setItems(list);
      })
      .catch((e) => setErr(String(e.message || e)));
  }, [tab]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (items ?? []).filter((i) => words.every((w) => i.name.toLowerCase().includes(w))).slice(0, 60);
  }, [items, q]);

  const toggle = (model: string, category: PCat) =>
    mineKeys.has(key(model)) ? setMine(mine.filter((p) => key(p.model) !== key(model))) : setMine([...mine, { model, category }]);

  // RAM is picked by its specs.
  const [ramType, setRamType] = useState('DDR5');
  const [ramSpeed, setRamSpeed] = useState(6000);
  const [ramKit, setRamKit] = useState('2x16');
  const [ramCl, setRamCl] = useState('');
  const [laptop, setLaptop] = useState(false);
  const ramModel = `${ramType}-${ramSpeed}${laptop ? ' SO-DIMM' : ''} ${ramKit}GB${ramCl ? ` CL${ramCl}` : ''}`;
  const ram = ramLabel(parseRam(ramModel)!);

  const requests = mine.filter((p) => !weeklyKeys.has(key(p.model)));
  const requestUrl = () => {
    const title = `Price request: ${requests.map((p) => p.model).join(', ')}`.slice(0, 200);
    const body = `Please add these to the weekly price list (prices/products.json):\n\n${requests.map((p) => `- ${p.category}: ${p.model}`).join('\n')}\n\n_Sent from the Hardware Tracker app._`;
    return `${ISSUE_URL}?labels=price-request&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="card add-products">
      <div className="add-head">
        <div className="tabs">
          {(['GPU', 'CPU', 'RAM'] as PCat[]).map((c) => (
            <button key={c} className={tab === c ? 'tab active' : 'tab'} onClick={() => { setTab(c); setQ(''); }}>
              {c === 'RAM' ? 'RAM' : `${c}s`}
            </button>
          ))}
        </div>
        {tab !== 'RAM' && (
          <input className="search" autoFocus placeholder={tab === 'GPU' ? 'Search graphics cards (e.g. 4070, 9060)…' : 'Search processors (e.g. 9800X3D, 14600K)…'} value={q} onChange={(e) => setQ(e.target.value)} />
        )}
        <button className="btn small" onClick={close}>
          Done
        </button>
      </div>

      {tab !== 'RAM' && (
        <div className="add-list">
          {err && <p className="muted">{err}</p>}
          {!items && !err && <p className="muted small">Loading the catalog…</p>}
          {shown.map((i) => {
            const m = modelName(i);
            const on = mineKeys.has(key(m));
            const priced = weeklyKeys.has(key(m));
            return (
              <button key={i.id} className={on ? 'add-row on' : 'add-row'} onClick={() => toggle(m, tab)}>
                <span>
                  <strong>{m}</strong>
                  <span className="muted small"> {[i.year, i.memory, i.cores ? `${i.cores} cores` : '', i.socket].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="small">
                  {priced ? <span className="badge confirmed">Priced weekly</span> : <span className="muted">Not priced yet</span>}
                  <span className="add-btn">{on ? '✓ Added' : '+ Add'}</span>
                </span>
              </button>
            );
          })}
          {items && !shown.length && <p className="muted small">Nothing matches "{q}".</p>}
        </div>
      )}

      {tab === 'RAM' && (
        <div className="ram-builder">
          <p className="muted small">Memory is tracked by its specs: the cheapest in-stock kit that matches.</p>
          <div className="toolbar">
            <select className="select" value={ramType} onChange={(e) => { setRamType(e.target.value); setRamSpeed(e.target.value === 'DDR5' ? 6000 : 3200); }}>
              <option>DDR5</option>
              <option>DDR4</option>
            </select>
            <select className="select" value={ramSpeed} onChange={(e) => setRamSpeed(Number(e.target.value))}>
              {RAM_SPEEDS[ramType].map((s) => (
                <option key={s} value={s}>
                  {s} MT/s
                </option>
              ))}
            </select>
            <select className="select" value={ramKit} onChange={(e) => setRamKit(e.target.value)}>
              {RAM_KITS.map((k) => {
                const [n, g] = k.split('x').map(Number);
                return (
                  <option key={k} value={k}>
                    {n} × {g} GB ({n * g} GB)
                  </option>
                );
              })}
            </select>
            <select className="select" value={ramCl} onChange={(e) => setRamCl(e.target.value)}>
              <option value="">Any latency</option>
              {(ramType === 'DDR5' ? [28, 30, 32, 36, 40] : [14, 16, 18, 22]).map((c) => (
                <option key={c} value={c}>
                  CL{c} or better
                </option>
              ))}
            </select>
            <select className="select" value={laptop ? 'l' : 'd'} onChange={(e) => setLaptop(e.target.value === 'l')}>
              <option value="d">Desktop (DIMM)</option>
              <option value="l">Laptop (SO-DIMM)</option>
            </select>
          </div>
          <div className="add-row static">
            <span>
              <strong>{ram.main}</strong>
              <span className="muted small"> {ram.sub}</span>
            </span>
            <span className="small">
              {weeklyKeys.has(key(ramModel)) ? <span className="badge confirmed">Priced weekly</span> : <span className="muted">Not priced yet</span>}
              <button className="btn small" onClick={() => toggle(ramModel, 'RAM')}>
                {mineKeys.has(key(ramModel)) ? '✓ Added (remove)' : '+ Add'}
              </button>
            </span>
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <div className="add-request">
          <span className="small">
            {requests.length} of your products {requests.length === 1 ? "isn't" : "aren't"} on the weekly price list yet ({requests.map((p) => p.model).join(', ')}).
            Send a request and the next weekly recap adds {requests.length === 1 ? 'it' : 'them'}.
          </span>
          <button className="btn small" onClick={() => window.open(requestUrl(), '_blank')}>
            Request prices (opens GitHub)
          </button>
        </div>
      )}
    </div>
  );
}

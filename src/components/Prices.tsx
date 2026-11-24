import { useEffect, useMemo, useState } from 'react';
import { convert, loadRates, type Currency, type Rates } from '../lib/fx';
import type { AppData } from '../lib/useData';
import type { Category, PricePoint, Region } from '../lib/types';
import { COUNTRIES, COUNTRY_CODES, CURRENCIES, GROUPS, type CountryCode } from '../lib/regions';
import { CatBadge, DirBadge, Sparkline, catLabel } from './Common';
import { REGION_LABEL, fmtDate, fmtPct, money, pct } from '../lib/format';

const shortDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.slice(0, 4) === String(new Date().getFullYear()) ? {} : { year: 'numeric' }) });

const CAT_ORDER = ['GPU', 'CPU', 'RAM', 'Other'];
const ORDER = COUNTRY_CODES as string[];

type PSort = 'product' | 'high' | 'low' | 'recent' | 'past' | 'msrp';
const PSORTS: [PSort, string][] = [
  ['product', 'Product (A–Z)'],
  ['high', 'Highest change (biggest rise)'],
  ['low', 'Lowest change (biggest drop)'],
  ['recent', 'Most recent change'],
  ['past', 'Oldest change'],
  ['msrp', 'Best deal vs MSRP'],
];

/** Everything the table shows about one product in one country. */
function summarize(s: PricePoint[]) {
  const last = s[s.length - 1];
  const prev = s.length > 1 ? s[s.length - 2] : undefined;
  const first = s[0];
  const prices = s.map((p) => p.price);
  // When did the price last actually move?
  let changed: string | undefined;
  for (let i = s.length - 1; i > 0; i--) if (s[i].price !== s[i - 1].price) { changed = s[i].date; break; }
  const msrp = s.find((p) => p.msrp)?.msrp;
  return {
    s, last, prev, first, msrp, changed,
    ch: prev ? pct(prev.price, last.price) : undefined,
    total: s.length > 1 ? pct(first.price, last.price) : undefined,
    low: Math.min(...prices),
    high: Math.max(...prices),
    vsMsrp: msrp ? pct(msrp, last.price) : undefined,
  };
}
type Row = ReturnType<typeof summarize>;
const missingLast = (x: number | string | undefined, y: number | string | undefined) => (x === undefined ? 1 : 0) - (y === undefined ? 1 : 0);

export function Prices({ data }: { data: AppData }) {
  const [cat, setCat] = useState<Category | 'All'>('All');
  const [q, setQ] = useState('');
  const sort = (data.settings.priceSort ?? 'product') as PSort;
  const setSort = (v: PSort) => data.setSettings({ priceSort: v });
  const [pickerOpen, setPickerOpen] = useState(false);
  // Chosen countries are remembered between sessions; the default is the US.
  const saved = (data.settings.priceRegions ?? []).filter((r): r is CountryCode => ORDER.includes(r));
  const regions: CountryCode[] = saved.length ? saved : ['US'];
  const setRegions = (next: CountryCode[]) => data.setSettings({ priceRegions: next });
  // Currency: "local" shows each country's own currency; otherwise everything is converted.
  const target = (data.settings.priceCurrency ?? 'local') as Currency | 'local';
  const [fx, setFx] = useState<Rates | null>(null);
  useEffect(() => {
    if (target === 'local' || fx) return;
    loadRates(data.settings.fxRates).then(setFx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const shown = (price: number, cur: string) => {
    if (target === 'local' || cur === target || !fx) return null;
    return convert(price, cur, target, fx);
  };

  const toggle = (r: CountryCode) => {
    if (regions.includes(r)) {
      if (regions.length > 1) setRegions(regions.filter((x) => x !== r));
    } else setRegions(COUNTRY_CODES.filter((x) => x === r || regions.includes(x)));
  };

  // All series for the chosen countries (before the category / search filters), for the counts.
  const all = useMemo(() => {
    const m = new Map<string, PricePoint[]>();
    for (const p of data.prices) {
      if (!(regions as Region[]).includes(p.region)) continue;
      const k = `${p.model}|${p.region}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    for (const v of m.values()) v.sort((a, b) => a.date.localeCompare(b.date));
    return [...m.values()].map(summarize);
  }, [data.prices, regions.join()]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of all) c[r.last.category] = (c[r.last.category] ?? 0) + 1;
    return c;
  }, [all]);

  const rows = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = all.filter((r) => {
      if (cat !== 'All' && r.last.category !== cat) return false;
      const hay = `${r.last.model} ${REGION_LABEL[r.last.region]} ${r.last.category}s`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    const byName = (a: Row, b: Row) =>
      CAT_ORDER.indexOf(a.last.category) - CAT_ORDER.indexOf(b.last.category) ||
      a.last.model.localeCompare(b.last.model) ||
      ORDER.indexOf(a.last.region) - ORDER.indexOf(b.last.region);
    const cmp: Record<PSort, (a: Row, b: Row) => number> = {
      product: byName,
      high: (a, b) => missingLast(a.ch, b.ch) || (b.ch ?? 0) - (a.ch ?? 0) || byName(a, b),
      low: (a, b) => missingLast(a.ch, b.ch) || (a.ch ?? 0) - (b.ch ?? 0) || byName(a, b),
      recent: (a, b) => missingLast(a.changed, b.changed) || (b.changed ?? '').localeCompare(a.changed ?? '') || byName(a, b),
      past: (a, b) => missingLast(a.changed, b.changed) || (a.changed ?? '').localeCompare(b.changed ?? '') || byName(a, b),
      msrp: (a, b) => missingLast(a.vsMsrp, b.vsMsrp) || (a.vsMsrp ?? 0) - (b.vsMsrp ?? 0) || byName(a, b),
    };
    return list.sort(cmp[sort] ?? byName);
  }, [all, cat, q, sort]);

  const rising = rows.filter((r) => (r.ch ?? 0) > 0.5).length;
  const falling = rows.filter((r) => (r.ch ?? 0) < -0.5).length;
  const below = rows.filter((r) => r.vsMsrp !== undefined && r.vsMsrp < 0).length;
  const money2 = (price: number, cur: string) => {
    const c = shown(price, cur);
    return c === null ? money(price, cur) : money(c, target as string);
  };

  const withData = new Set(data.prices.map((p) => p.region));
  const missing = regions.filter((r) => !all.some((x) => x.last.region === r));

  return (
    <div className="page">
      <div className="section-head">
        <h1>Price tracker</h1>
        <span className="muted small">Lowest in-stock prices from the recaps. Pick countries to compare; your choice is remembered.</span>
      </div>
      <div className="toolbar">
        <div className="tabs">
          {(['All', ...CAT_ORDER.filter((c) => counts[c])] as (Category | 'All')[]).map((c) => (
            <button key={c} className={c === cat ? 'tab active' : 'tab'} onClick={() => setCat(c)}>
              {catLabel(c)}
              <span className="count">{c === 'All' ? all.length : counts[c]}</span>
            </button>
          ))}
        </div>
        <input className="search" placeholder="Search products (e.g. 5090, 9800X3D, DDR5)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="tabs">
          <span className="tab-label muted small">Sort</span>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as PSort)}>
            {PSORTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="tabs">
          <span className="tab-label muted small">Currency</span>
          <select className="select" value={target} onChange={(e) => data.setSettings({ priceCurrency: e.target.value })}>
            <option value="local">Local (each country's own)</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="country-bar">
        <span className="muted small">Countries:</span>
        {regions.map((r) => (
          <span key={r} className="chip on">
            {REGION_LABEL[r]}
            {regions.length > 1 && (
              <button className="chip-x" onClick={() => toggle(r)} title={`Remove ${REGION_LABEL[r]}`}>
                ×
              </button>
            )}
          </span>
        ))}
        <button className="btn small ghost" onClick={() => setPickerOpen((o) => !o)}>
          {pickerOpen ? 'Done' : '+ Add / change countries'}
        </button>
        {regions.length > 1 && (
          <button className="link small" onClick={() => setRegions(['US'])}>
            Reset to US
          </button>
        )}
      </div>

      {pickerOpen && (
        <div className="card country-picker">
          {GROUPS.map((g) => (
            <div key={g} className="country-group">
              <div className="muted small">{g}</div>
              <div className="chips">
                {COUNTRIES.filter((c) => c.group === g).map((c) => (
                  <button key={c.code} className={regions.includes(c.code) ? 'chip on' : 'chip'} onClick={() => toggle(c.code)} aria-pressed={regions.includes(c.code)}>
                    {regions.includes(c.code) ? '✓ ' : ''}
                    {c.name}
                    <span className="muted small"> {c.currency}</span>
                    {!withData.has(c.code) && <span className="nodata" title="No prices collected yet"> ·</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="muted small">Countries marked with a dot have no prices yet. The weekly recap collects prices for every country on this list.</p>
        </div>
      )}

      {target !== 'local' && (
        <p className="muted small fx-note">
          {fx
            ? `Converted to ${target} at ${fx.source} rates${fx.date ? ` from ${fx.date}` : ''}. The original price is shown underneath. US and Canada prices are before sales tax; most other countries include VAT.`
            : 'Loading exchange rates…'}
        </p>
      )}
      {missing.length > 0 && (
        <p className="muted small fx-note">
          No prices yet for {missing.map((r) => REGION_LABEL[r]).join(', ')}. They'll start appearing with the next weekly recap (Monday 8:00).
        </p>
      )}
      {all.length > 0 && (
        <div className="p-stats">
          <div><b>{rows.length}</b><span className="muted small">{rows.length === 1 ? 'product shown' : 'products shown'}</span></div>
          <div><b className="neg">▲ {rising}</b><span className="muted small">rising</span></div>
          <div><b className="pos">▼ {falling}</b><span className="muted small">falling</span></div>
          <div><b>{rows.length - rising - falling}</b><span className="muted small">flat or new</span></div>
          <div><b className="pos">{below}</b><span className="muted small">below MSRP</span></div>
        </div>
      )}
      <div className="ptable-wrap">
      <table className="ptable">
        <thead>
          <tr>
            <th>Product</th>
            {regions.length > 1 && <th>Market</th>}
            <th>Latest</th>
            <th>MSRP</th>
            <th>vs MSRP</th>
            <th>Change</th>
            <th>Since first</th>
            <th>Low / High</th>
            <th>History</th>
            <th>Last change</th>
            <th>As of</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const { last, prev, ch, s } = r;
            return (
              <tr key={`${last.model}|${last.region}`}>
                <td>
                  <CatBadge c={last.category} /> {last.model}
                </td>
                {regions.length > 1 && <td>{REGION_LABEL[last.region]}</td>}
                <td className="num">
                  {money2(last.price, last.currency)}
                  {shown(last.price, last.currency) !== null && <div className="muted small">{money(last.price, last.currency)}</div>}
                </td>
                <td className="num muted">{r.msrp ? money2(r.msrp, last.currency) : '–'}</td>
                <td className="num">{r.vsMsrp !== undefined ? <span className={r.vsMsrp > 0 ? 'neg' : 'pos'}>{fmtPct(r.vsMsrp)}</span> : <span className="muted">–</span>}</td>
                <td title={prev ? `${money(prev.price, prev.currency)} on ${shortDate(prev.date)} → ${money(last.price, last.currency)}` : ''}>
                  {prev && ch !== undefined ? <DirBadge d={ch < -0.5 ? 'down' : ch > 0.5 ? 'up' : 'flat'} text={fmtPct(ch)} /> : <span className="muted small">–</span>}
                </td>
                <td className="num" title={s.length > 1 ? `since ${shortDate(r.first.date)}` : ''}>
                  {r.total !== undefined ? <span className={r.total > 0.5 ? 'neg' : r.total < -0.5 ? 'pos' : 'muted'}>{fmtPct(r.total)}</span> : <span className="muted">–</span>}
                </td>
                <td className="num small">
                  {s.length > 1 ? (
                    <>
                      {money2(r.low, last.currency)}
                      <div className="muted">{money2(r.high, last.currency)}</div>
                    </>
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
                <td title={`${s.length} data point${s.length === 1 ? '' : 's'}`}>
                  <Sparkline values={s.map((p) => p.price)} />
                  <div className="muted small">{s.length} {s.length === 1 ? "point" : "points"}</div>
                </td>
                <td className="muted small">{r.changed ? shortDate(r.changed) : 'No change yet'}</td>
                <td className="muted small" title={last.source}>
                  {shortDate(last.date)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      {!rows.length && <p className="muted">{q.trim() ? `Nothing matches "${q.trim()}"${cat !== 'All' ? ` in ${catLabel(cat)}` : ''}.` : 'No prices for this filter yet.'}</p>}
      <p className="muted small">
        "Change" compares the two most recent data points; "Since first" compares with the first price we recorded. "Last change" is the date the price last moved. Green on "vs MSRP" means below launch price. European, Japanese and most other prices include VAT; US and Canada prices don't include sales tax.
      </p>
    </div>
  );
}

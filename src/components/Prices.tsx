import { useEffect, useMemo, useState } from 'react';
import { convert, loadRates, type Currency, type Rates } from '../lib/fx';
import type { AppData } from '../lib/useData';
import type { Category, PricePoint, Region } from '../lib/types';
import { COUNTRIES, COUNTRY_CODES, CURRENCIES, GROUPS, type CountryCode } from '../lib/regions';
import { CatBadge, DirBadge, Sparkline } from './Common';
import { REGION_LABEL, fmtDate, fmtPct, money, pct } from '../lib/format';

const shortDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.slice(0, 4) === String(new Date().getFullYear()) ? {} : { year: 'numeric' }) });

const CAT_ORDER = ['GPU', 'CPU', 'RAM', 'Other'];
const ORDER = COUNTRY_CODES as string[];

export function Prices({ data }: { data: AppData }) {
  const [cat, setCat] = useState<Category | 'All'>('All');
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

  const series = useMemo(() => {
    const m = new Map<string, PricePoint[]>();
    for (const p of data.prices) {
      if (cat !== 'All' && p.category !== cat) continue;
      if (!(regions as Region[]).includes(p.region)) continue;
      const k = `${p.model}|${p.region}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return [...m.values()].sort(
      (a, b) =>
        CAT_ORDER.indexOf(a[0].category) - CAT_ORDER.indexOf(b[0].category) ||
        a[0].model.localeCompare(b[0].model) ||
        ORDER.indexOf(a[0].region) - ORDER.indexOf(b[0].region),
    );
  }, [data.prices, cat, regions.join()]);

  const withData = new Set(data.prices.map((p) => p.region));
  const missing = regions.filter((r) => !series.some((s) => s[0].region === r));

  return (
    <div className="page">
      <div className="section-head">
        <h1>Price tracker</h1>
        <span className="muted small">Lowest in-stock prices from the recaps. Pick countries to compare; your choice is remembered.</span>
      </div>
      <div className="toolbar">
        <div className="tabs">
          {(['All', 'GPU', 'CPU', 'RAM'] as const).map((c) => (
            <button key={c} className={c === cat ? 'tab active' : 'tab'} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
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
      <table className="ptable">
        <thead>
          <tr>
            <th>Product</th>
            {regions.length > 1 && <th>Market</th>}
            <th>Latest</th>
            <th>vs MSRP</th>
            <th>Change</th>
            <th>History</th>
            <th>As of</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => {
            const last = s[s.length - 1];
            const prev = s.length > 1 ? s[s.length - 2] : undefined;
            const ch = prev ? pct(prev.price, last.price) : 0;
            const msrp = s.find((p) => p.msrp)?.msrp;
            return (
              <tr key={`${last.model}|${last.region}`}>
                <td>
                  <CatBadge c={last.category} /> {last.model}
                </td>
                {regions.length > 1 && <td>{REGION_LABEL[last.region]}</td>}
                <td className="num">
                  {(() => {
                    const c = shown(last.price, last.currency);
                    return c === null ? (
                      money(last.price, last.currency)
                    ) : (
                      <>
                        {money(c, target as string)}
                        <div className="muted small">{money(last.price, last.currency)}</div>
                      </>
                    );
                  })()}
                </td>
                <td className="num">{msrp ? <span className={last.price > msrp ? 'neg' : 'pos'}>{fmtPct(pct(msrp, last.price))}</span> : <span className="muted">–</span>}</td>
                <td>{prev ? <DirBadge d={ch < -0.5 ? 'down' : ch > 0.5 ? 'up' : 'flat'} text={fmtPct(ch)} /> : <span className="muted small">1 point</span>}</td>
                <td>
                  <Sparkline values={s.map((p) => p.price)} />
                </td>
                <td className="muted small" title={last.source}>
                  {shortDate(last.date)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!series.length && <p className="muted">No prices for this filter yet.</p>}
      <p className="muted small">
        "Change" compares the two most recent data points. Green on "vs MSRP" means below launch price. European, Japanese and most other prices include VAT; US and Canada prices don't include sales tax.
      </p>
    </div>
  );
}

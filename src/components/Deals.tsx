import { useEffect, useMemo, useState } from 'react';
import type { AppData } from '../lib/useData';
import { BENCH_NOTE, benchList, marketRate, usedRange, type BenchItem, type Kind } from '../lib/bench';
import { convert, loadRates, type Rates } from '../lib/fx';
import { money } from '../lib/format';
import { COUNTRIES, CURRENCIES } from '../lib/regions';

// Prices outside the US include sales tax / VAT; US prices (and launch prices) don't.
const TAX: Record<string, number> = { USD: 1, CAD: 1, BRL: 1, EUR: 1.21, GBP: 1.2, PLN: 1.23, JPY: 1.1, KRW: 1.1, TWD: 1.05, CNY: 1.13, INR: 1.18, AUD: 1.1 };
const norm = (s: string) => s.toLowerCase().replace(/^(nvidia |amd |intel )/, '').replace(/^(geforce |radeon )/, '').replace(/[^a-z0-9]+/g, '');

function useRates(data: AppData) {
  const [fx, setFx] = useState<Rates | null>(null);
  useEffect(() => {
    loadRates(data.settings.fxRates).then(setFx).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return fx;
}

function defaultCurrency(data: AppData): string {
  const r = data.settings.priceRegions?.[0];
  return COUNTRIES.find((c) => c.code === r)?.currency ?? 'USD';
}

/** Latest recorded US price of a part (USD, before tax), if we track it. */
function usPrice(data: AppData, b: BenchItem): number | undefined {
  const n = norm(b.name);
  const pts = data.prices.filter((p) => p.region === 'US' && p.currency === 'USD' && norm(p.model) === n).sort((a, c) => a.date.localeCompare(c.date));
  return pts[pts.length - 1]?.price;
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} className={value === v ? 'seg-btn on' : 'seg-btn'} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function PartSelect({ kind, value, onChange }: { kind: Kind; value: string; onChange: (v: string) => void }) {
  const list = [...benchList(kind)].sort((a, b) => b.score - a.score);
  return (
    <select className="select deal-part" value={value} onChange={(e) => onChange(e.target.value)}>
      {list.map((b) => (
        <option key={b.name} value={b.name}>
          {b.name}
        </option>
      ))}
    </select>
  );
}

type Verdict = { label: string; cls: string; icon: string };
function verdictFor(ratio: number): Verdict {
  if (ratio <= 0.85) return { label: 'Great deal', cls: 'v-great', icon: '🟢' };
  if (ratio <= 1.0) return { label: 'Good price', cls: 'v-good', icon: '🟢' };
  if (ratio <= 1.15) return { label: 'Fair, but not a bargain', cls: 'v-fair', icon: '🟡' };
  return { label: 'Overpriced', cls: 'v-bad', icon: '🔴' };
}

export function DealChecker({ data }: { data: AppData }) {
  const fx = useRates(data);
  const [kind, setKind] = useState<Kind>('gpu');
  const [part, setPart] = useState('GeForce RTX 5070');
  const [cond, setCond] = useState<'new' | 'used'>('new');
  const [price, setPrice] = useState('');
  const [cur, setCur] = useState(() => defaultCurrency(data));

  const b = benchList(kind).find((x) => x.name === part) ?? benchList(kind)[0];
  const rate = useMemo(() => marketRate(kind, (x) => usPrice(data, x)), [kind, data]);
  const amount = Number(price.replace(',', '.'));
  const tax = cond === 'new' ? TAX[cur] ?? 1 : 1; // private used sales don't add VAT
  const toUsd = (v: number) => (cur === 'USD' ? v : fx ? convert(v, cur, 'USD', fx) : null);
  const fromUsd = (v: number) => (cur === 'USD' ? v : fx ? convert(v, 'USD', cur, fx) : null);
  const local = (usd: number) => {
    const v = fromUsd(usd * tax);
    return v === null ? money(Math.round(usd), 'USD', true) : money(Math.round(v), cur, true);
  };

  const result = useMemo(() => {
    if (!amount || amount <= 0 || !b) return null;
    const usd = toUsd(amount);
    if (usd === null) return null;
    const pre = usd / tax; // comparable with US prices
    const value = b.score * rate; // what the same performance costs from the better-value parts on sale
    const current = new Date().getFullYear() - b.year <= 2;
    const now = usPrice(data, b);
    // Parts still on sale: judge against today's going price (or launch price). Older parts: against value for money.
    const fairNew = current ? now ?? b.msrp ?? value : value;
    const used = usedRange(b, rate, usPrice(data, b));
    const fair = cond === 'new' ? fairNew : used.mid;
    const ratio = pre / fair;
    const lines: string[] = [];
    if (cond === 'new') {
      if (current) lines.push(`It usually sells for about ${local(fairNew)} new right now${now ? ' (latest US price we recorded, plus local tax)' : ' (its launch price)'}.`);
      lines.push(`The same performance from the better-value ${kind === 'gpu' ? 'cards' : 'processors'} on sale costs about ${local(value)}.`);
      if (b.msrp) {
        const d = Math.round((pre / b.msrp - 1) * 100);
        lines.push(d > 0 ? `${d}% above its launch price of ${local(b.msrp)}.` : d < 0 ? `${-d}% below its launch price of ${local(b.msrp)}.` : `Exactly its launch price of ${local(b.msrp)}.`);
      }
    } else {
      lines.push(`A fair used price is about ${local(used.low)} to ${local(used.high)}${used.note ? ` (${used.note})` : ''}.`);
      lines.push('Ask how it was used (mining or heavy overclocking wears parts faster), test it before you pay, and check whether any warranty is left.');
    }
    if (tax > 1) lines.push(`Prices in ${cur} include about ${Math.round((tax - 1) * 100)}% VAT; we take that off before comparing with US prices.`);
    // Better options for the same money.
    const better = benchList(kind)
      .filter((x) => x.name !== b.name && x.score >= b.score * 0.97)
      .map((x) => ({ x, p: cond === 'new' ? usPrice(data, x) ?? x.msrp : usedRange(x, rate, usPrice(data, x)).mid }))
      .filter((o): o is { x: BenchItem; p: number } => !!o.p && o.p < pre * 0.95 && (cond === 'used' || o.x.year >= new Date().getFullYear() - 3))
      .sort((a, c) => a.p / a.x.score - c.p / c.x.score)
      .slice(0, 3);
    return { v: verdictFor(ratio), lines, better, diff: Math.round((ratio - 1) * 100) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, b, rate, cond, cur, fx, data]);

  return (
    <div className="deal">
      <p className="muted small">Found an offer? Pick the part, type the price, and see if it's worth it.</p>
      <div className="card deal-form">
        <div className="deal-row">
          <Seg
            value={kind}
            options={[
              ['gpu', 'Graphics card'],
              ['cpu', 'Processor'],
            ]}
            onChange={(k) => {
              setKind(k);
              setPart(k === 'gpu' ? 'GeForce RTX 5070' : 'Ryzen 7 7800X3D');
            }}
          />
          <Seg
            value={cond}
            options={[
              ['new', 'New'],
              ['used', 'Used'],
            ]}
            onChange={setCond}
          />
        </div>
        <div className="deal-row">
          <PartSelect kind={kind} value={b.name} onChange={setPart} />
        </div>
        <div className="deal-row">
          <input className="search deal-price" inputMode="decimal" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ''))} />
          <select className="select" value={cur} onChange={(e) => setCur(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {!amount && <p className="muted small">Type the price you were offered.</p>}
      {amount > 0 && !result && <p className="muted small">Loading exchange rates…</p>}
      {result && (
        <div className={`card deal-result ${result.v.cls}`}>
          <div className="deal-verdict">
            {result.v.icon} {result.v.label}
            <span className="muted small">
              {' '}
              · {result.diff > 0 ? `${result.diff}% above` : result.diff < 0 ? `${-result.diff}% below` : 'right at'} a fair {cond === 'new' ? 'new' : 'used'} price
            </span>
          </div>
          <ul className="buy-reasons">
            {result.lines.map((l) => (
              <li key={l} className="r-info">
                <span>ⓘ</span> {l}
              </li>
            ))}
          </ul>
          {result.better.length > 0 && (
            <>
              <h4 className="deal-sub">As fast or faster for less {cond === 'used' ? '(used)' : '(new)'}</h4>
              <ul className="buy-reasons">
                {result.better.map(({ x, p }) => (
                  <li key={x.name} className="r-buy">
                    <span>＋</span> {x.name}: {Math.round((x.score / b.score) * 100)}% of the speed for about {local(p)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <p className="muted small">{BENCH_NOTE} This is a guide, not financial advice.</p>
    </div>
  );
}

export function UsedPrices({ data }: { data: AppData }) {
  const fx = useRates(data);
  const [kind, setKind] = useState<Kind>('gpu');
  const [cur, setCur] = useState(() => defaultCurrency(data));
  const [q, setQ] = useState('');
  const rate = useMemo(() => marketRate(kind, (x) => usPrice(data, x)), [kind, data]);
  const show = (usd: number) => {
    const v = cur === 'USD' ? usd : fx ? convert(usd, 'USD', cur, fx) : null;
    return v === null ? money(Math.round(usd), 'USD', true) : money(Math.round(v), cur, true);
  };
  const now = new Date().getFullYear();
  const rows = benchList(kind)
    .filter((b) => b.year <= now - 1)
    .filter((b) => q.toLowerCase().split(/\s+/).every((w) => b.name.toLowerCase().includes(w)))
    .sort((a, b) => b.score - a.score);
  const top = Math.max(...benchList(kind).map((b) => b.score));

  return (
    <div className="used">
      <p className="muted small">
        What a used {kind === 'gpu' ? 'graphics card' : 'processor'} is fairly worth today: the price of the same performance new, minus a used discount for no warranty, age and older features. Use it before you buy or sell second-hand.
      </p>
      <div className="deal-row">
        <Seg
          value={kind}
          options={[
            ['gpu', 'Graphics cards'],
            ['cpu', 'Processors'],
          ]}
          onChange={setKind}
        />
        <select className="select" value={cur} onChange={(e) => setCur(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input className="search used-search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card used-list">
        {rows.map((b) => {
          const r = usedRange(b, rate, usPrice(data, b));
          return (
            <div key={b.name} className="used-row">
              <div className="used-name">
                <strong>{b.name}</strong>
                <span className="muted small">
                  {b.year}
                  {b.vram ? ` · ${b.vram} GB` : ''}
                  {b.cores ? ` · ${b.cores} cores` : ''}
                  {b.msrp ? ` · launched at ${money(b.msrp, 'USD', true)}` : ''}
                </span>
                <div className="bench-bar small-bar">
                  <div style={{ width: `${(b.score / top) * 100}%` }} />
                </div>
              </div>
              <div className="used-price">
                <strong>
                  {show(r.low)} – {show(r.high)}
                </strong>
                {r.note && <span className="muted small">{r.note}</span>}
              </div>
            </div>
          );
        })}
        {!rows.length && <p className="muted">Nothing matches.</p>}
      </div>
      <p className="muted small">
        Estimates for private sales (no VAT added). Prices in shops and on eBay vary with condition, region and demand; check what similar listings actually sold for. {BENCH_NOTE}
      </p>
    </div>
  );
}

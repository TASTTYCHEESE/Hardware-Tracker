import { useEffect, useMemo, useState } from 'react';
import type { AppData } from '../lib/useData';
import { BENCH_NOTE, benchList, marketRate, usedRange, type BenchItem, type Kind } from '../lib/bench';
import { convert, loadRates, type Rates } from '../lib/fx';
import { money } from '../lib/format';
import { COUNTRIES, CURRENCIES } from '../lib/regions';
import { USED_PARTS, USED_TIPS, usedPartRange, type UsedKind } from '../lib/used';
import { readListing, priceInText, type Listing, type PartKind, type PartRef } from '../lib/listing';

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

const KIND_LABEL: Record<PartKind, string> = {
  gpu: 'Graphics cards',
  cpu: 'Processors',
  ram: 'RAM',
  ssd: 'SSDs',
  board: 'Motherboards',
  psu: 'Power supplies',
  case: 'Cases',
};
const KINDS = Object.keys(KIND_LABEL) as PartKind[];
const BGN_PER_EUR = 1.95583;

/** Fair used value (USD, no tax) of any part, with a short note. */
function fairUsed(data: AppData, ref: PartRef, rates: Record<'gpu' | 'cpu', number>): { low: number; high: number; mid: number; note: string } | null {
  if (ref.kind === 'gpu' || ref.kind === 'cpu') {
    const b = benchList(ref.kind).find((x) => x.name === ref.name);
    return b ? usedRange(b, rates[ref.kind], usPrice(data, b)) : null;
  }
  const p = USED_PARTS[ref.kind].find((x) => x.name === ref.name);
  if (!p) return null;
  const latest = p.tracked ? latestUs(data, p.tracked) : undefined;
  return { ...usedPartRange(p, latest), note: '' };
}

function latestUs(data: AppData, model: string): number | undefined {
  const pts = data.prices.filter((x) => x.region === 'US' && x.currency === 'USD' && x.model === model).sort((a, c) => a.date.localeCompare(c.date));
  return pts[pts.length - 1]?.price;
}

function PartPicker({ value, onChange }: { value: PartRef | null; onChange: (r: PartRef) => void }) {
  return (
    <select
      className="select deal-part"
      value={value ? `${value.kind}|${value.name}` : ''}
      onChange={(e) => {
        const [kind, ...rest] = e.target.value.split('|');
        onChange({ kind: kind as PartKind, name: rest.join('|') });
      }}
    >
      {!value && <option value="">Pick the part…</option>}
      {KINDS.map((k) => (
        <optgroup key={k} label={KIND_LABEL[k]}>
          {(k === 'gpu' || k === 'cpu' ? [...benchList(k)].sort((a, b) => b.score - a.score) : USED_PARTS[k]).map((x) => (
            <option key={x.name} value={`${k}|${x.name}`}>
              {x.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Paste a link to a used part (eBay, OLX, Bazar.bg, a shop...) or type it in, and get a verdict. */
function ListingCheck({ data, fx, rates }: { data: AppData; fx: Rates | null; rates: Record<'gpu' | 'cpu', number> }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const [part, setPart] = useState<PartRef | null>(null);
  const [price, setPrice] = useState('');
  const [cur, setCur] = useState(() => defaultCurrency(data));

  const check = async () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return;
    setBusy(true);
    const l = await readListing(u);
    setBusy(false);
    setListing(l);
    if (l.part) setPart(l.part);
    if (l.price) setPrice(String(l.price));
    if (l.currency && ((CURRENCIES as string[]).includes(l.currency) || l.currency === 'BGN')) setCur(l.currency);
  };

  const amount = Number(price.replace(',', '.'));
  const fair = part ? fairUsed(data, part, rates) : null;
  let usd: number | null = null;
  if (amount > 0) {
    const a = cur === 'BGN' ? amount / BGN_PER_EUR : amount;
    const c = cur === 'BGN' ? 'EUR' : cur;
    usd = c === 'USD' ? a : fx ? convert(a, c, 'USD', fx) : null;
  }
  const show = (v: number) => {
    const c = cur === 'BGN' ? 'EUR' : cur;
    const x = c === 'USD' ? v : fx ? convert(v, 'USD', c, fx) : null;
    return x === null ? money(Math.round(v), 'USD', true) : money(Math.round(x), c, true);
  };
  const v = fair && usd ? verdictFor(usd / fair.mid) : null;
  const diff = fair && usd ? Math.round((usd / fair.mid - 1) * 100) : 0;
  const kind = part?.kind;

  return (
    <div className="card deal-form listing-check">
      <h3>Check a used listing</h3>
      <p className="muted small">Paste a link to an ad or shop page (eBay, OLX, Bazar.bg, Facebook Marketplace, a shop…). The app reads the part and the price; fix them below if it guessed wrong, or just pick the part and type the price.</p>
      <div className="deal-row">
        <input className="search listing-url" inputMode="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && check()} />
        <button className="btn" onClick={check} disabled={busy || !/^https?:\/\//i.test(url.trim())}>
          {busy ? 'Reading…' : 'Check'}
        </button>
      </div>
      {listing && (
        <div className="listing-found small">
          {listing.title ? (
            <a href={listing.url} target="_blank" rel="noreferrer" translate="no">
              {listing.title}
            </a>
          ) : (
            <span className="muted">
              {listing.error
                ? api_hint()
                : "Couldn't find a title on that page."}
            </span>
          )}
          {listing.title && !listing.price && <span className="muted"> · no price found on the page, type it below</span>}
          {!listing.part && <span className="muted"> · pick the part below</span>}
        </div>
      )}
      <div className="deal-row">
        <PartPicker value={part} onChange={setPart} />
      </div>
      <div className="deal-row">
        <input
          className="search deal-price"
          inputMode="decimal"
          placeholder="Asking price"
          value={price}
          onChange={(e) => {
            const t = e.target.value;
            const found = /[^\d.,\s]/.test(t) ? priceInText(t) : null; // pasted "450 лв." etc.
            if (found?.price) {
              setPrice(String(found.price));
              if (found.currency) setCur(found.currency);
            } else setPrice(t.replace(/[^0-9.,]/g, ''));
          }}
        />
        <select className="select" value={cur} onChange={(e) => setCur(e.target.value)}>
          {[...CURRENCIES, 'BGN'].map((c) => (
            <option key={c} value={c}>
              {c === 'BGN' ? 'BGN (лв.)' : c}
            </option>
          ))}
        </select>
      </div>
      {fair && (
        <p className="muted small">
          Fair used price: <strong>{show(fair.low)} – {show(fair.high)}</strong>
          {fair.note ? ` (${fair.note})` : ''}
        </p>
      )}
      {v && fair && (
        <div className={`deal-result ${v.cls}`}>
          <div className="deal-verdict">
            {v.icon} {v.cls === 'v-bad' ? 'Not worth it at this price' : v.cls === 'v-fair' ? 'OK, but try to haggle' : 'Worth buying'}
            <span className="muted small">
              {' '}
              · {diff > 0 ? `${diff}% above` : diff < 0 ? `${-diff}% below` : 'right at'} a fair used price
            </span>
          </div>
          {v.cls === 'v-bad' && <p className="small">Offer around {show(fair.mid)}, or look for another listing.</p>}
          {v.cls === 'v-fair' && <p className="small">A fair offer would be about {show(fair.mid)}.</p>}
          {(v.cls === 'v-great' || v.cls === 'v-good') && diff < -40 && <p className="small">Much cheaper than usual: make sure it's real (no "shipping only" scams) and test it before paying.</p>}
          {kind && kind !== 'gpu' && kind !== 'cpu' && <p className="muted small">{USED_TIPS[kind as UsedKind]}</p>}
          {(kind === 'gpu' || kind === 'cpu') && <p className="muted small">Ask how it was used (mining or heavy overclocking wears parts faster), test it before you pay, and check whether any warranty is left.</p>}
        </div>
      )}
    </div>
  );
}

function api_hint() {
  return "Couldn't open that page (the site blocks apps or needs a login). Pick the part and type the price instead.";
}

export function UsedPrices({ data }: { data: AppData }) {
  const fx = useRates(data);
  const [kind, setKind] = useState<PartKind>('gpu');
  const [cur, setCur] = useState(() => defaultCurrency(data));
  const [q, setQ] = useState('');
  const rates = useMemo(() => ({ gpu: marketRate('gpu', (x) => usPrice(data, x)), cpu: marketRate('cpu', (x) => usPrice(data, x)) }), [data]);
  const show = (usd: number) => {
    const v = cur === 'USD' ? usd : fx ? convert(usd, 'USD', cur, fx) : null;
    return v === null ? money(Math.round(usd), 'USD', true) : money(Math.round(v), cur, true);
  };
  const now = new Date().getFullYear();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (name: string) => words.every((w) => name.toLowerCase().includes(w));

  return (
    <div className="used">
      <ListingCheck data={data} fx={fx} rates={rates} />
      <h3 className="used-h">Fair used prices</h3>
      <p className="muted small">What a used part is fairly worth today: its price new now, minus a used discount for no warranty, wear and age. Use it before you buy or sell second-hand.</p>
      <div className="seg used-kinds">
        {KINDS.map((k) => (
          <button key={k} className={kind === k ? 'seg-btn on' : 'seg-btn'} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="deal-row">
        <select className="select" value={cur} onChange={(e) => setCur(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input className="search used-search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {kind !== 'gpu' && kind !== 'cpu' && <p className="muted small used-tip">ⓘ {USED_TIPS[kind]}</p>}
      <div className="card used-list">
        {(kind === 'gpu' || kind === 'cpu') &&
          (() => {
            const top = Math.max(...benchList(kind).map((b) => b.score));
            const rows = benchList(kind)
              .filter((b) => b.year <= now - 1 && hit(b.name))
              .sort((a, b) => b.score - a.score);
            if (!rows.length) return <p className="muted">Nothing matches.</p>;
            return rows.map((b) => {
              const r = usedRange(b, rates[kind], usPrice(data, b));
              return (
                <div key={b.name} className="used-row">
                  <div className="used-name">
                    <strong translate="no">{b.name}</strong>
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
            });
          })()}
        {kind !== 'gpu' &&
          kind !== 'cpu' &&
          (() => {
            const parts = USED_PARTS[kind].filter((p) => hit(p.name) || hit(p.group));
            if (!parts.length) return <p className="muted">Nothing matches.</p>;
            return parts.map((p, i) => {
              const latest = p.tracked ? latestUs(data, p.tracked) : undefined;
              const r = usedPartRange(p, latest);
              return (
                <div key={p.name}>
                  {(i === 0 || parts[i - 1].group !== p.group) && <div className="used-group muted small">{p.group}</div>}
                  <div className="used-row">
                    <div className="used-name">
                      <strong>{p.name}</strong>
                      <span className="muted small">
                        New now: about {show(r.newUsd)}
                        {latest ? ' (latest US price we recorded)' : ''}
                      </span>
                    </div>
                    <div className="used-price">
                      <strong>
                        {show(r.low)} – {show(r.high)}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
      </div>
      <p className="muted small">
        Estimates for private sales (no VAT added), based on new prices in November 2026. Prices vary with condition, region and demand; check what similar listings actually sold for. {kind === 'gpu' || kind === 'cpu' ? BENCH_NOTE : ''}
      </p>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/platform';
import type { AppData } from '../lib/useData';
import type { CatalogCategory, CatalogIndex, CatalogItem } from '../lib/catalog';
import { familyOf } from '../lib/family';
import { countdown, launchTime, useLaunches, type Launch } from '../lib/launches';
import { perfFor } from '../lib/perf';
import { money, REGION_LABEL } from '../lib/format';
import { loadCategory } from './Compare';
import { modelName } from './PriceProducts';
import type { Category, Region } from '../lib/types';

type Group = 'hardware' | 'peripherals';
type Tone = 'buy' | 'wait' | 'info';
interface Signal {
  tone: Tone;
  text: string;
}

const PRICE_CAT: Record<string, Category> = { gpu: 'GPU', cpu: 'CPU', memory: 'RAM' };
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Reasons to buy now or wait, from prices, the market trend, newer models, upcoming launches and the news. */
function signalsFor(data: AppData, cat: CatalogCategory, item: CatalogItem, launches: Launch[]): Signal[] {
  const out: Signal[] = [];
  const pc = PRICE_CAT[cat.id];
  const region = (data.settings.priceRegions?.[0] ?? 'US') as Region;
  const now = Date.now();
  const base = item.kind === 'Retail card' && typeof item.chip_id === 'string' ? cat.items.find((i) => i.id === item.chip_id) ?? item : item;

  // 1. Its own price history.
  if (pc === 'GPU' || pc === 'CPU') {
    const m = key(modelName(base));
    const pts = data.prices.filter((p) => p.category === pc && key(p.model) === m && p.region === region);
    const perf = perfFor(modelName(base), pc);
    if (pts.length) {
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      const low = Math.min(...pts.map((p) => p.price));
      const msrp = last.msrp ?? (last.currency === 'USD' ? perf?.msrp : undefined);
      if (pts.length > 1 && last.price <= low * 1.03) out.push({ tone: 'buy', text: `At the lowest price we've recorded in ${REGION_LABEL[region]}: ${money(last.price, last.currency)}.` });
      else if (pts.length > 1) out.push({ tone: 'wait', text: `${money(last.price, last.currency)} now, but it was ${money(low, last.currency)} before in ${REGION_LABEL[region]}.` });
      if (msrp) {
        const over = Math.round((last.price / msrp - 1) * 100);
        if (over >= 20) out.push({ tone: 'wait', text: `${over}% above its launch price (${money(msrp, last.currency)}).` });
        else if (over <= 0) out.push({ tone: 'buy', text: `At or below its launch price (${money(msrp, last.currency)}).` });
      }
      if (prev && last.price < prev.price * 0.97) out.push({ tone: 'wait', text: `The price is falling (${Math.round((last.price / prev.price - 1) * 100)}% since ${prev.date}); it may keep dropping.` });
      if (prev && last.price > prev.price * 1.03) out.push({ tone: 'buy', text: `The price went up ${Math.round((last.price / prev.price - 1) * 100)}% since ${prev.date}; waiting may cost more.` });
    } else {
      out.push({ tone: 'info', text: `No weekly price for it in ${REGION_LABEL[region]} yet. Add it in Prices → "+ Add products" to start tracking.` });
    }
  }

  // 2. The market for the whole category.
  if (pc) {
    const recap = data.recaps.find((r) => r.trends?.some((t) => t.category === pc));
    const t = recap?.trends?.find((x) => x.category === pc && x.region === region) ?? recap?.trends?.find((x) => x.category === pc && (x.region === 'Global' || x.region === 'US'));
    if (t) {
      const where = REGION_LABEL[t.region as Region] ?? t.region;
      if (t.direction === 'up') out.push({ tone: 'buy', text: `${pc === 'RAM' ? 'Memory' : `${pc}`} prices are rising in ${where}${t.change ? ` (${t.change})` : ''}.` });
      if (t.direction === 'down') out.push({ tone: 'wait', text: `${pc === 'RAM' ? 'Memory' : `${pc}`} prices are falling in ${where}${t.change ? ` (${t.change})` : ''}.` });
      if (t.direction === 'flat') out.push({ tone: 'info', text: `${pc === 'RAM' ? 'Memory' : `${pc}`} prices are flat in ${where}.` });
    }
  }

  // 3. Newer models.
  const fam = familyOf(base, cat.items, cat.id);
  const newer = fam.filter((f) => (f.year ?? 0) > (base.year ?? 0));
  if (newer.length) {
    const n = newer[newer.length - 1];
    out.push({ tone: 'wait', text: `A newer model in the same tier exists: ${n.name} (${n.year}). Compare before buying.` });
  } else if (fam.length > 1) {
    out.push({ tone: 'buy', text: `It's the newest model in its tier.` });
  } else if (base.year) {
    const age = new Date().getFullYear() - base.year;
    if (age >= 4) out.push({ tone: 'info', text: `Released in ${base.year} (${age} years ago); newer models may do more for the money.` });
  }

  // 4. Launch calendar.
  const pcat = pc ?? '';
  const mk = String(base.maker ?? '').toLowerCase();
  let saleShown = false;
  for (const l of launches) {
    const sameCat = l.category === pcat;
    const sameMaker = !l.maker || mk.includes(l.maker.toLowerCase()) || l.maker.toLowerCase().includes(mk);
    const t = launchTime(l.date);
    if (!saleShown && /black friday|cyber monday/i.test(l.title) && t > now - 864e5 && t - now < 10 * 864e5 && (saleShown = true))
      out.push({ tone: 'wait', text: `${l.title} ${countdown(l.date, now)}: worth checking for a deal first.` });
    if (!sameCat || !sameMaker) continue;
    if (l.status === 'cancelled') out.push({ tone: 'buy', text: `${l.title} was reportedly cancelled, so no replacement is coming soon.` });
    else if (t > now && t - now < 200 * 864e5 && l.status !== 'event')
      out.push({ tone: 'wait', text: `${l.title} is expected ${countdown(l.date, now)}${l.status === 'rumor' ? ' (rumor)' : ''}.` });
  }

  // 5. Headlines that mention it.
  const name = modelName(base);
  if (name.length >= 5) {
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'), 'i');
    for (const a of data.feed.articles.filter((x) => re.test(`${x.title} ${x.summary}`)).slice(0, 3)) {
      const t = `${a.title} ${a.summary}`;
      if (/price (hike|increase)|shortage|sold out|end of life|discontinu/i.test(t)) out.push({ tone: 'buy', text: `In the news: "${a.title}"` });
      else if (/price cut|discount|deal|drops? to|lowest/i.test(t)) out.push({ tone: 'wait', text: `In the news: "${a.title}"` });
    }
  }
  return out;
}

function verdict(sig: Signal[]) {
  const score = sig.reduce((n, s) => n + (s.tone === 'buy' ? 1 : s.tone === 'wait' ? -1 : 0), 0);
  const decisive = sig.filter((s) => s.tone !== 'info').length;
  if (!decisive) return { label: 'Not enough data yet', cls: 'v-none', icon: '•' };
  if (score >= 1) return { label: 'Good time to buy', cls: 'v-buy', icon: '🟢' };
  if (score <= -1) return { label: 'Better to wait', cls: 'v-wait', icon: '🔴' };
  return { label: 'Fair time: no strong reason either way', cls: 'v-fair', icon: '🟡' };
}

/** "Buy or wait?": pick anything you want to buy and get a verdict with reasons. */
export function BuyAdvisor({ data }: { data: AppData }) {
  const [index, setIndex] = useState<CatalogIndex | null>(null);
  const [group, setGroup] = useState<Group>('hardware');
  const [catId, setCatId] = useState('gpu');
  const [cat, setCat] = useState<CatalogCategory | null>(null);
  const [cats, setCats] = useState<Record<string, CatalogCategory>>({});
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const { entries: launches } = useLaunches();
  const list = data.settings.buyList ?? [];

  useEffect(() => {
    api.catalogIndex().then(setIndex).catch((e) => setErr(String(e.message || e)));
  }, []);
  useEffect(() => {
    setCat(null);
    loadCategory(catId).then(setCat).catch((e) => setErr(String(e.message || e)));
  }, [catId]);
  // Categories of everything on the list.
  useEffect(() => {
    for (const c of new Set(list.map((l) => l.cat)))
      if (!cats[c]) loadCategory(c).then((x) => setCats((m) => ({ ...m, [c]: x }))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.map((l) => l.cat).join()]);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!cat || !words.length) return [];
    return cat.items
      .filter((i) => words.every((w) => `${i.name} ${i.maker}`.toLowerCase().includes(w)))
      .sort((a, b) => ((a.pop_rank as number) ?? 1e9) - ((b.pop_rank as number) ?? 1e9) || (b.year ?? 0) - (a.year ?? 0))
      .slice(0, 8);
  }, [cat, q]);

  const groupCats = (index?.categories ?? []).filter((c) => c.group === group && c.count > 0).sort((a, b) => a.name.localeCompare(b.name));
  const save = (next: typeof list) => data.setSettings({ buyList: next });

  return (
    <div className="page">
      <div className="section-head">
        <h1>Buy or wait?</h1>
        <span className="muted small">Pick what you want to buy. The verdict looks at its price history, the market, newer models, upcoming launches and the news.</span>
      </div>
      {err && <p className="muted">{err}</p>}
      <div className="toolbar">
        <div className="tabs">
          {(['hardware', 'peripherals'] as Group[]).map((g) => (
            <button
              key={g}
              className={group === g ? 'tab active' : 'tab'}
              onClick={() => {
                setGroup(g);
                const first = (index?.categories ?? []).filter((c) => c.group === g && c.count > 0).sort((a, b) => a.name.localeCompare(b.name))[0];
                setCatId(g === 'hardware' ? 'gpu' : first?.id ?? catId);
              }}
            >
              {g === 'hardware' ? 'Hardware' : 'Peripherals'}
            </button>
          ))}
        </div>
        <select className="select" value={catId} onChange={(e) => setCatId(e.target.value)}>
          {groupCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="cmp-search">
          <input className="search" placeholder={cat ? `What do you want to buy? (search ${cat.name.toLowerCase()})` : 'Loading…'} value={q} onChange={(e) => setQ(e.target.value)} disabled={!cat} />
          {results.length > 0 && (
            <div className="cmp-results card">
              {results.map((r) => {
                const on = list.some((l) => l.cat === catId && l.id === r.id);
                return (
                  <button
                    key={r.id}
                    className={on ? 'add-row on' : 'add-row'}
                    onClick={() => {
                      if (!on) save([{ cat: catId, id: r.id, name: r.name }, ...list]);
                      setQ('');
                    }}
                  >
                    <span>
                      <strong>{r.name}</strong> <span className="muted small">{[r.maker, r.year, r.kind].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="small">{on ? '✓ On your list' : '+ Check it'}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {list.length > 0 && (
        <div className="row buy-tools">
          <span className="muted small">
            {list.length} on your list{list.some((l) => l.fav) ? ` · ${list.filter((l) => l.fav).length} ★ favorite` : ''}
          </span>
          {list.some((l) => !l.fav) && (
            <button className="btn small ghost" onClick={() => save(list.filter((l) => l.fav))} title="Removes everything except your ★ favorites">
              Clear{list.some((l) => l.fav) ? ' (keeps ★ favorites)' : ''}
            </button>
          )}
        </div>
      )}
      {!list.length && (
        <div className="card">
          <p>Search above for anything you're thinking of buying: a graphics card, a CPU, a monitor, a headset…</p>
          <p className="muted small">Your list is saved, and each verdict updates as new prices and news come in.</p>
        </div>
      )}
      <div className="buy-grid">
        {[...list.filter((l) => l.fav), ...list.filter((l) => !l.fav)].map((l) => {
          const c = cats[l.cat];
          const item = c?.items.find((i) => i.id === l.id);
          const sig = c && item ? signalsFor(data, c, item, launches) : [];
          const v = verdict(sig);
          return (
            <div key={`${l.cat}/${l.id}`} className={`card buy-card ${c && item ? v.cls : ''}`}>
              <div className="buy-head">
                <div>
                  <div className="muted small">{c?.name ?? l.cat}</div>
                  <strong>{l.name}</strong>
                </div>
                <span className="buy-btns">
                  <button
                    className={l.fav ? 'fav on' : 'fav'}
                    title={l.fav ? 'Unfavorite' : 'Favorite (Clear keeps it)'}
                    onClick={() => save(list.map((x) => (x.cat === l.cat && x.id === l.id ? { ...x, fav: !x.fav } : x)))}
                  >
                    {l.fav ? '★' : '☆'}
                  </button>
                  <button className="chip-x" title="Remove" onClick={() => save(list.filter((x) => !(x.cat === l.cat && x.id === l.id)))}>
                    ×
                  </button>
                </span>
              </div>
              {!c && <p className="muted small">Loading…</p>}
              {c && !item && <p className="muted small">This product isn't in the catalog any more.</p>}
              {c && item && (
                <>
                  <div className="buy-verdict">
                    {v.icon} {v.label}
                  </div>
                  <ul className="buy-reasons">
                    {sig.map((s, i) => (
                      <li key={i} className={`r-${s.tone}`}>
                        <span>{s.tone === 'buy' ? '＋' : s.tone === 'wait' ? '－' : 'ⓘ'}</span> {s.text}
                      </li>
                    ))}
                    {!sig.length && <li className="r-info">No price history, launches or news found for it yet.</li>}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="muted small">
        Prices come from the weekly recaps for your first country in the Price tracker. This is a guide, not financial advice: it can't see shop-specific deals.
      </p>
    </div>
  );
}

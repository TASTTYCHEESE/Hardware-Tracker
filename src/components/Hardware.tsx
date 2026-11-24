import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/platform';
import type { AppData } from '../lib/useData';
import { familyOf } from '../lib/family';
import { StickyTable } from './Common';
import {
  fmtBytes,
  formatValue,
  labelFor,
  specRows,
  type CatalogCategory,
  type CatalogIndex,
  type CatalogItem,
} from '../lib/catalog';

type Group = 'hardware' | 'peripherals';
type Sort = 'new' | 'old' | 'name' | 'maker' | 'popular' | 'unpopular' | 'used' | 'unused';

const simplify = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '');
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
/** Usage = latest Steam share, falling back to the all-time peak. */
const usage = (i: CatalogItem) => num(i.steam_share) ?? (num(i.steam_peak) !== undefined ? (num(i.steam_peak) as number) / 1000 : undefined);
const PAGE = 100;

/** Cache categories for this session so switching back and forth is instant. */
const memo = new Map<string, CatalogCategory>();

/** Search, filters and sort per category, so Back / Forward returns to the list as you left it. */
interface ViewState {
  q: string;
  maker: string;
  from: number;
  to: number;
  extra: Record<string, string>;
  sort: Sort;
}
const views = new Map<string, ViewState>();
/** Forget remembered searches and filters (clicking the menu you're already on starts fresh). */
export const resetHardwareViews = () => views.clear();

/** The open category and product live in the app's history, so back / forward buttons work. */
export function Hardware({
  group,
  cat: catId,
  item,
  navigate,
  data,
  onCompare,
}: {
  group: Group;
  cat: string | null;
  item: string | null;
  navigate: (cat: string | null, item: string | null, group?: Group) => void;
  data: AppData;
  onCompare: (cat: string, id: string) => void;
}) {
  const [index, setIndex] = useState<CatalogIndex | null>(null);
  const [error, setError] = useState('');

  const loadIndex = (force = false) => {
    setError('');
    api
      .catalogIndex(force)
      .then(setIndex)
      .catch((e) => setError(String(e.message || e)));
  };
  useEffect(() => loadIndex(), []);


  if (error && !index)
    return (
      <div className="page">
        <h1>PC Hardware</h1>
        <p className="muted">{error}</p>
        <button className="btn" onClick={() => loadIndex(true)}>
          Try again
        </button>
      </div>
    );
  if (!index) return <div className="page muted">Loading the hardware catalog…</div>;

  const cats = index.categories.filter((c) => c.group === group).sort((a, b) => a.name.localeCompare(b.name));
  const info = catId ? index.categories.find((c) => c.id === catId) : undefined;
  if (catId && info)
    return (
      <CategoryView
        key={catId}
        info={info}
        version={index.version}
        sel={item}
        setSel={(id) => navigate(catId, id)}
        data={data}
        onCompare={(id) => onCompare(catId, id)}
        back={() => navigate(null, null)}
        openOther={(cat, it) => {
          const g = index.categories.find((c) => c.id === cat)?.group;
          navigate(cat, it ?? null, g && g !== group ? g : undefined);
        }}
      />
    );

  const total = cats.reduce((n, c) => n + c.count, 0);
  return (
    <div className="page">
      <div className="section-head">
        <h1>{group === 'hardware' ? 'PC hardware' : 'Peripherals'}</h1>
        <span className="muted small">
          {total.toLocaleString()} products in {cats.length} categories · catalog updated {new Date(index.updated).toLocaleDateString()}
          {index.offline ? ' · offline copy' : ''}
        </span>
      </div>
      <div className="hw-grid">
        {cats.map((c) => (
          <button key={c.id} className={c.count ? 'hw-tile' : 'hw-tile empty'} onClick={() => navigate(c.id, null)}>
            <div className="hw-tile-top">
              <strong>{c.name}</strong>
              <span className="muted small">{c.count ? c.count.toLocaleString() : 'Coming soon'}</span>
            </div>
            <div className="muted small clamp">{c.description}</div>
            <div className="muted small hw-tile-meta">
              {c.years ? `${c.years[0]}–${c.years[1]}` : ''}
              {c.years && c.makers ? ' · ' : ''}
              {c.makers ? `${c.makers} ${c.makers === 1 ? 'brand' : 'brands'}` : ''}
            </div>
          </button>
        ))}
      </div>
      <p className="muted small">
        The catalog is rebuilt twice a week from open databases (TechPowerUp GPU database, PCPartPicker listings, Wikidata), and the app downloads
        new versions on its own. Categories marked "Coming soon" fill up as new products show up in the news.
      </p>
    </div>
  );
}

function CategoryView({
  info,
  version,
  sel,
  setSel,
  data,
  onCompare,
  back,
  openOther,
}: {
  info: CatalogIndex['categories'][number];
  version: string;
  sel: string | null;
  setSel: (id: string | null) => void;
  data: AppData;
  onCompare: (id: string) => void;
  back: () => void;
  openOther: (cat: string, item?: string) => void;
}) {
  const [cat, setCat] = useState<CatalogCategory | null>(memo.get(`${info.id}@${version}`) ?? null);
  const [error, setError] = useState('');
  const saved = views.get(info.id);
  // Favorites (starred products) are kept in settings, per category.
  const favs = useMemo(() => new Set(data.settings.favorites?.[info.id] ?? []), [data.settings.favorites, info.id]);
  const favMode = data.settings.favMode ?? 'top';
  const toggleFav = (id: string) => {
    const cur = data.settings.favorites ?? {};
    const list = cur[info.id] ?? [];
    data.setSettings({ favorites: { ...cur, [info.id]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] } });
  };
  const [q, setQ] = useState(saved?.q ?? '');
  const query = useDeferredValue(q);
  const [maker, setMaker] = useState(saved?.maker ?? '');
  const [from, setFrom] = useState(saved?.from ?? 0);
  const [to, setTo] = useState(saved?.to ?? 0);
  const [extra, setExtra] = useState<Record<string, string>>(saved?.extra ?? {});
  const [sort, setSort] = useState<Sort>(saved?.sort ?? (info.years ? 'new' : 'name'));
  useEffect(() => {
    views.set(info.id, { q, maker, from, to, extra, sort });
  }, [info.id, q, maker, from, to, extra, sort]);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    if (cat) return;
    api
      .catalogCategory(info.id)
      .then((c) => {
        memo.set(`${info.id}@${version}`, c);
        setCat(c);
      })
      .catch((e) => setError(String(e.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.id]);

  const years = useMemo(() => {
    const ys = (cat?.items ?? []).map((i) => i.year).filter((y): y is number => !!y);
    return ys.length ? [...new Set(ys)].sort((a, b) => a - b) : [];
  }, [cat]);

  // Values (with counts) for each filter dropdown.
  const options = useMemo(() => {
    const out: Record<string, [string, number][]> = {};
    if (!cat) return out;
    for (const key of cat.filters) {
      if (key === 'year') continue;
      const m = new Map<string, number>();
      for (const it of cat.items) {
        const v = it[key];
        if (v === undefined || v === null || v === '') continue;
        const s = String(v);
        m.set(s, (m.get(s) ?? 0) + 1);
      }
      if (m.size < 2) continue;
      const numeric = [...m.keys()].every((k) => /^[\d.]+$/.test(k));
      // Alphabetical (numbers in numeric order).
      out[key] = [...m.entries()].sort((a, b) => (numeric ? Number(a[0]) - Number(b[0]) : a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' })));
    }
    return out;
  }, [cat]);

  // Search: which items match the typed words, and how well (0 = exact name … 3 = matched another field).
  const textScore = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!cat || !words.length) return null;
    const q1 = simplify(query);
    const score = new Map<CatalogItem, number>();
    for (const it of cat.items) {
      const name = it.name.toLowerCase();
      const sname = simplify(it.name);
      const inName = words.every((w) => name.includes(w)) || sname.includes(q1);
      if (!inName) {
        const hay = `${name} ${it.maker} ${Object.values(it).filter((x) => typeof x === 'string').join(' ')}`.toLowerCase();
        if (!words.every((w) => hay.includes(w)) && !simplify(hay).includes(q1)) continue;
      }
      score.set(it, sname === q1 ? 0 : sname.startsWith(q1) || name.startsWith(words[0]) ? 1 : inName ? 2 : 3);
    }
    return score;
  }, [cat, query]);

  /** Does an item pass every filter, optionally ignoring one (for that filter's own counts)? */
  const passes = (it: CatalogItem, skip?: string) => {
    if (textScore && !textScore.has(it)) return false;
    if (skip !== 'maker' && maker && it.maker !== maker) return false;
    if (skip !== 'year' && from && (!it.year || it.year < from)) return false;
    if (skip !== 'year' && to && (!it.year || it.year > to)) return false;
    for (const [k, v] of Object.entries(extra)) if (k !== skip && v && String(it[k] ?? '') !== v) return false;
    return true;
  };

  // Live counts next to every filter value: how many items you'd get by picking it, given the search and the other filters.
  const counts = useMemo(() => {
    const out: Record<string, Map<string, number>> = {};
    if (!cat) return out;
    for (const key of [...Object.keys(options), 'year']) {
      const m = new Map<string, number>();
      for (const it of cat.items) {
        if (!passes(it, key)) continue;
        const v = it[key];
        if (v === undefined || v === null || v === '') continue;
        m.set(String(v), (m.get(String(v)) ?? 0) + 1);
      }
      out[key] = m;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, options, textScore, maker, from, to, extra]);

  /** Items between two years (inclusive), given the search and the other filters. */
  const yearCount = (a: number, b: number) => {
    let n = 0;
    for (const [y, c] of counts.year ?? []) if (Number(y) >= a && Number(y) <= b) n += c;
    return n;
  };

  const filtered = useMemo(() => {
    if (!cat) return [];
    // Search and filters must both match. The search decides the order: best name matches first.
    const score = textScore ?? new Map<CatalogItem, number>();
    const list = cat.items.filter((it) => passes(it) && (favMode !== 'only' || favs.has(it.id)));
    // Items without data go last in every direction.
    const ranked = (v: (i: CatalogItem) => number | undefined, dir: 1 | -1) => (a: CatalogItem, b: CatalogItem) => {
      const x = v(a), y = v(b);
      if (x === undefined && y === undefined) return a.name.localeCompare(b.name);
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      return dir * (x - y) || a.name.localeCompare(b.name);
    };
    const by: Record<Sort, (a: CatalogItem, b: CatalogItem) => number> = {
      new: (a, b) => (b.date ?? String(b.year ?? '')).localeCompare(a.date ?? String(a.year ?? '')) || a.name.localeCompare(b.name),
      old: (a, b) => (a.year ?? 9999) - (b.year ?? 9999) || (a.date ?? '').localeCompare(b.date ?? '') || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      maker: (a, b) => a.maker.localeCompare(b.maker) || a.name.localeCompare(b.name),
      popular: ranked((i) => num(i.pop_rank), 1),
      unpopular: ranked((i) => num(i.pop_rank), -1),
      used: ranked(usage, -1),
      unused: ranked(usage, 1),
    };
    const cmp = by[sort];
    const pin = (i: CatalogItem) => (favMode === 'top' && favs.has(i.id) ? 0 : 1);
    return list.sort((a, b) => pin(a) - pin(b) || (score.get(a) ?? 0) - (score.get(b) ?? 0) || cmp(a, b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, textScore, maker, from, to, extra, sort, favs, favMode]);

  useEffect(() => setLimit(PAGE), [query, maker, from, to, extra, sort]);

  const selected = sel ? cat?.items.find((i) => i.id === sel) : undefined;
  // The search bar and filters stay at the top while scrolling; the product panel sits just below them.
  const stickyRef = useRef<HTMLDivElement>(null);
  const [stickyH, setStickyH] = useState(0);
  useLayoutEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStickyH(el.offsetHeight));
    ro.observe(el);
    setStickyH(el.offsetHeight);
    return () => ro.disconnect();
  }, [cat]);
  const cols = (cat?.fields ?? []).filter((f) => f.k !== 'date' && f.k !== 'color').slice(0, selected ? 2 : 4);
  const extraSelect = (k: string, vals: [string, number][]) =>
    cat && (
      <select key={k} className="select" value={extra[k] ?? ''} onChange={(e) => setExtra((x) => ({ ...x, [k]: e.target.value }))}>
        <option value="">{k === 'kind' ? 'All types' : `Any ${labelFor(cat, k).toLowerCase()}`}</option>
        {vals.slice(0, 1500).map(([v]) => (
          <option key={v} value={v}>
            {formatValue(isNaN(Number(v)) ? v : Number(v), cat.fields.find((f) => f.k === k)?.unit)} ({(counts[k]?.get(v) ?? 0).toLocaleString()})
          </option>
        ))}
      </select>
    );
  const filtersOn = !!(q || maker || from || to || Object.values(extra).some(Boolean));

  return (
    <div className="page hw-page">
      <div className="section-head">
        {!(cat && cat.items.length > 0) && (
          <button className="link small" onClick={back}>
            ← All categories
          </button>
        )}
        <h1>{info.name}</h1>
        <span className="muted small">
          {info.count.toLocaleString()} products
          {info.years ? ` · ${info.years[0]}–${info.years[1]}` : ''}
          {cat ? ` · source: ${cat.sources.map((s) => s.name).join(', ')}` : ''}
        </span>
      </div>

      {error && <p className="muted">{error}</p>}
      {!cat && !error && <p className="muted">Downloading {info.name.toLowerCase()} ({fmtBytes(info.bytes)})… This happens once; after that it works offline.</p>}

      {cat && cat.items.length === 0 && (
        <div className="card">
          <p>
            Nothing here yet. {cat.description} New products in this category are added as they appear in the daily news, and this page fills in on
            its own.
          </p>
        </div>
      )}

      {cat && cat.items.length > 0 && (
        <div style={{ ['--hw-sticky' as string]: `${stickyH}px` }}>
          <div className="hw-sticky" ref={stickyRef}>
          <button className="link small hw-back" onClick={back}>
            ← All categories
          </button>
          <div className="hw-filters">
            <input className="search" placeholder={`Search ${info.count.toLocaleString()} ${info.name.replace(/^[A-Z][a-z]/, (m) => m.toLowerCase())}…`} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            {options.kind && extraSelect('kind', options.kind)}
            {options.maker && (
              <select className="select" value={maker} onChange={(e) => setMaker(e.target.value)}>
                <option value="">All manufacturers</option>
                {options.maker.map(([m]) => (
                  <option key={m} value={m}>
                    {m} ({(counts.maker?.get(m) ?? 0).toLocaleString()})
                  </option>
                ))}
              </select>
            )}
            {years.length > 1 && (
              <span className="hw-years">
                <select className="select" value={from} onChange={(e) => setFrom(Number(e.target.value))} title="From year">
                  <option value={0}>From any year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      From {y} ({yearCount(y, to || 9999).toLocaleString()})
                    </option>
                  ))}
                </select>
                <select className="select" value={to} onChange={(e) => setTo(Number(e.target.value))} title="To year">
                  <option value={0}>To any year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      To {y} ({yearCount(from || 0, y).toLocaleString()})
                    </option>
                  ))}
                </select>
              </span>
            )}
            {Object.entries(options)
              .filter(([k]) => k !== 'maker' && k !== 'kind')
              .map(([k, vals]) => extraSelect(k, vals))}
            <select className="select" value={favMode} onChange={(e) => data.setSettings({ favMode: e.target.value as 'top' | 'only' | 'off' })} title="Favorites">
              <option value="top">★ Favorites first ({favs.size})</option>
              <option value="only">★ Only favorites ({favs.size})</option>
              <option value="off">Don't pin favorites</option>
            </select>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} title="Sort">
              {years.length > 0 && <option value="new">Newest first</option>}
              {years.length > 0 && <option value="old">Oldest first</option>}
              <option value="name">Name A–Z</option>
              <option value="maker">Manufacturer</option>
              {cat.sorts?.includes('popular') && <option value="popular">Most popular</option>}
              {cat.sorts?.includes('popular') && <option value="unpopular">Least popular</option>}
              {cat.sorts?.includes('used') && <option value="used">Most used</option>}
              {cat.sorts?.includes('used') && <option value="unused">Least used</option>}
            </select>
            {filtersOn && (
              <button
                className="link small"
                onClick={() => {
                  setQ('');
                  setMaker('');
                  setFrom(0);
                  setTo(0);
                  setExtra({});
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="muted small hw-count">
            {filtered.length.toLocaleString()} {filtered.length === 1 ? 'result' : 'results'}
            {cat.stale ? ' · offline copy, will update when you are back online' : ''}
            {cat.note ? ` · ${cat.note}` : ''}
          </div>
          </div>

          <div className={selected ? 'hw-split open' : 'hw-split'}>
            <div className="hw-list">
              <StickyTable top="var(--hw-sticky, 0px)">
<table className="ptable hw-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    {years.length > 0 && <th>Year</th>}
                    {cols.map((c) => (
                      <th key={c.k}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((it) => (
                    <tr key={it.id} className={it.id === sel ? 'hw-row on' : 'hw-row'} onClick={() => setSel(it.id === sel ? null : it.id)}>
                      <td className="hw-name">
                        <div>
                          <button
                            className={favs.has(it.id) ? 'fav on' : 'fav'}
                            title={favs.has(it.id) ? 'Remove from favorites' : 'Add to favorites'}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFav(it.id);
                            }}
                          >
                            {favs.has(it.id) ? '★' : '☆'}
                          </button>
                          {it.name}
                        </div>
                        <div className="muted small">
                          {it.maker}
                          {typeof it.chipset === 'string' && !it.name.toLowerCase().includes(it.chipset.toLowerCase()) ? ` · ${it.chipset}` : ''}
                        </div>
                      </td>
                      {years.length > 0 && <td className="muted">{it.year ?? '–'}</td>}
                      {cols.map((c) => (
                        <td key={c.k} className="nowrap">
                          {it[c.k] === undefined ? <span className="muted">–</span> : formatValue(it[c.k], c.unit)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              </StickyTable>
              {filtered.length > limit && (
                <button className="btn ghost hw-more" onClick={() => setLimit((l) => l + PAGE * 2)}>
                  Show more ({(filtered.length - limit).toLocaleString()} left)
                </button>
              )}
              {!filtered.length && (
                <div className="card hw-empty">
                  <p>
                    {q.trim()
                      ? `Nothing matches "${q.trim()}"${(maker || from || to || Object.values(extra).some(Boolean)) ? ' with the filters you have set' : ''}.`
                      : 'Nothing matches these filters.'}
                  </p>
                  {q.trim() && (maker || from || to || Object.values(extra).some(Boolean)) && (
                    <button
                      className="btn small"
                      onClick={() => {
                        setMaker('');
                        setFrom(0);
                        setTo(0);
                        setExtra({});
                      }}
                    >
                      Clear filters and keep the search
                    </button>
                  )}
                </div>
              )}
            </div>
            {selected && (
              <Detail
                cat={cat}
                item={selected}
                close={() => setSel(null)}
                select={setSel}
                openOther={openOther}
                fav={favs.has(selected.id)}
                toggleFav={() => toggleFav(selected.id)}
                compare={() => onCompare(selected.id)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({
  cat,
  item,
  close,
  select,
  openOther,
  fav,
  toggleFav,
  compare,
}: {
  cat: CatalogCategory;
  item: CatalogItem;
  close: () => void;
  select: (id: string) => void;
  openOther: (cat: string, item?: string) => void;
  fav: boolean;
  toggleFav: () => void;
  compare: () => void;
}) {
  const rows = specRows(cat, item);
  // Retail cards show the full specs of their GPU chip (same category).
  const chip = typeof item.chip_id === 'string' ? cat.items.find((i) => i.id === item.chip_id) : undefined;
  const chipRows = chip ? specRows(cat, chip).filter((r) => !rows.some((x) => x.label === r.label) && r.label !== 'Type') : [];
  const fromPcpp = cat.sources.some((s) => s.name.startsWith('PCPartPicker'));
  const online = item.link
    ? { href: item.link, label: item.link.includes('techpowerup') ? 'Full specs on TechPowerUp' : item.link.includes('wikidata') ? 'More on Wikidata' : 'Source page' }
    : fromPcpp
      ? { href: `https://pcpartpicker.com/search/?q=${encodeURIComponent(item.name)}`, label: 'Look it up on PCPartPicker' }
      : null;
  const wd = item.wd ? Object.entries(item.wd) : [];
  // Family tree: the same tier across generations (for a retail card, its GPU chip's family).
  const family = useMemo(() => familyOf(chip ?? item, cat.items, cat.id), [chip, item, cat]);
  const released = item.date
    ? new Date(`${item.date.length === 7 ? `${item.date}-01` : item.date}T12:00:00`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        ...(item.date.length > 7 ? { day: 'numeric' } : {}),
      })
    : item.year
      ? String(item.year)
      : '';
  return (
    <aside className="card hw-detail">
      <div className="hw-detail-head">
        <div>
          <div className="muted small">{item.maker}</div>
          <h2>{item.name}</h2>
          {typeof item.chipset === 'string' && <div className="small">{item.chipset}</div>}
          {released && (
            <div className="muted small">
              Released {released}
              {item.year_note ? ` (${item.year_note})` : ''}
            </div>
          )}
        </div>
        <button className="btn small ghost" onClick={close} title="Close">
          ✕
        </button>
      </div>
      <div className="hw-actions">
        <button className={fav ? 'btn small fav-btn on' : 'btn small ghost fav-btn'} onClick={toggleFav}>
          {fav ? '★ Favorite' : '☆ Add to favorites'}
        </button>
        <button className="btn small ghost" onClick={compare}>
          ⇄ Compare
        </button>
      </div>

      <table className="hw-specs">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th>{r.label}</th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {chip && (
        <>
          <h3 className="hw-sub">
            {chip.name} chip specs{' '}
            <button className="link small" onClick={() => select(chip.id)}>
              open chip →
            </button>
          </h3>
          <table className="hw-specs">
            <tbody>
              {chipRows.map((r) => (
                <tr key={r.label}>
                  <th>{r.label}</th>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {wd.length > 0 && (
        <>
          <h3 className="hw-sub">More details (Wikidata)</h3>
          <table className="hw-specs">
            <tbody>
              {wd.map(([k, v]) => (
                <tr key={k}>
                  <th>{k.replace(/^\w/, (c) => c.toUpperCase())}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {family.length > 1 && (
        <>
          <h3 className="hw-sub">Family tree</h3>
          <p className="muted small">The same tier across generations, oldest first. FP32 compute is a rough guide to raw power.</p>
          <ol className="family">
            {family.map((f, i) => {
              const prev = family[i - 1];
              const tf = typeof f.fp32 === 'number' ? f.fp32 : undefined;
              const ptf = prev && typeof prev.fp32 === 'number' ? prev.fp32 : undefined;
              const gain = tf && ptf ? Math.round((tf / ptf - 1) * 100) : undefined;
              const isMe = f.id === (chip ?? item).id;
              return (
                <li key={f.id} className={isMe ? 'on' : ''}>
                  <button className="link" onClick={() => select(f.id)} disabled={isMe}>
                    {f.name}
                  </button>
                  <span className="muted small">
                    {' '}
                    {[f.year, f.memory, typeof f.cores === 'number' ? `${f.cores} cores` : '', f.socket, tf ? `${formatValue(tf)} GFLOPS` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {gain !== undefined && <span className={gain >= 0 ? 'pos small' : 'neg small'}> {gain >= 0 ? '+' : ''}{gain}%</span>}
                </li>
              );
            })}
          </ol>
        </>
      )}
      {!rows.length && !wd.length && <p className="muted small">No specifications recorded yet.</p>}
      {online && (
        <p className="small">
          <a href={online.href}>{online.label} →</a>
        </p>
      )}
    </aside>
  );
}

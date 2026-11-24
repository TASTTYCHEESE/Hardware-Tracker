import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/platform';
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

export function Hardware({ group, jump, onJumped }: { group: Group; jump?: { cat: string; item?: string } | null; onJumped?: () => void }) {
  const [index, setIndex] = useState<CatalogIndex | null>(null);
  const [error, setError] = useState('');
  const [catId, setCatId] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<string | null>(null);

  const loadIndex = (force = false) => {
    setError('');
    api
      .catalogIndex(force)
      .then(setIndex)
      .catch((e) => setError(String(e.message || e)));
  };
  useEffect(() => loadIndex(), []);

  // Another page (or a graphics card's "GPU chip" link) asked for a specific item.
  useEffect(() => {
    if (!jump) return;
    setCatId(jump.cat);
    setPendingItem(jump.item ?? null);
    onJumped?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);

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
        initialItem={pendingItem}
        back={() => {
          setCatId(null);
          setPendingItem(null);
        }}
        openOther={(cat, item) => {
          setCatId(cat);
          setPendingItem(item ?? null);
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
          <button key={c.id} className={c.count ? 'hw-tile' : 'hw-tile empty'} onClick={() => setCatId(c.id)}>
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
  initialItem,
  back,
  openOther,
}: {
  info: CatalogIndex['categories'][number];
  version: string;
  initialItem: string | null;
  back: () => void;
  openOther: (cat: string, item?: string) => void;
}) {
  const [cat, setCat] = useState<CatalogCategory | null>(memo.get(`${info.id}@${version}`) ?? null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const query = useDeferredValue(q);
  const [maker, setMaker] = useState('');
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<Sort>(info.years ? 'new' : 'name');
  const [limit, setLimit] = useState(PAGE);
  const [sel, setSel] = useState<string | null>(initialItem);

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

  const filtered = useMemo(() => {
    if (!cat) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const q1 = simplify(query);
    // Search and filters must both match. The search decides the order: best name matches first.
    const score = new Map<CatalogItem, number>();
    const list = cat.items.filter((it) => {
      if (maker && it.maker !== maker) return false;
      if (from && (!it.year || it.year < from)) return false;
      if (to && (!it.year || it.year > to)) return false;
      for (const [k, v] of Object.entries(extra)) if (v && String(it[k] ?? '') !== v) return false;
      if (words.length) {
        const name = it.name.toLowerCase();
        const sname = simplify(it.name);
        const hay = `${name} ${it.maker} ${Object.values(it).filter((x) => typeof x === 'string').join(' ')}`.toLowerCase();
        const inName = words.every((w) => name.includes(w)) || sname.includes(q1);
        if (!inName && !words.every((w) => hay.includes(w)) && !simplify(hay).includes(q1)) return false;
        score.set(it, sname === q1 ? 0 : sname.startsWith(q1) || name.startsWith(words[0]) ? 1 : inName ? 2 : 3);
      }
      return true;
    });
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
    return list.sort((a, b) => (score.get(a) ?? 0) - (score.get(b) ?? 0) || cmp(a, b));
  }, [cat, query, maker, from, to, extra, sort]);

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
        {vals.slice(0, 1500).map(([v, n]) => (
          <option key={v} value={v}>
            {formatValue(isNaN(Number(v)) ? v : Number(v), cat.fields.find((f) => f.k === k)?.unit)} ({n})
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
                {options.maker.map(([m, n]) => (
                  <option key={m} value={m}>
                    {m} ({n})
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
                      From {y}
                    </option>
                  ))}
                </select>
                <select className="select" value={to} onChange={(e) => setTo(Number(e.target.value))} title="To year">
                  <option value={0}>To any year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      To {y}
                    </option>
                  ))}
                </select>
              </span>
            )}
            {Object.entries(options)
              .filter(([k]) => k !== 'maker' && k !== 'kind')
              .map(([k, vals]) => extraSelect(k, vals))}
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
                        <div>{it.name}</div>
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
            {selected && <Detail cat={cat} item={selected} close={() => setSel(null)} select={setSel} openOther={openOther} />}
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
}: {
  cat: CatalogCategory;
  item: CatalogItem;
  close: () => void;
  select: (id: string) => void;
  openOther: (cat: string, item?: string) => void;
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
      {!rows.length && !wd.length && <p className="muted small">No specifications recorded yet.</p>}
      {online && (
        <p className="small">
          <a href={online.href}>{online.label} →</a>
        </p>
      )}
    </aside>
  );
}

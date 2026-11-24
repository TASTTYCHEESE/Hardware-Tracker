import { useDeferredValue, useEffect, useMemo, useState } from 'react';
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
type Sort = 'new' | 'old' | 'name' | 'maker';
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

  const cats = index.categories.filter((c) => c.group === group);
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
      out[key] = [...m.entries()].sort((a, b) => (key === 'maker' ? b[1] - a[1] || a[0].localeCompare(b[0]) : numeric ? Number(a[0]) - Number(b[0]) : a[0].localeCompare(b[0])));
    }
    return out;
  }, [cat]);

  const filtered = useMemo(() => {
    if (!cat) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = cat.items.filter((it) => {
      if (maker && it.maker !== maker) return false;
      if (from && (!it.year || it.year < from)) return false;
      if (to && (!it.year || it.year > to)) return false;
      for (const [k, v] of Object.entries(extra)) if (v && String(it[k] ?? '') !== v) return false;
      if (words.length) {
        const hay = `${it.name} ${it.maker} ${Object.values(it).filter((x) => typeof x === 'string').join(' ')}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const by: Record<Sort, (a: CatalogItem, b: CatalogItem) => number> = {
      new: (a, b) => (b.date ?? String(b.year ?? '')).localeCompare(a.date ?? String(a.year ?? '')) || a.name.localeCompare(b.name),
      old: (a, b) => (a.year ?? 9999) - (b.year ?? 9999) || (a.date ?? '').localeCompare(b.date ?? '') || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      maker: (a, b) => a.maker.localeCompare(b.maker) || a.name.localeCompare(b.name),
    };
    return list.sort(by[sort]);
  }, [cat, query, maker, from, to, extra, sort]);

  useEffect(() => setLimit(PAGE), [query, maker, from, to, extra, sort]);

  const selected = sel ? cat?.items.find((i) => i.id === sel) : undefined;
  const cols = (cat?.fields ?? []).filter((f) => f.k !== 'date' && f.k !== 'color').slice(0, selected ? 2 : 4);
  const filtersOn = !!(q || maker || from || to || Object.values(extra).some(Boolean));

  return (
    <div className="page hw-page">
      <div className="section-head">
        <button className="link small" onClick={back}>
          ← All categories
        </button>
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
        <>
          <div className="hw-filters">
            <input className="search" placeholder={`Search ${info.count.toLocaleString()} ${info.name.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
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
              .filter(([k]) => k !== 'maker')
              .map(([k, vals]) => (
                <select key={k} className="select" value={extra[k] ?? ''} onChange={(e) => setExtra((x) => ({ ...x, [k]: e.target.value }))}>
                  <option value="">{`Any ${labelFor(cat, k).toLowerCase()}`}</option>
                  {vals.slice(0, 300).map(([v, n]) => (
                    <option key={v} value={v}>
                      {formatValue(isNaN(Number(v)) ? v : Number(v), cat.fields.find((f) => f.k === k)?.unit)} ({n})
                    </option>
                  ))}
                </select>
              ))}
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} title="Sort">
              {years.length > 0 && <option value="new">Newest first</option>}
              {years.length > 0 && <option value="old">Oldest first</option>}
              <option value="name">Name A–Z</option>
              <option value="maker">Manufacturer</option>
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
                        <div className="muted small">{it.maker}</div>
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
              {!filtered.length && <p className="muted">Nothing matches these filters.</p>}
            </div>
            {selected && <Detail cat={cat} item={selected} close={() => setSel(null)} openOther={openOther} />}
          </div>
        </>
      )}
    </div>
  );
}

function Detail({ cat, item, close, openOther }: { cat: CatalogCategory; item: CatalogItem; close: () => void; openOther: (cat: string, item?: string) => void }) {
  const rows = specRows(cat, item);
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
      {typeof item.chip_id === 'string' && (
        <button className="btn small" onClick={() => openOther('gpu', item.chip_id as string)}>
          Full {String(item.chipset ?? 'GPU')} chip specs →
        </button>
      )}
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
      {item.link && (
        <p className="small">
          <a href={item.link}>Source page</a>
        </p>
      )}
    </aside>
  );
}

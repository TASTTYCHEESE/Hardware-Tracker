import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { safeUrl } from '../lib/format';
import type { Category, Direction, NewsItem, Source } from '../lib/types';

export const CATS: Category[] = ['GPU', 'CPU', 'RAM'];

/** How a category is written on screen: plural for GPUs and CPUs. */
export const CAT_LABEL: Record<Category, string> = { GPU: 'GPUs', CPU: 'CPUs', RAM: 'RAM', Industry: 'Industry', Other: 'Other' };
export const catLabel = (c: Category | 'All') => (c === 'All' ? 'All' : CAT_LABEL[c] ?? c);

export function CatBadge({ c }: { c: Category }) {
  return <span className={`badge cat-${c}`}>{CAT_LABEL[c] ?? c}</span>;
}

export function DirBadge({ d, text }: { d: Direction; text?: string }) {
  const arrow = d === 'up' ? '▲' : d === 'down' ? '▼' : d === 'mixed' ? '◆' : '■';
  const label = d === 'up' ? 'Rising' : d === 'down' ? 'Falling' : d === 'mixed' ? 'Mixed' : 'Flat';
  return (
    <span className={`dir dir-${d}`}>
      {arrow} {text ?? label}
    </span>
  );
}

export function Sources({ list }: { list?: Source[] }) {
  if (!list?.length) return null;
  return (
    <div className="sources">
      {list.map((s) => (
        <a key={s.url + s.title} href={safeUrl(s.url)} target="_blank" rel="noreferrer">
          {s.title}
        </a>
      ))}
    </div>
  );
}

export function NewsCard({ item, cat }: { item: NewsItem; cat?: Category }) {
  return (
    <article className="news-card">
      <header>
        {cat && <CatBadge c={cat} />}
        {item.status === 'rumor' && <span className="badge rumor">Rumor / leak</span>}
        {item.status === 'confirmed' && <span className="badge confirmed">Confirmed</span>}
      </header>
      <h4>{item.headline}</h4>
      <p>{item.detail}</p>
      <Sources list={item.sources} />
    </article>
  );
}

export function Sparkline({ values, w = 140, h = 36 }: { values: number[]; w?: number; h?: number }) {
  if (values.length < 2) return <svg width={w} height={h} className="spark" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (w - 6) + 3},${h - 3 - ((v - min) / span) * (h - 6)}`);
  const down = values[values.length - 1] < values[values.length - 2];
  return (
    <svg width={w} height={h} className={`spark ${down ? 'spark-down' : 'spark-up'}`} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r="3" />
    </svg>
  );
}

/**
 * Wide tables: the horizontal scroll bar sits at the top and stays on screen while you scroll
 * down, and so do the column headers. Shift + wheel (or a sideways trackpad swipe) scrolls sideways.
 * `top` is how far from the top of the page the bar should stick (below any sticky toolbar).
 */
export function StickyTable({ top = '0px', children }: { top?: string; children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [w, setW] = useState({ full: 0, view: 0 });
  useLayoutEffect(() => {
    const el = wrap.current;
    const inn = inner.current;
    if (!el || !inn) return;
    const measure = () => setW((o) => (o.full === inn.scrollWidth && o.view === el.clientWidth ? o : { full: inn.scrollWidth, view: el.clientWidth }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(inn);
    return () => ro.disconnect();
  }, []);
  const over = w.full > w.view + 1;
  const shift = (x: number) => {
    if (inner.current) inner.current.style.transform = x ? `translateX(${-x}px)` : '';
  };
  useEffect(() => {
    if (!over) shift(0);
    else if (bar.current) shift(bar.current.scrollLeft);
  }, [over, w.full, w.view]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const b = bar.current;
      if (!b || b.scrollWidth <= b.clientWidth) return;
      const dx = e.shiftKey ? e.deltaX || e.deltaY : Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (!dx) return;
      e.preventDefault();
      b.scrollLeft += dx;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  return (
    <div className="st-wrap" ref={wrap} style={{ ['--st-top' as string]: top, ['--st-bar' as string]: over ? '16px' : '0px' }}>
      {over && (
        <div className="st-bar" ref={bar} onScroll={(e) => shift(e.currentTarget.scrollLeft)} title="Scroll sideways (or Shift + mouse wheel)">
          <div style={{ width: w.full, height: 1 }} />
        </div>
      )}
      <div className="st-inner" ref={inner}>
        {children}
      </div>
    </div>
  );
}

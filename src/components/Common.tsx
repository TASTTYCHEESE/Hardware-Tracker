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

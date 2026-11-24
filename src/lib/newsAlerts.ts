import type { FeedArticle } from './types';

/** Articles in the live feed that mention one of the user's keywords (whole words, any case). */
export function keywordHits(articles: FeedArticle[], keywords: string[]): { a: FeedArticle; kw: string }[] {
  const res = keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => ({ k, re: new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]*')}($|[^\\p{L}\\p{N}])`, 'iu') }));
  const out: { a: FeedArticle; kw: string }[] = [];
  for (const a of articles) {
    const text = `${a.title} ${a.summary}`;
    const hit = res.find((r) => r.re.test(text));
    if (hit) out.push({ a, kw: hit.k });
  }
  return out.sort((x, y) => y.a.date - x.a.date);
}

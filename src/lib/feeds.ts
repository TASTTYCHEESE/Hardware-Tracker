import { api } from './platform';
import type { Category, FeedArticle } from './types';

export const DEFAULT_FEEDS: { name: string; url: string }[] = [
  { name: "Tom's Hardware", url: 'https://www.tomshardware.com/feeds/all' },
  { name: 'VideoCardz', url: 'https://videocardz.com/feed' },
  { name: 'TechPowerUp', url: 'https://www.techpowerup.com/rss/news' },
  { name: 'Wccftech', url: 'https://wccftech.com/feed/' },
  { name: 'Guru3D', url: 'https://www.guru3d.com/rss' },
  { name: 'KitGuru', url: 'https://www.kitguru.net/feed/' },
  { name: 'ComputerBase (DE)', url: 'https://www.computerbase.de/rss/news.xml' },
];

const RULES: [Category, RegExp][] = [
  ['Industry', /\b(ceo|cfo|jensen|huang|lisa su|lip-bu tan|pat gelsinger|earnings|revenue|quarterly results|fiscal|stock|shares|market cap|acquisition|acquire|merger|layoffs?|lawsuit|antitrust|export (ban|rules|controls?)|tariffs?|keynote|investors?|succession|tsmc|foundry)\b/i],
  ['GPU', /\b(gpu|graphics card|geforce|rtx|radeon|rx ?\d{4}|arc [ab]\d|battlemage|celestial|rdna|blackwell|rubin|gddr\d?|dlss|fsr|xess|vram)\b/i],
  ['CPU', /\b(cpu|processor|ryzen|threadripper|epyc|core ultra|core i[3579]|intel core|x3d|zen ?\d|arrow lake|nova lake|panther lake|lunar lake|razor lake|am5|am6|lga ?\d{4}|snapdragon x)\b/i],
  ['RAM', /\b(ram|dram|ddr[45]x?|lpddr\d?|memory kit|camm2?|dimm|hbm\d?e?|micron|sk ?hynix|samsung memory|memory price|memory shortage|nand)\b/i],
];

export function classify(text: string): Category {
  for (const [cat, re] of RULES) if (re.test(text)) return cat;
  return 'Other';
}

function strip(html: string): string {
  const d = new DOMParser().parseFromString(html, 'text/html');
  return (d.body.textContent || '').replace(/\s+/g, ' ').trim();
}

export function parseFeed(xml: string, sourceName: string): FeedArticle[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return [];
  const nodes = Array.from(doc.querySelectorAll('item, entry'));
  return nodes.map((n) => {
    const get = (sel: string) => n.querySelector(sel)?.textContent?.trim() ?? '';
    const title = strip(get('title'));
    const linkEl = n.querySelector('link');
    const link = linkEl?.getAttribute('href') || linkEl?.textContent?.trim() || get('guid');
    const dateStr = get('pubDate') || get('published') || get('updated') || get('dc\\:date');
    const raw = get('description') || get('summary') || get('content');
    const summary = strip(raw).slice(0, 320);
    return {
      id: link || `${sourceName}-${title}`,
      title,
      link,
      date: Date.parse(dateStr) || 0,
      source: sourceName,
      summary,
      category: classify(`${title} ${summary}`),
    };
  });
}

export interface FeedResult {
  articles: FeedArticle[];
  errors: { name: string; error: string }[];
}

export async function loadFeeds(feeds: { name: string; url: string }[]): Promise<FeedResult> {
  const errors: FeedResult['errors'] = [];
  const lists = await Promise.all(
    feeds.map(async (f) => {
      try {
        return parseFeed(await api.fetchText(f.url), f.name);
      } catch (e) {
        errors.push({ name: f.name, error: (e as Error).message });
        return [];
      }
    }),
  );
  const seen = new Set<string>();
  const articles = lists
    .flat()
    .filter((a) => a.title && !seen.has(a.id) && seen.add(a.id))
    .sort((a, b) => b.date - a.date);
  return { articles, errors };
}

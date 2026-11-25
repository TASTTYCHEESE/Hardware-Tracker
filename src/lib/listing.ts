// "Check a listing": read a shop or classified-ad page (eBay, OLX, Bazar.bg, Amazon, ...), find the
// title and price, and guess which part it is. Everything is a best guess the user can correct.
import { api } from './platform';
import { benchList, type BenchItem } from './bench';
import { USED_PARTS, type UsedKind, type UsedPart } from './used';

export type PartKind = 'gpu' | 'cpu' | UsedKind;
export interface PartRef {
  kind: PartKind;
  name: string;
}
export interface Listing {
  url: string;
  title: string;
  price?: number;
  currency?: string;
  image?: string;
  part?: PartRef;
  /** the page couldn't be read (blocked, login needed, or the web app's browser limits) */
  error?: string;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();

function meta(html: string, names: string[]): string | undefined {
  for (const n of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${n}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (c) return decode(c);
  }
  return undefined;
}

const SYMBOLS: [RegExp, string][] = [
  [/€|\beur\b|евро/i, 'EUR'],
  [/лв\.?|\bbgn\b/i, 'BGN'],
  [/£|\bgbp\b/i, 'GBP'],
  [/¥|円|\bjpy\b/i, 'JPY'],
  [/zł|\bpln\b/i, 'PLN'],
  [/\bc\$|\bcad\b/i, 'CAD'],
  [/\ba\$|\baud\b/i, 'AUD'],
  [/r\$|\bbrl\b/i, 'BRL'],
  [/₹|\binr\b/i, 'INR'],
  [/₩|\bkrw\b/i, 'KRW'],
  [/\$|\busd\b/i, 'USD'],
];

/** "1.234,56" / "1,234.56" / "1 234" → number */
function parseAmount(s: string): number | undefined {
  let t = s.replace(/[^\d.,]/g, '');
  if (!t) return undefined;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/,/g, '');
  const n = Number(t);
  return n > 0 ? n : undefined;
}

/** Price from JSON-LD offers, price meta tags, or a price-looking text near the top of the page. */
function findPrice(html: string): { price?: number; currency?: string } {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const stack: unknown[] = [JSON.parse(m[1])];
      while (stack.length) {
        const o = stack.pop();
        if (!o || typeof o !== 'object') continue;
        if (Array.isArray(o)) {
          stack.push(...o);
          continue;
        }
        const r = o as Record<string, unknown>;
        const price = r.price ?? r.lowPrice;
        if (price !== undefined && (r['@type'] === 'Offer' || r['@type'] === 'AggregateOffer' || r.priceCurrency)) {
          const p = parseAmount(String(price));
          if (p) return { price: p, currency: typeof r.priceCurrency === 'string' ? r.priceCurrency.toUpperCase() : undefined };
        }
        stack.push(...Object.values(r));
      }
    } catch {
      /* bad JSON-LD */
    }
  }
  const mp = meta(html, ['product:price:amount', 'og:price:amount', 'price']);
  if (mp) return { price: parseAmount(mp), currency: meta(html, ['product:price:currency', 'og:price:currency', 'priceCurrency'])?.toUpperCase() };
  const ip = html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i)?.[1];
  if (ip) return { price: parseAmount(ip), currency: html.match(/itemprop=["']priceCurrency["'][^>]*content=["']([A-Z]{3})["']/i)?.[1] };
  return {};
}

/** Price written in text, e.g. "Цена: 450 лв." or "€ 320" (used when the page has no price tags). */
export function priceInText(text: string): { price?: number; currency?: string } {
  const m =
    text.match(/(€|£|\$|¥|₹|₩)\s?(\d[\d\s.,]*)/) ??
    text.match(/(\d[\d\s.,]*)\s?(€|£|\$|лв\.?|eur|bgn|usd|gbp|zł|pln|円)/i);
  if (!m) return {};
  const [sym, num] = /\d/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]];
  const cur = SYMBOLS.find(([re]) => re.test(sym))?.[1];
  return { price: parseAmount(num.trim()), currency: cur };
}

// ---- Which part is it? ------------------------------------------------------------
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function matchBench(title: string, kind: 'gpu' | 'cpu'): BenchItem | undefined {
  const t = ` ${squash(title).replace(/\b(nvidia|geforce|amd|radeon|intel|core|ryzen)\b/g, ' ').replace(/\s+/g, ' ')} `;
  let best: BenchItem | undefined;
  let bestLen = 0;
  for (const b of benchList(kind)) {
    const key = squash(b.name).replace(/\b(geforce|radeon|core|ryzen)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const words = key.split(' ');
    // every word of the model, in order, as whole words ("rtx 4070 super", "9800x3d", "ultra 7 265k")
    const re = new RegExp(`\\b${words.join('\\s*')}\\b`);
    if (re.test(t) && key.length > bestLen) {
      // "rtx 4070" must not win over "rtx 4070 ti" when the title says Ti
      best = b;
      bestLen = key.length;
    }
  }
  return best;
}

function matchUsed(title: string): PartRef | undefined {
  const t = title.toLowerCase();
  const pick = (kind: UsedKind, f: (p: UsedPart) => number) => {
    const scored = USED_PARTS[kind].map((p) => [f(p), p] as const).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
    return scored[0] ? { kind, name: scored[0][1].name } : undefined;
  };
  // RAM
  const ddr = t.match(/ddr\s?([45])/)?.[1];
  if (ddr && /(ram|memory|памет|dimm|kit|\d+\s?gb)/.test(t) && !/gddr/.test(t)) {
    const kit = t.match(/(\d)\s?x\s?(\d+)\s?gb/);
    const total = kit ? +kit[1] * +kit[2] : +(t.match(/(\d+)\s?gb/)?.[1] ?? 0);
    const speed = t.match(/(\d{4})\s?(mhz|mt\/s)?/)?.[1];
    const sodimm = /so-?dimm|laptop|лаптоп/.test(t);
    const cl = t.match(/\bcl\s?(\d{2})\b/)?.[1];
    return pick('ram', (p) => {
      const n = p.name.toLowerCase();
      if (!n.startsWith(`ddr${ddr}`) || n.includes('so-dimm') !== sodimm) return 0;
      const pk = n.match(/(\d)x(\d+)gb/);
      const ptotal = pk ? +pk[1] * +pk[2] : 0;
      return 10 - Math.abs(Math.log2((ptotal || 1) / (total || 32))) * 4 + (speed && n.includes(speed) ? 2 : 0) + (n.includes('cl') ? (cl && n.includes(`cl${cl}`) ? 1 : -0.5) : 0);
    });
  }
  // SSD
  if (/\b(ssd|nvme|m\.2|sata ssd)\b/.test(t) || /\b(990 pro|980 pro|970 evo|9100 pro|sn850x?|sn7100|sn770|kc3000|nv3|mx500|870 evo|860 evo|t700|t705|firecuda|mp600|mp700|p3 plus|p5 plus)\b/.test(t)) {
    const tb = t.match(/(\d+(?:[.,]\d)?)\s?tb/)?.[1];
    const gb = t.match(/(\d{3,4})\s?gb/)?.[1];
    const size = tb ? parseFloat(tb.replace(',', '.')) * 1000 : gb ? +gb : 1000;
    const iface = /gen\s?5|pcie\s?5|t700|t705|crucial t7|9100 pro/.test(t) ? 'gen 5' : /gen\s?4|pcie\s?4|990 pro|980 pro|sn850|sn7100|kc3000|nv3/.test(t) ? 'gen 4' : /gen\s?3|pcie\s?3|970 evo|sn570|p3\b/.test(t) ? 'gen 3' : /\bsata\b|870 evo|860 evo|mx500/.test(t) ? 'sata' : 'gen 4';
    return pick('ssd', (p) => {
      const g = p.group.toLowerCase();
      if (!(iface === 'sata' ? g === 'sata' : g.endsWith(iface))) return 0;
      const pt = p.name.match(/(\d+)\s?(tb|gb)/i)!;
      const ps = +pt[1] * (pt[2].toLowerCase() === 'tb' ? 1000 : 1);
      return 10 - Math.abs(Math.log2(ps / size)) * 3;
    });
  }
  // Motherboard: chipset name
  const chip = t.match(/\b(x870e|x870|b850|b650e?|a620|x570|b550|a520|z890|b860|z790|b760|z690|b660|z590|b560)\b/)?.[1];
  if (chip) {
    const c = chip.replace(/e$/, (e) => (chip.startsWith('x870') ? e : ''));
    return pick('board', (p) => (p.name.toLowerCase().includes(c) ? 10 : 0));
  }
  // Power supply: wattage
  const watts = t.match(/\b(\d{3,4})\s?w\b/)?.[1];
  if (watts && /(psu|power supply|захранване|80\s?\+|80 plus|bronze|gold|platinum|modular)/.test(t)) {
    const w = +watts;
    const rating = /platinum|titanium/.test(t) ? 'platinum' : /gold/.test(t) ? 'gold' : /bronze/.test(t) ? 'bronze' : '';
    return pick('psu', (p) => {
      const pw = +p.name.match(/(\d+) W/)![1];
      return 10 - Math.abs(pw - w) / 50 + (rating && p.name.toLowerCase().includes(rating) ? 3 : 0);
    });
  }
  // Case
  if (/\b(case|chassis|кутия|tower|itx)\b/.test(t)) {
    if (/mini.?itx|\bitx\b|sff/.test(t)) return { kind: 'case', name: 'Mini-ITX small form factor' };
    if (/micro.?atx|matx|m-atx/.test(t)) return { kind: 'case', name: 'Micro-ATX case' };
    if (/full.?tower/.test(t)) return { kind: 'case', name: 'Full tower' };
    if (/lancool|north|4000d|airflow|pop air|meshify|focus/.test(t)) return { kind: 'case', name: 'Airflow mid-tower (e.g. Lancool 216, North)' };
    if (/o11|h7|h9|evo|torrent|hyte|y60|5000d|6500x/.test(t)) return { kind: 'case', name: 'Premium mid-tower (e.g. O11 Dynamic EVO, H7 Flow)' };
    return { kind: 'case', name: 'Airflow mid-tower (e.g. Lancool 216, North)' };
  }
  return undefined;
}

/** Best guess of which part a listing title is about. */
export function detectPart(title: string): PartRef | undefined {
  const t = title.toLowerCase();
  const gpuHint = /\b(rtx|gtx|rx\s?\d|arc\s?[ab]\d|geforce|radeon|graphics|видеокарт|vga)\b/.test(t);
  const cpuHint = /\b(ryzen|core\s?(i\d|ultra)|i[3579][-\s]\d|процесор|cpu|xeon)\b/.test(t);
  if (gpuHint) {
    const g = matchBench(title, 'gpu');
    if (g) return { kind: 'gpu', name: g.name };
  }
  if (cpuHint) {
    const c = matchBench(title, 'cpu');
    if (c) return { kind: 'cpu', name: c.name };
  }
  return matchUsed(title) ?? (matchBench(title, 'gpu') ? { kind: 'gpu', name: matchBench(title, 'gpu')!.name } : undefined);
}

/** Read a listing page and pull out what we can. */
export async function readListing(url: string): Promise<Listing> {
  const out: Listing = { url, title: '' };
  try {
    const html = await api.fetchText(url);
    out.title = meta(html, ['og:title', 'twitter:title']) ?? decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    out.image = meta(html, ['og:image']);
    let { price, currency } = findPrice(html);
    if (!price) ({ price, currency } = priceInText(`${out.title} ${meta(html, ['og:description', 'description']) ?? ''}`));
    out.price = price;
    out.currency = currency;
  } catch (e) {
    out.error = (e as Error).message || 'blocked';
  }
  // The address often names the product too (e.g. ebay.com/itm/RTX-3080-10GB...).
  const fromUrl = decodeURIComponent(url.replace(/^https?:\/\/[^/]+/, '')).replace(/[-_/+]/g, ' ');
  out.part = detectPart(out.title) ?? detectPart(fromUrl);
  return out;
}

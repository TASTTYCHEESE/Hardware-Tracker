// "Check a listing": read a shop or classified-ad page (eBay, OLX, Bazar.bg, Amazon, ...), find the
// title and price, and guess which part it is. Everything is a best guess the user can correct.
import { api } from './platform';
import type { BenchItem } from './bench';
import { ALL_CPUS, ALL_GPUS, usedModels, type PartKind, type UsedModel } from './usedModels';
export interface Listing {
  url: string;
  title: string;
  price?: number;
  currency?: string;
  image?: string;
  part?: UsedModel;
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
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

function matchBench(title: string, list: BenchItem[]): BenchItem | undefined {
  const t = ` ${squash(title).replace(/\b(nvidia|geforce|amd|radeon|intel|core|ryzen)\b/g, ' ').replace(/(\d+)\s?gb\b/g, '$1 gb').replace(/\s+/g, ' ')} `;
  let best: BenchItem | undefined;
  let bestLen = 0;
  for (const b of list) {
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

const without = (name: string, maker: string) => (name.startsWith(maker) ? name.slice(maker.length) : name);

/** Graphics card: the chip, then the board partner's version named in the title. */
function matchGpu(title: string): UsedModel | undefined {
  const chip = matchBench(title, ALL_GPUS);
  if (!chip) return undefined;
  const t = ` ${squash(title)} `;
  const models = usedModels('gpu').filter((m) => m.group === chip.name);
  let best: UsedModel | undefined;
  let bestScore = 0;
  for (const m of models) {
    if (m.maker === 'Any brand') continue;
    const makerHit = m.maker.split(/\s*\/\s*/).some((x) => t.includes(` ${squash(x)} `));
    const lineWords = squash(m.short.split(' / ')[0]).split(' ').filter((w) => w.length > 1);
    const lineHit = lineWords.length && lineWords.every((w) => t.includes(` ${w} `)) ? 2 + lineWords.length * 0.1 : 0;
    const score = (makerHit ? 1 : 0) + lineHit;
    if (score > bestScore) [best, bestScore] = [m, score];
  }
  return bestScore >= 2 ? best : models.find((m) => m.maker === 'Any brand');
}

function matchCpu(title: string): UsedModel | undefined {
  const b = matchBench(title, ALL_CPUS);
  return b ? usedModels('cpu').find((m) => m.bench === b) : undefined;
}

/** Product names written out: "RM850x", "990 Pro 2TB", "MAG B650 Tomahawk WiFi", "Lancool 216". */
function matchNamed(title: string, kind: PartKind): UsedModel | undefined {
  const c = compact(title.replace(/(\d)\s+(tb|gb)\b/gi, '$1$2'));
  let best: UsedModel | undefined;
  let bestLen = 0;
  for (const m of usedModels(kind)) {
    if (/^(Any brand|Other)/.test(m.maker)) continue;
    const key = compact(without(m.name, m.maker));
    if (key.length >= 4 && c.includes(key) && key.length > bestLen) [best, bestLen] = [m, key.length];
  }
  if (best) return best;
  // words in any order: every number-bearing word, and most of the others
  const t = ` ${squash(title).replace(/(\d)\s+(tb|gb|w)\b/g, '$1$2')} `;
  let bestScore = 0;
  for (const m of usedModels(kind)) {
    if (/^(Any brand|Other)/.test(m.maker)) continue;
    const words = squash(without(m.name, m.maker).replace(/(\d)\s+(TB|GB|W)\b/g, '$1$2')).split(' ').filter(Boolean);
    const nums = words.filter((w) => /\d/.test(w));
    if (!nums.length || !nums.every((w) => t.includes(` ${w} `))) continue;
    const hit = words.filter((w) => t.includes(` ${w} `)).length / words.length + (t.includes(` ${squash(m.maker)} `) ? 0.2 : 0);
    if (hit > bestScore) [best, bestScore] = [m, hit];
  }
  return bestScore >= 0.75 ? best : undefined;
}

function matchRam(t: string): UsedModel | undefined {
  const ddr = t.match(/ddr\s?([45])/)?.[1];
  if (!ddr || !/(ram|memory|памет|dimm|kit|\d+\s?gb)/.test(t) || /gddr/.test(t)) return undefined;
  const kit = t.match(/(\d)\s?x\s?(\d+)\s?gb/);
  const total = kit ? +kit[1] * +kit[2] : +(t.match(/(\d+)\s?gb/)?.[1] ?? 0);
  const mhz = t.match(/(\d{4})\s?(mhz|mt\/s)?/)?.[1];
  const sodimm = /so-?dimm|laptop|лаптоп|notebook/.test(t);
  const cl = t.match(/\bc[l]?\s?(\d{2})\b/)?.[1];
  const type = `DDR${ddr}${sodimm ? ' laptop' : ''}`;
  const all = usedModels('ram').filter((m) => (m.info ?? '').startsWith(`DDR${ddr}`) && (m.info ?? '').includes('laptop') === sodimm);
  // the product line named in the title, longest first ("trident z5 neo" over "trident z5")
  const st = ` ${squash(t)} `;
  const lines = [...new Set(all.filter((m) => !/^Other/.test(m.maker)).map((m) => m.group))]
    .map((g) => [g, squash(g.replace(/\s*\(.*\)$/, '').replace(/^Crucial (DDR5|SO-DIMM)$/, 'crucial'))] as const)
    .filter(([, w]) => st.includes(` ${w} `))
    .sort((a, b) => b[1].length - a[1].length);
  const pool = lines.length ? all.filter((m) => m.group === lines[0][0]) : all.filter((m) => /^Other/.test(m.maker));
  const score = (m: UsedModel) => {
    const n = m.short.toLowerCase();
    const pk = n.match(/(\d+)gb/);
    const ptotal = pk ? +pk[1] : 1;
    return 10 - Math.abs(Math.log2(ptotal / (total || 32))) * 4 + (mhz && n.includes(mhz) ? 2 : 0) + (cl && n.includes(`cl${cl}`) ? 1 : 0);
  };
  void type;
  return pool.sort((a, b) => score(b) - score(a))[0];
}

/** Fallback when the exact model isn't in our list: a typical one of the same kind and size. */
function matchGeneric(t: string): UsedModel | undefined {
  const other = (kind: PartKind) => usedModels(kind).filter((m) => /^Other/.test(m.maker));
  // SSD
  if (/\b(ssd|nvme|m\.2|sata ssd)\b/.test(t)) {
    const tb = t.match(/(\d+(?:[.,]\d)?)\s?tb/)?.[1];
    const gb = t.match(/(\d{3,4})\s?gb/)?.[1];
    const size = tb ? parseFloat(tb.replace(',', '.')) * 1000 : gb ? +gb : 1000;
    const tier = /gen\s?5|pcie\s?5/.test(t) ? 'NVMe PCIe 5.0' : /gen\s?3|pcie\s?3/.test(t) ? 'NVMe PCIe 3.0' : /\bsata\b|2\.5/.test(t) ? 'SATA' : 'NVMe PCIe 4.0';
    return other('ssd')
      .filter((m) => m.group === tier || (tier === 'NVMe PCIe 4.0' && m.group === 'NVMe PCIe 4.0') || (tier === 'SATA' && m.group.startsWith('SATA')) || (tier === 'NVMe PCIe 5.0' && m.group === 'NVMe PCIe 5.0'))
      .map((m) => {
        const p = m.short.match(/(\d+)\s?(TB|GB)/)!;
        return [m, Math.abs(Math.log2((+p[1] * (p[2] === 'TB' ? 1000 : 1)) / size))] as const;
      })
      .sort((a, b) => a[1] - b[1])[0]?.[0];
  }
  // Motherboard: chipset
  const chip = t.match(/\b(x870e|x870|b850|b650e|b650|a620|x570|b550|a520|x470|b450|z890|b860|z790|b760|z690|b660|h610|z590|b560|z490|z390|b365|b360)\b/)?.[1];
  if (chip) return other('board').find((m) => m.group.toLowerCase().startsWith(`${chip} `));
  // Power supply: wattage and rating
  const watts = t.match(/\b(\d{3,4})\s?w\b/)?.[1];
  if (watts && /(psu|power supply|захранване|80\s?\+|80 plus|bronze|gold|platinum|modular)/.test(t)) {
    const w = +watts;
    const rating = /platinum|titanium/.test(t) ? 'platinum' : /gold/.test(t) ? 'gold' : /bronze/.test(t) ? 'bronze' : '';
    return other('psu')
      .map((m) => [m, 10 - Math.abs(+m.short.match(/(\d+) W/)![1] - w) / 50 + (rating && m.short.toLowerCase().includes(rating) ? 3 : 0)] as const)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  // Case
  if (/\b(case|chassis|кутия|tower|itx)\b/.test(t)) {
    const c = other('case');
    if (/mini.?itx|\bitx\b|sff/.test(t)) return c.find((m) => m.group === 'Mini-ITX');
    if (/micro.?atx|matx|m-atx/.test(t)) return c.find((m) => m.group === 'Micro-ATX');
    if (/full.?tower/.test(t)) return c.find((m) => m.group === 'Full tower');
    return c.find((m) => m.short.startsWith('Airflow'));
  }
  return undefined;
}

/** Best guess of which model a listing title is about. */
export function detectPart(title: string): UsedModel | undefined {
  if (!title.trim()) return undefined;
  const t = title.toLowerCase();
  const gpuHint = /\b(rtx|gtx|rx\s?\d|arc\s?[ab]\d|geforce|radeon|graphics|видеокарт|vga)\b/.test(t);
  const cpuHint = /\b(ryzen|core\s?(i\d|ultra)|i[3579][-\s]\d|процесор|cpu|xeon)\b/.test(t);
  if (gpuHint) {
    const g = matchGpu(title);
    if (g) return g;
  }
  if (cpuHint) {
    const c = matchCpu(title);
    if (c) return c;
  }
  const ram = matchRam(t);
  if (ram) return ram;
  for (const kind of ['ssd', 'psu', 'board', 'case'] as PartKind[]) {
    const m = matchNamed(title, kind);
    if (m) return m;
  }
  return matchGeneric(t) ?? matchGpu(title);
}

/** Read a listing page and pull out what we can. */
/** Links to the user's own computer or local network (router pages, NAS...) are never fetched. */
export function isLocalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return true;
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (h === 'localhost' || !h.includes('.') && !h.includes(':') || /\.(localhost|local|internal|lan|home|intranet|corp)$/.test(h)) return true;
    const v4 = h.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
    if (v4) {
      const [a, b] = [+v4[1], +v4[2]];
      return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
    }
    return h.includes(':') && (h === '::1' || h === '::' || /^(fc|fd|fe[89ab]|::ffff:)/.test(h));
  } catch {
    return true;
  }
}

export async function readListing(url: string): Promise<Listing> {
  const out: Listing = { url, title: '' };
  if (isLocalUrl(url)) {
    out.error = 'local address';
    out.part = undefined;
    return out;
  }
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

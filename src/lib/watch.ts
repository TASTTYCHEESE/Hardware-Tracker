import type { PricePoint } from './types';

/** One tracked item: notify when its price in `region` is at or below `target` (local currency). */
export interface WatchItem {
  id: string;
  model: string;
  region: string;
  target: number;
  currency: string;
}

// Starter list so the Tracking page has something on day one.
export const DEFAULT_WATCHLIST: WatchItem[] = [
  { id: 'w1', model: 'RTX 5070', region: 'BG', target: 650, currency: 'EUR' },
  { id: 'w2', model: 'RTX 5070 Ti', region: 'US', target: 999, currency: 'USD' },
  { id: 'w3', model: 'RTX 5080', region: 'DE', target: 1400, currency: 'EUR' },
  { id: 'w4', model: 'DDR5-6000 2x16GB (cheapest)', region: 'US', target: 300, currency: 'USD' },
  { id: 'w5', model: 'RTX 5090', region: 'US', target: 3000, currency: 'USD' },
];

export function historyFor(w: WatchItem, prices: PricePoint[]): PricePoint[] {
  return prices.filter((p) => p.model === w.model && p.region === w.region).sort((a, b) => a.date.localeCompare(b.date));
}

export function latestFor(w: WatchItem, prices: PricePoint[]): PricePoint | undefined {
  const h = historyFor(w, prices);
  return h[h.length - 1];
}

/** Stable key for "this item hit its target at this data point", so we notify once. */
export const hitKey = (w: WatchItem, p: PricePoint) => `${w.id}|${p.date}|${p.price}`;

/** Parts people often track (the Tracking and Price alerts pickers suggest these). */
export const SUGGESTED_MODELS = ['RTX 5090', 'RTX 5080', 'RTX 5070 Ti', 'RTX 5070', 'RTX 5060 Ti 16GB', 'RX 9070 XT', 'RX 9070', 'RX 9060 XT 16GB', 'Arc B580', 'DDR5-6000 2x16GB (cheapest)', 'DDR5 2x32GB (cheapest)', 'Ryzen 7 9800X3D', 'Ryzen 7 9850X3D', 'Ryzen 9 9950X3D2', 'Core Ultra 7 270K Plus'];

/** "Tell me when this goes down": a part + country, and how big a drop counts (0 = any drop). */
export interface DropWatch {
  id: string;
  model: string;
  region: string;
  minPct: number;
}

/** The latest price change of a watched part, if it went down by at least minPct. */
export function dropFor(w: DropWatch, prices: PricePoint[]): { prev: PricePoint; last: PricePoint; pct: number } | null {
  const h = prices.filter((p) => p.model === w.model && p.region === w.region).sort((a, b) => a.date.localeCompare(b.date));
  const last = h[h.length - 1];
  // compare with the most recent earlier price in the same currency on an earlier day
  const prev = [...h].reverse().find((p) => p.date < last?.date && p.currency === last.currency);
  if (!last || !prev || last.price >= prev.price) return null;
  const pct = ((prev.price - last.price) / prev.price) * 100;
  return pct >= w.minPct ? { prev, last, pct } : null;
}

export const dropKey = (w: DropWatch, p: PricePoint) => `${w.id}|${p.date}|${p.price}`;

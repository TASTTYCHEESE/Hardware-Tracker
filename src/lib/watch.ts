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

// Approximate gaming performance (from public review averages) and launch prices,
// for price-to-performance. GPUs: 1440p raster, RTX 4090 = 100. CPUs: gaming with a fast GPU, Ryzen 7 9800X3D = 100.
// These are rounded estimates, not benchmarks of our own.

export interface Perf {
  score: number;
  msrp?: number; // USD launch price
}

const GPU: Record<string, Perf> = {
  'RTX 5090': { score: 128, msrp: 1999 },
  'RTX 4090': { score: 100, msrp: 1599 },
  'RTX 5080': { score: 82, msrp: 999 },
  'RX 7900 XTX': { score: 79, msrp: 999 },
  'RTX 4080 SUPER': { score: 77, msrp: 999 },
  'RTX 5070 Ti': { score: 72, msrp: 749 },
  'RX 9070 XT': { score: 71, msrp: 599 },
  'RTX 4070 Ti SUPER': { score: 66, msrp: 799 },
  'RX 9070': { score: 63, msrp: 549 },
  'RTX 5070': { score: 58, msrp: 549 },
  'RTX 4070 SUPER': { score: 56, msrp: 599 },
  'RX 7800 XT': { score: 51, msrp: 499 },
  'RTX 4070': { score: 49, msrp: 599 },
  'RTX 5060 Ti 16GB': { score: 44, msrp: 429 },
  'RX 9060 XT 16GB': { score: 43, msrp: 349 },
  'RTX 5060 Ti 8GB': { score: 42, msrp: 379 },
  'RX 9060 XT 8GB': { score: 41, msrp: 299 },
  'RTX 5060': { score: 37, msrp: 299 },
  'RTX 4060 Ti': { score: 36, msrp: 399 },
  'Arc B580': { score: 34, msrp: 249 },
  'RTX 4060': { score: 30, msrp: 299 },
  'Arc B570': { score: 30, msrp: 219 },
  'RX 7600': { score: 29, msrp: 269 },
  'RTX 5050': { score: 28, msrp: 249 },
};

const CPU: Record<string, Perf> = {
  'Ryzen 7 9800X3D': { score: 100, msrp: 479 },
  'Ryzen 9 9950X3D': { score: 99, msrp: 699 },
  'Ryzen 7 7800X3D': { score: 89, msrp: 449 },
  'Ryzen 9 9950X': { score: 85, msrp: 649 },
  'Ryzen 9 9900X': { score: 84, msrp: 499 },
  'Ryzen 7 9700X': { score: 83, msrp: 359 },
  'Core Ultra 9 285K': { score: 82, msrp: 589 },
  'Ryzen 5 9600X': { score: 80, msrp: 279 },
  'Core Ultra 7 265K': { score: 80, msrp: 394 },
  'Core i5-14600K': { score: 80, msrp: 319 },
  'Ryzen 5 7600X': { score: 76, msrp: 299 },
  'Core Ultra 5 245K': { score: 75, msrp: 309 },
  'Ryzen 7 5700X3D': { score: 70, msrp: 249 },
  'Core i5-12400F': { score: 63, msrp: 167 },
  'Ryzen 5 5600': { score: 60, msrp: 199 },
};

const k = (m: string) => m.toLowerCase().replace(/^(geforce|radeon|amd|intel)\s+/, '').replace(/[^a-z0-9]+/g, '');
const GPU_K = new Map(Object.entries(GPU).map(([m, p]) => [k(m), p]));
const CPU_K = new Map(Object.entries(CPU).map(([m, p]) => [k(m), p]));

export function perfFor(model: string, category: string): Perf | undefined {
  const key = k(model);
  if (category === 'GPU') return GPU_K.get(key) ?? GPU_K.get(key.replace(/(\d+)gb$/, ''));
  if (category === 'CPU') return CPU_K.get(key);
  return undefined;
}

export const PERF_NOTE =
  'Performance is an approximate gaming index from public review averages (GPUs at 1440p, RTX 4090 = 100; CPUs in games, Ryzen 7 9800X3D = 100). Memory is compared per GB.';

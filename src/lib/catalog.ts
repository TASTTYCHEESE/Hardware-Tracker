// PC Hardware catalog types (see tools/catalog/build.py for how it's built).

export interface CatalogCategoryInfo {
  id: string;
  name: string;
  group: 'hardware' | 'peripherals';
  description: string;
  count: number;
  makers: number;
  years: [number, number] | null;
  bytes: number;
  file: string;
}

export interface CatalogIndex {
  version: string;
  updated: string;
  categories: CatalogCategoryInfo[];
  offline?: boolean;
}

export interface CatalogField {
  k: string;
  label: string;
  unit?: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  maker: string;
  year?: number;
  date?: string;
  year_note?: string;
  link?: string;
  /** extra specifications from Wikidata, label -> value */
  wd?: Record<string, string>;
  [key: string]: unknown;
}

export interface CatalogCategory {
  id: string;
  name: string;
  group: 'hardware' | 'peripherals';
  description: string;
  fields: CatalogField[];
  filters: string[];
  sources: { name: string; url: string }[];
  /** extra sort orders this category supports */
  sorts?: ('popular' | 'used')[];
  note?: string;
  items: CatalogItem[];
  stale?: boolean;
}

/** Keys that are shown in the header, not as specifications. */
export const META_KEYS = new Set(['id', 'name', 'maker', 'year', 'date', 'year_note', 'link', 'wd', 'chip_id', 'kind']);

const PRETTY: Record<string, string> = {
  maker: 'Manufacturer',
  year: 'Year',
  rpm: 'Spindle speed',
};

/** Label for a filter or spec key, using the category's field list when it has one. */
export function labelFor(cat: CatalogCategory, key: string): string {
  return cat.fields.find((f) => f.k === key)?.label ?? PRETTY[key] ?? key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function formatValue(v: unknown, unit?: string): string {
  if (v === null || v === undefined || v === '') return '–';
  if (typeof v === 'number') {
    const s = Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 3 });
    return unit ? (unit === '"' || unit === '°' || unit === 'x' ? `${s}${unit}` : `${s} ${unit}`) : s;
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return unit && /^[\d.]+$/.test(String(v)) ? `${v} ${unit}` : String(v);
}

/** Spec rows for an item: the category's fields in order, then anything else it has. */
// GPU makers name the same things differently: CUDA cores (Nvidia), stream processors (AMD), Xe cores (Intel).
function gpuVendor(item: CatalogItem): 'nvidia' | 'amd' | 'intel' | null {
  const t = `${item.maker ?? ''} ${typeof item.chipset === 'string' ? item.chipset : ''} ${item.name}`;
  if (/nvidia|geforce|quadro|tesla|titan|\brtx\b|\bgtx\b/i.test(t)) return 'nvidia';
  if (/\bamd\b|\bati\b|radeon|firepro|instinct/i.test(t)) return 'amd';
  if (/intel|\barc\b/i.test(t)) return 'intel';
  return null;
}

export function gpuLabel(cat: CatalogCategory, item: CatalogItem, k: string): string | undefined {
  if (cat.id !== 'gpu' || (k !== 'cores' && k !== 'sms' && k !== 'rt_cores')) return undefined;
  const v = gpuVendor(item);
  if (k === 'rt_cores') return v === 'amd' ? 'Ray accelerators' : v === 'intel' ? 'Ray tracing units' : undefined;
  if (k === 'cores') return v === 'nvidia' ? 'CUDA cores' : v === 'amd' ? 'Stream processors' : 'Shading units (cores)';
  return v === 'nvidia' ? 'Streaming multiprocessors (SMs)' : v === 'amd' ? 'Compute units (CUs)' : v === 'intel' ? 'Xe cores' : undefined;
}

export function specRows(cat: CatalogCategory, item: CatalogItem): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const done = new Set<string>();
  for (const f of cat.fields) {
    done.add(f.k);
    if (f.k === 'date') continue; // shown in the header
    if (item[f.k] === undefined || item[f.k] === null || item[f.k] === '') continue;
    rows.push({ label: gpuLabel(cat, item, f.k) ?? f.label, value: formatValue(item[f.k], f.unit) });
  }
  for (const [k, v] of Object.entries(item)) {
    if (done.has(k) || META_KEYS.has(k) || v === null || v === undefined || v === '') continue;
    rows.push({ label: labelFor(cat, k), value: formatValue(v) });
  }
  return rows;
}

export const fmtBytes = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

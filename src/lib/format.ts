import type { Region } from './types';
import { COUNTRIES, type CountryCode } from './regions';

export const REGION_LABEL: Record<Region, string> = {
  ...(Object.fromEntries(COUNTRIES.map((c) => [c.code, c.name])) as Record<CountryCode, string>),
  EU: 'Europe',
  Global: 'Global',
};

export function money(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' || v >= 1000 ? 0 : 2,
    }).format(v);
  } catch {
    return `${v} ${currency}`;
  }
}

export function pct(from: number, to: number): number {
  return from ? ((to - from) / from) * 100 : 0;
}

export function fmtPct(p: number): string {
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}%`;
}

export function fmtDate(d: string | number): string {
  const date = typeof d === 'number' ? new Date(d) : new Date(`${d}T12:00:00`);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ago(ts: number): string {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

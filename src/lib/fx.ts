import { api } from './platform';

import { CURRENCIES } from './regions';

export type Currency = string;
export { CURRENCIES };

/** Units of each currency per 1 USD. */
export interface Rates {
  rates: Record<string, number>;
  date: string;
  source: string;
}

// Rough fallback used only when the app is offline and has never fetched rates.
const FALLBACK: Rates = {
  rates: { USD: 1, EUR: 0.87, GBP: 0.76, JPY: 155, CAD: 1.4, BRL: 5.5, PLN: 3.7, CNY: 7.1, KRW: 1450, TWD: 31, INR: 88, AUD: 1.53 },
  date: '',
  source: 'approximate (offline)',
};

const SOURCES: { url: string; parse: (j: any) => Rates }[] = [
  {
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: (j) => ({ rates: j.rates, date: (j.time_last_update_utc || '').slice(5, 16), source: 'ExchangeRate-API' }),
  },
  {
    // ECB rates (no TWD); the fallback fills any gap.
    url: 'https://api.frankfurter.dev/v1/latest?base=USD',
    parse: (j) => ({ rates: { ...FALLBACK.rates, USD: 1, ...j.rates }, date: j.date, source: 'European Central Bank' }),
  },
];

/** Latest rates: cached for 12h in settings, refreshed online, fallback otherwise. */
export async function loadRates(cached?: Rates & { fetchedAt?: number }): Promise<Rates & { fetchedAt?: number }> {
  if (cached?.fetchedAt && Date.now() - cached.fetchedAt < 12 * 3600e3) return cached;
  for (const s of SOURCES) {
    try {
      const r = s.parse(JSON.parse(await api.fetchText(s.url)));
      if (CURRENCIES.every((c) => typeof r.rates[c] === 'number' && r.rates[c] > 0)) {
        const fresh = { ...r, fetchedAt: Date.now() };
        api.setSettings({ fxRates: fresh }).catch(() => {});
        return fresh;
      }
    } catch {
      /* try next source */
    }
  }
  return cached?.rates ? cached : FALLBACK;
}

export function convert(amount: number, from: string, to: string, fx: Rates): number | null {
  const a = fx.rates[from];
  const b = fx.rates[to];
  if (!a || !b) return null;
  return (amount / a) * b;
}

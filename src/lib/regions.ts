// Every market the app can show prices for. To add a country, add one line here.
export const COUNTRIES = [
  { code: 'US', name: 'United States', group: 'Americas', currency: 'USD' },
  { code: 'CA', name: 'Canada', group: 'Americas', currency: 'CAD' },
  { code: 'BR', name: 'Brazil', group: 'Americas', currency: 'BRL' },
  { code: 'UK', name: 'United Kingdom', group: 'Europe', currency: 'GBP' },
  { code: 'DE', name: 'Germany', group: 'Europe', currency: 'EUR' },
  { code: 'FR', name: 'France', group: 'Europe', currency: 'EUR' },
  { code: 'IT', name: 'Italy', group: 'Europe', currency: 'EUR' },
  { code: 'ES', name: 'Spain', group: 'Europe', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', group: 'Europe', currency: 'EUR' },
  { code: 'PL', name: 'Poland', group: 'Europe', currency: 'PLN' },
  { code: 'BG', name: 'Bulgaria', group: 'Europe', currency: 'EUR' },
  { code: 'CN', name: 'China', group: 'Asia-Pacific', currency: 'CNY' },
  { code: 'JP', name: 'Japan', group: 'Asia-Pacific', currency: 'JPY' },
  { code: 'KR', name: 'South Korea', group: 'Asia-Pacific', currency: 'KRW' },
  { code: 'TW', name: 'Taiwan', group: 'Asia-Pacific', currency: 'TWD' },
  { code: 'IN', name: 'India', group: 'Asia-Pacific', currency: 'INR' },
  { code: 'AU', name: 'Australia', group: 'Asia-Pacific', currency: 'AUD' },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]['code'];
export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as CountryCode[];
export const GROUPS = ['Americas', 'Europe', 'Asia-Pacific'] as const;
export const CURRENCIES = [...new Set(COUNTRIES.map((c) => c.currency))];

// Shared data format. Daily/weekly recap files written by the scheduled Claude
// runs follow this exact shape (see RECAP_FORMAT.md in the project root).

export type Category = 'GPU' | 'CPU' | 'RAM' | 'Industry' | 'Other';
import type { CountryCode } from './regions';

/** A country code from regions.ts, or a wider area. */
export type Region = CountryCode | 'EU' | 'Global';
export type Direction = 'up' | 'down' | 'flat' | 'mixed';

export interface Source {
  title: string;
  url: string;
}

export interface NewsItem {
  headline: string;
  detail: string;
  /** "confirmed" = official/launched; "rumor" = leak or report */
  status?: 'confirmed' | 'rumor';
  sources?: Source[];
}

export interface Section {
  category: Category;
  items: NewsItem[];
}

export interface Trend {
  category: Category;
  region: Region;
  direction: Direction;
  /** short figure like "+11% MoM" */
  change?: string;
  note: string;
}

export interface PriceAlert {
  region: Region;
  item: string;
  category: Category;
  currency: string;
  from: number;
  to: number;
  note?: string;
  source?: Source;
}

export interface PricePoint {
  model: string;
  category: Category;
  region: Region;
  currency: string;
  price: number;
  msrp?: number;
  date: string; // YYYY-MM-DD
  source?: string;
}

export interface Recap {
  id: string; // e.g. daily-2026-11-25
  type: 'daily' | 'weekly' | 'catchup';
  date: string; // YYYY-MM-DD
  title: string;
  /** 2-4 sentence TL;DR */
  summary: string;
  /** bullet "what this means for you" takeaways */
  takeaways?: string[];
  sections: Section[];
  trends?: Trend[];
  alerts?: PriceAlert[];
  prices?: PricePoint[];
  sources?: Source[];
}

export interface FeedArticle {
  id: string;
  title: string;
  link: string;
  date: number;
  source: string;
  summary: string;
  category: Category;
  /** set when the headline was machine-translated to English */
  lang?: string;
  origTitle?: string;
  origLink?: string;
}

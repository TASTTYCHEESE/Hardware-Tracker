// Thin platform layer. Desktop (Electron) provides window.hwt; a future web or
// phone build can implement the same interface (fetch via a proxy, storage via
// localStorage / Capacitor Filesystem) without touching the UI.
import type { FeedArticle, Recap } from './types';
import type { CatalogCategory, CatalogIndex } from './catalog';

const CATALOG_URL = 'https://raw.githubusercontent.com/TASTTYCHEESE/Hardware-Tracker/main/catalog/';

interface Settings {
  dataDir?: string;
  feeds?: string[];
  notify?: boolean;
  seenRecaps?: string[];
  /** countries shown on the Prices page (default US) */
  priceRegions?: string[];
  /** 'local' or a currency code to convert all prices into */
  priceCurrency?: string;
  watchlist?: import('./watch').WatchItem[];
  watchNotified?: string[];
  /** background mode */
  closeToTray?: boolean;
  startWithWindows?: boolean;
  morningSummary?: boolean;
  autoQuitWhenBusy?: boolean;
  syncUrl?: string;
  lastSync?: number;
  lastSyncError?: string;
  lastAutoQuit?: number;
  lastAutoQuitReason?: string;
  catalogUrl?: string;
  catalogChecked?: number;
  catalogError?: string;
  fxRates?: { rates: Record<string, number>; date: string; source: string; fetchedAt?: number };
}

interface HwtApi {
  platform: string;
  fetchText(url: string): Promise<string>;
  readRecaps(): Promise<Recap[]>;
  importRecaps(): Promise<number>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  chooseFolder(): Promise<string | null>;
  openFolder(): Promise<void>;
  notify(title: string, body: string): Promise<void>;
  archiveArticles(list: FeedArticle[]): Promise<void>;
  listArchiveDays(): Promise<string[]>;
  readArchiveDay(day: string): Promise<FeedArticle[]>;
  onDataChanged(cb: () => void): () => void;
  onNavigate?(cb: (target: string) => void): () => void;
  appInfo?(): Promise<{ version: string; updateStatus?: string }>;
  checkForUpdates?(): Promise<string>;
  syncNow?(): Promise<{ added: number; error?: string }>;
  catalogIndex(force?: boolean): Promise<CatalogIndex>;
  catalogCategory(id: string): Promise<CatalogCategory>;
}

declare global {
  interface Window {
    hwt?: HwtApi;
  }
}

const LS_KEY = 'hwt-settings';
const ARCHIVE_KEY = 'hwt-news-archive';

/** Local calendar day (YYYY-MM-DD) of a timestamp; today when 0. */
export function localDay(ts?: number): string {
  const d = ts ? new Date(ts) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const webApi: HwtApi = {
  platform: 'web',
  async fetchText(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  },
  async readRecaps() {
    return [];
  },
  async importRecaps() {
    return 0;
  },
  async getSettings() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    } catch {
      return {};
    }
  },
  async setSettings(patch) {
    const next = { ...(await webApi.getSettings()), ...patch };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  },
  async chooseFolder() {
    return null;
  },
  async openFolder() {},
  async notify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
  },
  async archiveArticles(list) {
    try {
      const all: Record<string, FeedArticle[]> = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '{}');
      for (const a of list) {
        const day = localDay(a.date);
        const cur = (all[day] ||= []);
        if (!cur.some((x) => x.id === a.id)) cur.push(a);
      }
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(all));
    } catch {
      /* storage full or blocked */
    }
  },
  async listArchiveDays() {
    try {
      return Object.keys(JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '{}')).sort().reverse();
    } catch {
      return [];
    }
  },
  async readArchiveDay(day) {
    try {
      return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '{}')[day] || [];
    } catch {
      return [];
    }
  },
  onDataChanged() {
    return () => {};
  },
  async catalogIndex() {
    const r = await fetch(`${CATALOG_URL}index.json`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },
  async catalogCategory(id) {
    const r = await fetch(`${CATALOG_URL}${id}.json`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },
};

export const api: HwtApi = window.hwt ?? webApi;
export type { Settings };

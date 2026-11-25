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
  /** Android: we asked for notification permission once already */
  askedNotify?: boolean;
  seenRecaps?: string[];
  /** countries shown on the Prices page (default US) */
  priceRegions?: string[];
  priceSort?: string;
  /** PC Hardware favorites: category id -> item ids */
  favorites?: Record<string, string[]>;
  /** how favorites show in lists */
  favMode?: 'top' | 'only' | 'off';
  /** products being compared */
  compare?: { cat: string; ids: string[] };
  /** products on the "Buy or wait?" list */
  buyList?: { cat: string; id: string; name: string; fav?: boolean }[];
  /** Live news keyword alerts */
  newsKeywords?: string[];
  /** ids of keyword-alert articles already seen */
  newsSeen?: string[];
  /** translate non-English headlines to English (default on) */
  translateNews?: boolean;
  /** products the user added to the price tracker */
  priceProducts?: { model: string; category: 'GPU' | 'CPU' | 'RAM' }[];
  /** 'local' or a currency code to convert all prices into */
  priceCurrency?: string;
  watchlist?: import('./watch').WatchItem[];
  /** My price-drop alerts (off by default; turned on in Settings) */
  dropWatchOn?: boolean;
  dropWatch?: import('./watch').DropWatch[];
  dropNotified?: string[];
  /** App language (LANGS in i18n.ts); English when unset */
  language?: string;
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
  /** install downloaded updates on quit by themselves (default) or only via the Restart button */
  autoInstallUpdates?: boolean;
  catalogUrl?: string;
  catalogChecked?: number;
  catalogError?: string;
  fxRates?: { rates: Record<string, number>; date: string; source: string; fetchedAt?: number };
}

export interface UpdateInfo {
  state: 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error' | 'unsupported';
  current: string;
  version: string;
  releaseName: string;
  releaseDate: string;
  notes: string;
  percent: number;
  message: string;
  lastCheck: number;
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
  /** Desktop only: save part of the window as a PNG (asks where). */
  saveImage?(dataUrl: string, name: string): Promise<{ ok: boolean; path?: string }>;
  notify(title: string, body: string): Promise<void>;
  archiveArticles(list: FeedArticle[]): Promise<void>;
  listArchiveDays(): Promise<string[]>;
  readArchiveDay(day: string): Promise<FeedArticle[]>;
  onDataChanged(cb: () => void): () => void;
  onNavigate?(cb: (target: string) => void): () => void;
  onHistory?(cb: (direction: number) => void): () => void;
  appInfo?(): Promise<{ version: string; updateStatus?: string }>;
  checkForUpdates?(): Promise<UpdateInfo | null>;
  updateInfo?(): Promise<UpdateInfo | null>;
  restartToUpdate?(): Promise<boolean>;
  onUpdateStatus?(cb: (info: UpdateInfo) => void): () => void;
  syncNow?(): Promise<{ added: number; error?: string }>;
  /** Android: background checks that send notifications while the app is closed. */
  phoneAlerts?: {
    sync(s: Settings): Promise<void>;
    permission(request?: boolean): Promise<string>;
  };
  catalogIndex(force?: boolean): Promise<CatalogIndex>;
  catalogCategory(id: string): Promise<CatalogCategory>;
}

declare const __APP_VERSION__: string;

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

// The Android app runs this same web build inside Capacitor. Its native HTTP layer
// (CapacitorHttp) handles fetch(), so sites that block browsers (CORS) still load.
const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
const RECAPS_URL = 'https://raw.githubusercontent.com/TASTTYCHEESE/Hardware-Tracker/main/recaps/';
const RELEASES_API = 'https://api.github.com/repos/TASTTYCHEESE/Hardware-Tracker/releases/latest';
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';

// In a browser, news sites usually refuse direct requests (CORS). The web version is
// published with a snapshot of the news feeds and exchange rates, refreshed every
// ~20 minutes by GitHub Actions (tools/web/snapshot.mjs), and falls back to it.
let snapshot: Promise<Record<string, string>> | null = null;
const snapshotIndex = () =>
  (snapshot ??= fetch(`snapshot/index.json?t=${Math.floor(Date.now() / 300e3)}`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((j: { files?: Record<string, string> }) => (j && typeof j.files === 'object' ? j.files : {}))
    .catch((): Record<string, string> => ({})));
setInterval(() => (snapshot = null), 10 * 60e3);

const newer = (a: string, b: string) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};

let lastUpdate: UpdateInfo | null = null;

// Background Runner (Android): runs public/runners/background.js every ~15 minutes, even when the app is closed.
type Runner = {
  dispatchEvent(o: { label: string; event: string; details: Record<string, unknown> }): Promise<unknown>;
  checkPermissions(): Promise<{ notifications?: string }>;
  requestPermissions(o: { apis: string[] }): Promise<{ notifications?: string }>;
};
const runner = (): Runner | undefined => (window as unknown as { Capacitor?: { Plugins?: { BackgroundRunner?: Runner } } }).Capacitor?.Plugins?.BackgroundRunner;
const RUNNER_LABEL = 'app.hardwaretracker.mobile.check';
const phoneAlerts: HwtApi['phoneAlerts'] = {
  async sync(s) {
    const r = runner();
    if (!r) return;
    const details = { notify: s.notify, morningSummary: s.morningSummary, watchlist: s.watchlist ?? [], dropWatchOn: !!s.dropWatchOn, dropWatch: s.dropWatch ?? [], newsKeywords: s.newsKeywords ?? [], syncUrl: s.syncUrl ?? '' };
    await r.dispatchEvent({ label: RUNNER_LABEL, event: 'syncSettings', details }).catch(() => {});
  },
  async permission(request) {
    const r = runner();
    if (!r) return 'unsupported';
    try {
      const st = request ? await r.requestPermissions({ apis: ['notifications'] }) : await r.checkPermissions();
      return st.notifications ?? 'prompt';
    } catch {
      return 'unsupported';
    }
  },
};

const webApi: HwtApi = {
  platform: native ? 'android' : 'web',
  phoneAlerts: native ? phoneAlerts : undefined,
  async fetchText(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    } catch (e) {
      if (native) throw e;
      const file = (await snapshotIndex())[url];
      if (!file) throw e;
      const r = await fetch(`snapshot/${file}`);
      if (!r.ok) throw e;
      return r.text();
    }
  },
  async readRecaps() {
    // Recaps come straight from the GitHub repo (the same folder the desktop app syncs).
    const s = await webApi.getSettings();
    const root = (s.syncUrl || RECAPS_URL).replace(/\/?$/, '/');
    try {
      const idx = await (await fetch(`${root}index.json?t=${Math.floor(Date.now() / 600e3)}`)).json();
      const files: string[] = (Array.isArray(idx) ? idx : idx.files || []).filter((f: string) => /^[\w.-]+\.json$/.test(f) && f !== 'index.json');
      const out = await Promise.all(
        files.map((f) =>
          fetch(`${root}${f}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ),
      );
      return out.filter(Boolean) as Recap[];
    } catch {
      return [];
    }
  },
  async appInfo() {
    return { version: APP_VERSION };
  },
  async updateInfo() {
    if (!native) return { state: 'unsupported', current: APP_VERSION, version: '', releaseName: '', releaseDate: '', notes: '', percent: 0, message: 'The web version is always the newest one. Reload the page to get updates.', lastCheck: 0 };
    return lastUpdate ?? webApi.checkForUpdates!();
  },
  async checkForUpdates() {
    const base: UpdateInfo = { state: 'none', current: APP_VERSION, version: '', releaseName: '', releaseDate: '', notes: '', percent: 0, message: '', lastCheck: Date.now() };
    if (!native) {
      // The web version is always the latest one: reloading the page updates it.
      lastUpdate = { ...base, message: 'The web version updates itself when you reload the page' };
      return lastUpdate;
    }
    try {
      const j = await (await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } })).json();
      const v = String(j.tag_name || '').replace(/^v/, '');
      lastUpdate =
        v && newer(v, APP_VERSION)
          ? { ...base, state: 'available', version: v, releaseName: j.name || '', releaseDate: j.published_at || '', notes: j.body || '', message: `Version ${v} is out` }
          : { ...base, message: `You're up to date (version ${APP_VERSION})` };
    } catch (e) {
      lastUpdate = { ...base, state: 'error', message: `Update check failed: ${(e as Error).message}` };
    }
    return lastUpdate;
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type Settings } from './platform';
import { translateArticles } from './translate';
import { DEFAULT_FEEDS, loadFeeds, type FeedResult } from './feeds';
import type { PriceAlert, PricePoint, Recap } from './types';
import { DEFAULT_WATCHLIST, latestFor } from './watch';
import seed from '../data/catchup-2026-11-24.json';

const SEED: Recap[] = [seed as Recap];
const FEED_REFRESH_MS = 30 * 60 * 1000;

export function useData() {
  const [settings, setSettingsState] = useState<Settings>({});
  const settingsRef = useRef<Settings>({});
  settingsRef.current = settings;
  const [fileRecaps, setFileRecaps] = useState<Recap[]>([]);
  const [feed, setFeed] = useState<FeedResult>({ articles: [], errors: [] });
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedUpdated, setFeedUpdated] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [archiveVersion, setArchiveVersion] = useState(0);

  const reloadRecaps = useCallback(async () => {
    try {
      setFileRecaps(await api.readRecaps());
    } catch {
      setFileRecaps([]);
    }
    setFilesLoaded(true);
  }, []);

  const feeds = useMemo(() => {
    const custom = settings.feeds;
    if (!custom || !custom.length) return DEFAULT_FEEDS;
    return custom.map((line) => {
      const [name, url] = line.includes('|') ? line.split('|').map((s) => s.trim()) : [new URL(line).hostname, line.trim()];
      return { name, url };
    });
  }, [settings.feeds]);

  const refreshFeeds = useCallback(async () => {
    setFeedLoading(true);
    try {
      const loaded = await loadFeeds(feeds);
      setFeed(loaded);
      // Then swap in English translations of non-English headlines.
      const result = settingsRef.current.translateNews === false ? loaded : { ...loaded, articles: await translateArticles(loaded.articles) };
      setFeed(result);
      setFeedUpdated(Date.now());
      try {
        await api.archiveArticles(result.articles);
        setArchiveVersion((v) => v + 1);
      } catch {
        /* archive is best effort */
      }
    } finally {
      setFeedLoading(false);
    }
  }, [feeds]);

  useEffect(() => {
    api.getSettings().then((st) => {
      setSettingsState(st);
      setSettingsLoaded(true);
    });
    reloadRecaps();
    return api.onDataChanged(reloadRecaps);
  }, [reloadRecaps]);

  useEffect(() => {
    refreshFeeds();
    const t = setInterval(refreshFeeds, FEED_REFRESH_MS);
    return () => clearInterval(t);
  }, [refreshFeeds]);

  const recaps = useMemo(() => {
    const byId = new Map<string, Recap>();
    for (const r of [...SEED, ...fileRecaps]) if (r && r.id) byId.set(r.id, r);
    return [...byId.values()].sort((a, b) => (a.date === b.date ? typeRank(b) - typeRank(a) : b.date.localeCompare(a.date)));
  }, [fileRecaps]);

  const prices = useMemo(() => {
    const key = (p: PricePoint) => `${p.model}|${p.region}|${p.date}|${p.price}`;
    const seen = new Set<string>();
    const out: PricePoint[] = [];
    for (const r of recaps) for (const p of r.prices ?? []) if (!seen.has(key(p)) && seen.add(key(p))) out.push(p);
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [recaps]);

  const alerts = useMemo(() => {
    const out: (PriceAlert & { date: string; recapId: string })[] = [];
    for (const r of recaps) for (const a of r.alerts ?? []) out.push({ ...a, date: r.date, recapId: r.id });
    return out;
  }, [recaps]);

  const watchlist = settings.watchlist ?? DEFAULT_WATCHLIST;
  const watchHits = useMemo(
    () => watchlist.filter((w) => {
      const p = latestFor(w, prices);
      return p && p.price <= w.target;
    }),
    [watchlist, prices],
  );

  // Store the starter watchlist so background notifications (main process) can see it.
  // Notifications for new recaps and price targets are sent by the main process.
  useEffect(() => {
    if (settingsLoaded && settings.watchlist === undefined) setSettings({ watchlist: DEFAULT_WATCHLIST });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded]);

  // Android: hand the alert settings to the background checker (it can't read the app's storage).
  useEffect(() => {
    if (!settingsLoaded || !api.phoneAlerts) return;
    api.phoneAlerts.sync(settings);
    // Ask for notification permission once, on the first start of the Android app.
    if (settings.notify !== false && !settings.askedNotify)
      api.phoneAlerts.permission().then((p) => {
        if (p === 'prompt' || p === 'prompt-with-rationale') api.phoneAlerts!.permission(true);
        setSettings({ askedNotify: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded, settings.notify, settings.morningSummary, settings.watchlist, settings.newsKeywords, settings.syncUrl, settings.dropWatchOn, settings.dropWatch]);

  async function setSettings(patch: Partial<Settings>) {
    setSettingsState(await api.setSettings(patch));
  }

  return {
    settings,
    setSettings,
    recaps,
    prices,
    alerts,
    feed,
    feedLoading,
    feedUpdated,
    refreshFeeds,
    reloadRecaps,
    feeds,
    archiveVersion,
    watchlist,
    watchHits,
    settingsLoaded,
  };
}

function typeRank(r: Recap) {
  return r.type === 'weekly' ? 2 : r.type === 'daily' ? 1 : 0;
}

export type AppData = ReturnType<typeof useData>;

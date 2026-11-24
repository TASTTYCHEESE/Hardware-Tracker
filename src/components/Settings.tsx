import { useEffect, useState } from 'react';
import type { AppData } from '../lib/useData';
import { api } from '../lib/platform';
import { DEFAULT_FEEDS } from '../lib/feeds';

export function SettingsPage({ data }: { data: AppData }) {
  const s = data.settings;
  const [feedsText, setFeedsText] = useState('');
  useEffect(() => {
    setFeedsText((s.feeds && s.feeds.length ? s.feeds : DEFAULT_FEEDS.map((f) => `${f.name} | ${f.url}`)).join('\n'));
  }, [s.feeds]);
  const desktop = api.platform === 'desktop';
  const [syncMsg, setSyncMsg] = useState('');
  const [updMsg, setUpdMsg] = useState('');
  const [info, setInfo] = useState<{ version: string; updateStatus?: string } | null>(null);
  useEffect(() => {
    api.appInfo?.().then(setInfo).catch(() => {});
  }, []);

  return (
    <div className="page narrow">
      <h1>Settings</h1>

      <section className="card">
        <h3>Recap folder</h3>
        <p className="muted small">
          The app reads daily and weekly recap files (<code>.json</code>) from the <code>recaps</code> folder inside this folder and
          picks up new ones automatically. Put it in a synced folder (OneDrive, Dropbox, Google Drive) if you want recaps to show up
          on their own.
        </p>
        <div className="row">
          <code className="path">{s.dataDir ?? '(browser storage)'}</code>
        </div>
        {desktop && (
          <div className="row">
            <button className="btn small" onClick={async () => {
              const dir = await api.chooseFolder();
              if (dir) {
                await data.setSettings({ dataDir: dir });
                data.reloadRecaps();
              }
            }}>
              Change folder
            </button>
            <button className="btn small ghost" onClick={() => api.openFolder()}>
              Open folder
            </button>
            <button className="btn small ghost" onClick={async () => {
              if (await api.importRecaps()) data.reloadRecaps();
            }}>
              Import recap files…
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h3>Notifications</h3>
        <label className="check">
          <input type="checkbox" checked={s.notify !== false} onChange={(e) => data.setSettings({ notify: e.target.checked })} />
          Notify me about new recaps, price drops and tracked items hitting my target
        </label>
        <label className="check">
          <input type="checkbox" checked={s.morningSummary !== false} onChange={(e) => data.setSettings({ morningSummary: e.target.checked })} />
          Morning summary: a notification with today's TL;DR (after 8:10)
        </label>
      </section>

      {desktop && (
        <section className="card">
          <h3>Background mode</h3>
          <p className="muted small">
            When the window is closed the app keeps running as a small tray icon (bottom right, next to the clock) so it can deliver
            recaps and alerts. The window is fully unloaded, so it uses very little memory and almost no CPU.
          </p>
          <label className="check">
            <input type="checkbox" checked={s.closeToTray !== false} onChange={(e) => data.setSettings({ closeToTray: e.target.checked })} />
            Keep running in the tray when I close the window
          </label>
          <label className="check">
            <input type="checkbox" checked={s.startWithWindows !== false} onChange={(e) => data.setSettings({ startWithWindows: e.target.checked })} />
            Start with Windows (quietly, in the tray)
          </label>
          <label className="check">
            <input type="checkbox" checked={s.autoQuitWhenBusy !== false} onChange={(e) => data.setSettings({ autoQuitWhenBusy: e.target.checked })} />
            Close automatically when the PC is busy (CPU above 85% or memory almost full for 3 minutes, e.g. while gaming). Only happens
            while the window is closed.
          </label>
          {s.lastAutoQuit ? (
            <p className="muted small">
              Last auto-close: {new Date(s.lastAutoQuit).toLocaleString()} ({s.lastAutoQuitReason}).
            </p>
          ) : null}
        </section>
      )}

      {desktop && (
        <section className="card">
          <h3>Recap sync</h3>
          <p className="muted small">
            New daily and weekly recaps are downloaded automatically every hour from this address (a folder with an <code>index.json</code>).
            Leave it empty to use your GitHub repo (TASTTYCHEESE/Hardware-Tracker).
          </p>
          <input
            className="input wide"
            placeholder="https://raw.githubusercontent.com/TASTTYCHEESE/Hardware-Tracker/main/recaps/ (default)"
            defaultValue={s.syncUrl ?? ''}
            onBlur={(e) => data.setSettings({ syncUrl: e.target.value.trim() })}
          />
          <div className="row">
            <button className="btn small" onClick={async () => {
              const r = await api.syncNow?.();
              setSyncMsg(r ? (r.error ? `Sync failed: ${r.error}` : `Synced. ${r.added} new file(s).`) : '');
              data.reloadRecaps();
            }}>
              Sync now
            </button>
            <span className="muted small">
              {syncMsg || (s.lastSync ? `Last sync ${new Date(s.lastSync).toLocaleString()}${s.lastSyncError ? ` (failed: ${s.lastSyncError})` : ''}` : '')}
            </span>
          </div>
        </section>
      )}

      {desktop && (
        <section className="card">
          <h3>Updates</h3>
          <p className="muted small">The installed app checks GitHub for new versions every 6 hours, downloads them in the background and installs them when you quit.</p>
          <div className="row">
            <span>Version {info?.version ?? '…'}</span>
            <button className="btn small ghost" onClick={async () => setUpdMsg((await api.checkForUpdates?.()) ?? '')}>
              Check for updates
            </button>
            <span className="muted small">{updMsg || info?.updateStatus}</span>
          </div>
        </section>
      )}

      <section className="card">
        <h3>News sources</h3>
        <p className="muted small">One RSS or Atom feed per line, as <code>Name | URL</code>. Refreshes every 30 minutes.</p>
        <textarea rows={9} value={feedsText} onChange={(e) => setFeedsText(e.target.value)} spellCheck={false} />
        <div className="row">
          <button className="btn small" onClick={() => data.setSettings({ feeds: feedsText.split('\n').map((l) => l.trim()).filter(Boolean) })}>
            Save feeds
          </button>
          <button className="btn small ghost" onClick={() => data.setSettings({ feeds: [] })}>
            Reset to defaults
          </button>
        </div>
        {data.feed.errors.length > 0 && (
          <ul className="muted small">
            {data.feed.errors.map((e) => (
              <li key={e.name}>
                {e.name}: {e.error}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="muted small">Hardware Tracker {info?.version ?? ''} · {api.platform} build</p>
    </div>
  );
}

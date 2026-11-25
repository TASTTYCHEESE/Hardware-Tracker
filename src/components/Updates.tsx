import { useState } from 'react';
import DOMPurify from 'dompurify';
import type { AppData } from '../lib/useData';
import { api, installAndroidUpdate, type UpdateInfo } from '../lib/platform';
import changelog from '../changelog.json';

type Entry = { version: string; date: string; title: string; notes: string[] };
const LOG = changelog as Entry[];

const fmtDay = (d: string) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** Release notes come as HTML (GitHub) or Markdown (latest.yml). */
function Notes({ text }: { text: string }) {
  if (!text.trim()) return null;
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return <div className="upd-notes" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(text, { FORBID_TAGS: ['img', 'style', 'script', 'iframe'] }) }} />;
  }
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const bold = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
  const bullets = lines.filter((l) => /^[-*] /.test(l));
  return (
    <div className="upd-notes">
      {lines.filter((l) => !/^[-*] /.test(l)).map((l, i) => (
        <p key={i}>{bold(l.replace(/^#+\s*/, ''))}</p>
      ))}
      {bullets.length > 0 && (
        <ul>
          {bullets.map((l, i) => (
            <li key={i}>{bold(l.slice(2))}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EntryNotes({ e }: { e: Entry }) {
  return (
    <div className="upd-notes">
      <p>
        <strong>{e.title}</strong> <span className="muted small">· {fmtDay(e.date)}</span>
      </p>
      <ul>
        {e.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

export function Updates({ data, info, setInfo }: { data: AppData; info: UpdateInfo | null; setInfo: (i: UpdateInfo) => void }) {
  const s = data.settings;
  const auto = s.autoInstallUpdates !== false;
  const [busy, setBusy] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const current = info?.current ?? '';
  const mine = LOG.find((e) => e.version === current);
  const older = LOG.filter((e) => e.version !== current && (!info?.version || e.version !== info.version));
  const pending = info && (info.state === 'ready' || info.state === 'downloading' || info.state === 'available');
  // Notes for the new version: from the release itself, or from our own changelog if we know it.
  const known = info?.version ? LOG.find((e) => e.version === info.version) : undefined;

  const check = async () => {
    setBusy(true);
    try {
      const r = await api.checkForUpdates?.();
      if (r) setInfo(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <h1>Updates</h1>

      {pending ? (
        <section className="card upd-hero">
          <div className="upd-head">
            <div>
              <div className="muted small">{info.state === 'ready' ? 'Ready to install' : info.state === 'available' ? 'New version' : 'Downloading'}</div>
              <h2>Version {info.version}</h2>
              {info.releaseDate && <div className="muted small">Released {fmtDay(info.releaseDate)}</div>}
            </div>
            {info.state === 'available' && api.platform === 'android' && (
              <button className="btn" onClick={() => installAndroidUpdate()}>
                Install update
              </button>
            )}
            {info.state === 'available' && api.platform !== 'android' && (
              <a className="btn" href={`https://github.com/TASTTYCHEESE/Hardware-Tracker/releases/tag/v${info.version}`}>
                Download
              </a>
            )}
            {info.state === 'ready' && api.platform !== 'android' && (
              <button
                className="btn"
                disabled={restarting}
                onClick={async () => {
                  setRestarting(true);
                  if (!(await api.restartToUpdate?.())) setRestarting(false);
                }}
              >
                {restarting ? 'Restarting…' : 'Restart and update'}
              </button>
            )}
          </div>
          {info.state === 'downloading' && (
            <div className="upd-bar" aria-label={`${info.percent}% downloaded`}>
              <div style={{ width: `${Math.max(3, info.percent)}%` }} />
            </div>
          )}
          <h3 className="upd-sub">What this update adds</h3>
          {info.notes ? <Notes text={info.notes} /> : known ? <EntryNotes e={known} /> : <p className="muted small">No summary was published for this version.</p>}
          {api.platform === 'android' && info.message && <p className="small upd-msg">{info.message}</p>}
          <p className="muted small">
            {api.platform === 'android'
              ? auto
                ? 'With Update automatically on, updates download and install by themselves when you leave the app (Android 12 and newer). Android asks you once to allow installing updates and to confirm the first one. Your settings are kept.'
                : 'Tap Install update to download it and install it over this version. Your settings are kept.'
              : info.state === 'ready'
              ? auto
                ? 'It also installs by itself the next time you quit the app. The app restarts in a few seconds and keeps all your settings.'
                : "It won't install until you click Restart and update. The app restarts in a few seconds and keeps all your settings."
              : info.state === 'available'
                ? 'Mac apps from outside the App Store can\'t update themselves without a paid Apple certificate. Download the .dmg for your Mac (arm64 for Apple Silicon, x64 for Intel) and drag the app into Applications. Your settings are kept.'
                : 'You can keep using the app while it downloads.'}
          </p>
        </section>
      ) : (
        <section className="card">
          <div className="upd-head">
            <div>
              <h2>{info?.state === 'none' ? "You're up to date" : info?.state === 'error' ? "Couldn't check for updates" : info?.state === 'checking' ? 'Checking…' : 'Updates'}</h2>
              <div className="muted small">
                {info?.state === 'none' ? `Version ${current}` : info?.message}
                {info?.lastCheck ? ` · last checked ${new Date(info.lastCheck).toLocaleString()}` : ''}
              </div>
            </div>
            {info?.state !== 'unsupported' && (
              <button className="btn small ghost" disabled={busy || info?.state === 'checking'} onClick={check}>
                {busy ? 'Checking…' : 'Check now'}
              </button>
            )}
          </div>
        </section>
      )}

      {(api.platform === 'desktop' || api.platform === 'android') && info?.state !== 'unsupported' && (
      <section className="card">
        <h3>How to install updates</h3>
        <label className="check">
          <input type="checkbox" checked={auto} onChange={(e) => data.setSettings({ autoInstallUpdates: e.target.checked })} />
          <span>
            Update automatically
            <div className="muted small">
              {api.platform === 'android'
                ? auto
                  ? 'New versions download and install by themselves when you leave the app. The first time, Android asks you to allow it and to confirm.'
                  : 'New versions only install when you tap Install update here.'
                : auto
                  ? 'New versions download in the background and install by themselves the next time you quit the app.'
                  : 'New versions download in the background, but only install when you click Restart and update here.'}
            </div>
          </span>
        </label>
        <p className="muted small">The app checks GitHub for new versions when it starts and every 6 hours after that, and notifies you when one is ready.</p>
      </section>
      )}

      <section className="card">
        <h3>Your version: {current || '…'}</h3>
        {mine ? <EntryNotes e={mine} /> : <p className="muted small">Installed version {current}.</p>}
        {older.length > 0 && (
          <details className="upd-older">
            <summary className="muted small">Earlier versions</summary>
            {older.map((e) => (
              <div key={e.version}>
                <h4>Version {e.version}</h4>
                <EntryNotes e={e} />
              </div>
            ))}
          </details>
        )}
      </section>
    </div>
  );
}

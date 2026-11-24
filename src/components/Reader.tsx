import { createElement, useEffect, useState } from 'react';
import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';
import { api } from '../lib/platform';

type Mode = 'reader' | 'web';
interface Parsed {
  title: string;
  byline?: string | null;
  site?: string | null;
  html: string;
}

/** In-app article viewer: a clean "Reader" view, the full web page, or hand-off to the browser. */
export function Reader({ url, onClose, onNavigate }: { url: string; onClose: () => void; onNavigate: (u: string) => void }) {
  const [mode, setMode] = useState<Mode>('reader');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setParsed(null);
    setMode('reader');
    (async () => {
      try {
        const html = await api.fetchText(url);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const base = doc.createElement('base');
        base.href = url;
        doc.head.prepend(base);
        const article = new Readability(doc).parse();
        if (!article?.content || (article.textContent ?? '').trim().length < 200) throw new Error('not an article');
        const clean = DOMPurify.sanitize(article.content, { FORBID_TAGS: ['style', 'form', 'iframe'], FORBID_ATTR: ['style'] });
        if (!cancelled) {
          setParsed({ title: article.title ?? '', byline: article.byline, site: article.siteName, html: clean });
          setState('ok');
        }
      } catch {
        // Paywalls, heavy JS sites etc.: show the real page instead.
        if (!cancelled) {
          setState('failed');
          setMode('web');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* keep raw */
  }

  return (
    <div className="reader">
      <div className="reader-bar">
        <button className="btn small ghost" onClick={onClose} title="Back (Esc)">
          ← Back
        </button>
        <span className="reader-host muted small">{host}</span>
        <div className="tabs">
          <button className={mode === 'reader' ? 'tab active' : 'tab'} onClick={() => setMode('reader')} disabled={state === 'failed'}>
            Reader
          </button>
          <button className={mode === 'web' ? 'tab active' : 'tab'} onClick={() => setMode('web')}>
            Web page
          </button>
        </div>
        <button className="btn small ghost" onClick={() => window.open(url, '_blank')} title="Open in your normal browser">
          Open in browser ↗
        </button>
      </div>

      {mode === 'reader' && (
        <div className="reader-scroll">
          {state === 'loading' && <p className="muted reader-msg">Loading article…</p>}
          {state === 'ok' && parsed && (
            <article
              className="reader-article"
              onClick={(e) => {
                const a = (e.target as HTMLElement).closest('a');
                if (a && /^https?:/.test(a.href)) {
                  e.preventDefault();
                  e.stopPropagation();
                  onNavigate(a.href);
                }
              }}
            >
              {parsed.site && <div className="muted small">{parsed.site}</div>}
              <h1>{parsed.title}</h1>
              {parsed.byline && <div className="muted small">{parsed.byline}</div>}
              <div dangerouslySetInnerHTML={{ __html: parsed.html }} />
            </article>
          )}
        </div>
      )}

      {mode === 'web' &&
        (api.platform === 'desktop' ? (
          createElement('webview', { src: url, partition: 'persist:reader', className: 'reader-web' })
        ) : (
          <div className="reader-scroll">
            <p className="muted reader-msg">
              This page can't be shown here.{' '}
              <a href={url} target="_blank" rel="noreferrer">
                Open it in a new tab
              </a>
              .
            </p>
          </div>
        ))}
    </div>
  );
}

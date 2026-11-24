import { createElement, useEffect, useState } from 'react';
import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';
import { api } from '../lib/platform';
import { langName, looksEnglish, originalUrl, translateHtml, translatedPage } from '../lib/translate';

type Mode = 'reader' | 'web';
interface Parsed {
  title: string;
  byline?: string | null;
  site?: string | null;
  html: string;
}

/** In-app article viewer: a clean "Reader" view, the full web page, or hand-off to the browser. */
export function Reader({ url: rawUrl, onClose, onNavigate, translate = true }: { url: string; onClose: () => void; onNavigate: (u: string) => void; translate?: boolean }) {
  // Translation-proxy links are read from the original site and translated here.
  const url = originalUrl(rawUrl);
  const wantTranslate = translate || url !== rawUrl;
  const [mode, setMode] = useState<Mode>('reader');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [foreign, setForeign] = useState(false);
  const [tr, setTr] = useState<{ title: string; html: string; lang: string } | 'working' | null>(null);
  const [showOrig, setShowOrig] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setParsed(null);
    setMode('reader');
    setForeign(false);
    setTr(null);
    setShowOrig(false);
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
        // Not in English: translate the whole article (names that can't be translated stay as they are).
        const sample = `${article.title ?? ''} ${(article.textContent ?? '').slice(0, 4000)}`;
        if (wantTranslate && !looksEnglish(sample)) {
          if (!cancelled) {
            setForeign(true);
            setTr('working');
          }
          // The title goes along with the article in the same requests.
          const head = document.createElement('h1');
          head.textContent = article.title ?? '';
          const h = await translateHtml(`<header data-hwt-title>${head.outerHTML}</header>${clean}`);
          const d = new DOMParser().parseFromString(`<div>${h.html}</div>`, 'text/html');
          const th = d.querySelector('[data-hwt-title]');
          const title = th?.textContent?.trim() || article.title || '';
          th?.remove();
          if (!cancelled) setTr(h.lang && h.lang !== 'en' ? { title, html: d.body.firstElementChild?.innerHTML ?? h.html, lang: h.lang } : null);
        }
      } catch {
        if (!cancelled && wantTranslate && url !== rawUrl) setForeign(true);
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
  }, [url, wantTranslate, rawUrl]);

  const translated = tr && tr !== 'working' && !showOrig ? tr : null;
  // The web page and the browser get Google's translated copy when the article isn't in English.
  const pageUrl = foreign && !showOrig ? translatedPage(url) : url;

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
        <button className="btn small ghost" onClick={() => window.open(pageUrl, '_blank')} title="Open in your normal browser">
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
              {tr === 'working' && <div className="reader-tr muted small">Translating to English…</div>}
              {tr && tr !== 'working' && (
                <div className="reader-tr muted small">
                  {showOrig ? `Original (${langName(tr.lang)})` : `Translated from ${langName(tr.lang)}`} ·{' '}
                  <button className="link small" onClick={() => setShowOrig(!showOrig)}>
                    {showOrig ? 'Show in English' : 'Show original'}
                  </button>
                </div>
              )}
              <h1>{translated ? translated.title : parsed.title}</h1>
              {parsed.byline && <div className="muted small">{parsed.byline}</div>}
              <div dangerouslySetInnerHTML={{ __html: translated ? translated.html : parsed.html }} />
            </article>
          )}
        </div>
      )}

      {mode === 'web' &&
        (api.platform === 'desktop' ? (
          createElement('webview', { src: pageUrl, partition: 'persist:reader', className: 'reader-web' })
        ) : (
          <div className="reader-scroll">
            <p className="muted reader-msg">
              This page can't be shown here.{' '}
              <a href={pageUrl} target="_blank" rel="noreferrer">
                Open it in a new tab
              </a>
              .
            </p>
          </div>
        ))}
    </div>
  );
}

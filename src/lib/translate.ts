// Non-English headlines (e.g. ComputerBase) are translated to English with Google Translate's
// public web endpoint (no account or key). Translations are cached on this computer.
import { api } from './platform';
import { classify } from './feeds';
import type { FeedArticle } from './types';

const EN = new Set('the and for with to of is on in new its now will are from gets this that how why what after more than first'.split(' '));
const OTHER = new Set(
  'der die das und mit für ist nicht auf ein eine im zum zur bei von neue neuer wird sind auch nach über les des une est pour avec dans sur el los las con para del una il della per nie się jest oraz'.split(' '),
);

/** Rough language check: is this text English? */
export function looksEnglish(text: string): boolean {
  if (/[Ѐ-ӿ぀-ヿ一-鿿가-힯]/.test(text)) return false;
  const words = text.toLowerCase().match(/[a-zäöüßéèàçñąęłńóśźż]+/g) ?? [];
  let en = 0;
  let other = 0;
  for (const w of words) {
    if (EN.has(w)) en++;
    else if (OTHER.has(w)) other++;
  }
  if (/[äöüß]/i.test(text)) other++;
  return en >= other;
}

const KEY = 'hwt-translations';
type Cache = Record<string, { t: string; s: string; lang: string }>;
function readCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}
function writeCache(c: Cache) {
  try {
    const keys = Object.keys(c);
    const trimmed = keys.length > 800 ? Object.fromEntries(keys.slice(-800).map((k) => [k, c[k]])) : c;
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full or blocked: just don't cache */
  }
}

async function translateChunk(text: string): Promise<{ text: string; lang: string }> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  // Google sometimes asks busy clients to slow down: wait a moment and try again.
  let j: unknown[] | null = null;
  for (let attempt = 0; ; attempt++) {
    try {
      j = JSON.parse(await api.fetchText(url));
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 1200 * 2 ** attempt));
    }
  }
  if (!j) throw new Error('no translation');
  const out = (j[0] as [string][]).map((p) => p[0]).join('');
  return { text: out, lang: typeof j[2] === 'string' ? j[2] : '' };
}

/** Split long text at sentence ends so every request stays small. */
function chunks(text: string, max = 1400): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = Math.max(rest.lastIndexOf('. ', max), rest.lastIndexOf('! ', max), rest.lastIndexOf('? ', max), rest.lastIndexOf('\n', max));
    if (cut < max / 3) cut = rest.lastIndexOf(' ', max);
    if (cut < max / 3) cut = max;
    out.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest) out.push(rest);
  return out;
}

async function translateText(text: string): Promise<{ text: string; lang: string }> {
  let lang = '';
  const parts: string[] = [];
  for (const c of chunks(text)) {
    const r = await translateChunk(c);
    lang = lang || r.lang;
    parts.push(r.text);
  }
  return { text: parts.join(' '), lang };
}

/** The same page through Google's translation proxy (www.site.de/x -> www-site-de.translate.goog/x), translated to English. */
export function translatedPage(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('.translate.goog')) return url;
    u.hostname = `${u.hostname.replace(/-/g, '--').replace(/\./g, '-')}.translate.goog`;
    for (const [k, v] of [['_x_tr_sl', 'auto'], ['_x_tr_tl', 'en'], ['_x_tr_hl', 'en'], ['_x_tr_pto', 'wapp']]) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return url;
  }
}

/** The original address behind a translation-proxy link. */
export function originalUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'translate.google.com' && u.searchParams.get('u')) return u.searchParams.get('u')!;
    if (!u.hostname.endsWith('.translate.goog')) return url;
    u.hostname = u.hostname.slice(0, -'.translate.goog'.length).replace(/--/g, '\u0000').replace(/-/g, '.').replace(/\u0000/g, '-');
    for (const k of [...u.searchParams.keys()]) if (k.startsWith('_x_tr_')) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Translate a whole article (sanitized HTML) to English, text node by text node, so links,
 * pictures and layout stay. Names that have no translation are left as they are by Google.
 */
export async function translateHtml(html: string): Promise<{ html: string; lang: string }> {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  // Whole paragraphs, headings and list items are translated as one sentence block, so the
  // English reads naturally (a link inside a paragraph becomes plain text). Anything else is
  // translated piece by piece so pictures and layout stay.
  type Unit = { data: string; set: (t: string) => void };
  const units: Unit[] = [];
  const BLOCK = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, figcaption, td, th, dd, dt, caption';
  const blocks = new Set<Element>();
  for (const el of root.querySelectorAll(BLOCK)) {
    if (el.querySelector(`img, picture, video, iframe, table, pre, code, ${BLOCK}`)) continue;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!/\p{L}{2,}/u.test(text)) continue;
    blocks.add(el);
    units.push({ data: text, set: (t) => (el.textContent = t.trim()) });
  }
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    if (!/\p{L}{2,}/u.test(n.data) || n.parentElement?.closest('pre, code')) continue;
    let inBlock = false;
    for (let e: Element | null = n.parentElement; e && e !== root; e = e.parentElement) if (blocks.has(e)) inBlock = true;
    if (!inBlock) units.push({ data: n.data, set: (t) => (n.data = `${/^\s/.test(n.data) ? ' ' : ''}${t.trim()}${/\s$/.test(n.data) ? ' ' : ''}`) });
  }
  const SEP = '\n⁂\n';
  const batches: Unit[][] = [];
  let cur: Unit[] = [];
  let len = 0;
  for (const n of units) {
    if (cur.length && len + n.data.length > 1200) {
      batches.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(n);
    len += n.data.length + SEP.length;
  }
  if (cur.length) batches.push(cur);
  let lang = '';
  let i = 0;
  const worker = async () => {
    while (i < batches.length) {
      const b = batches[i++];
      try {
        const r = await translateText(b.map((n) => n.data.trim()).join(SEP));
        lang = lang || r.lang;
        const parts = r.text.split(/\s*⁂\s*/);
        if (parts.length === b.length) b.forEach((n, k) => n.set(parts[k]));
        else for (const n of b) n.set((await translateText(n.data.trim())).text);
      } catch {
        /* offline or blocked: that part stays in the original language */
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { html: root.innerHTML, lang };
}

/** Translate one short string (e.g. a title). */
export async function translateLine(text: string): Promise<string> {
  try {
    return (await translateText(text)).text || text;
  } catch {
    return text;
  }
}


const LANGS: Record<string, string> = { de: 'German', fr: 'French', es: 'Spanish', it: 'Italian', pl: 'Polish', nl: 'Dutch', ja: 'Japanese', zh: 'Chinese', 'zh-CN': 'Chinese', ko: 'Korean', pt: 'Portuguese', ru: 'Russian', bg: 'Bulgarian', cs: 'Czech', tr: 'Turkish' };
export const langName = (l?: string) => (l ? LANGS[l] ?? l.toUpperCase() : '');

/** Translate the non-English articles (title + summary), a few at a time. */
export async function translateArticles(articles: FeedArticle[]): Promise<FeedArticle[]> {
  const cache = readCache();
  const todo = articles.filter((a) => !cache[a.id] && !looksEnglish(`${a.title} ${a.summary}`)).slice(0, 80);
  const SEP = '\n\n⁂\n\n';
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const a = todo[i++];
      try {
        const r = await translateText(a.summary ? `${a.title}${SEP}${a.summary}` : a.title);
        const [t, s = ''] = r.text.split(/\s*⁂\s*/);
        if (r.lang && r.lang !== 'en' && t) cache[a.id] = { t: t.trim(), s: s.trim(), lang: r.lang };
      } catch {
        /* offline or blocked: keep the original */
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (todo.length) writeCache(cache);
  return articles.map((a) => {
    const c = cache[a.id];
    if (!c) return a;
    return {
      ...a,
      title: c.t,
      summary: c.s || a.summary,
      lang: c.lang,
      origTitle: a.title,
      origLink: a.link,
      link: a.link ? translatedPage(a.link) : a.link,
      category: classify(`${c.t} ${c.s}`),
    };
  });
}

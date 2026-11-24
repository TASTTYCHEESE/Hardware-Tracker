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

async function translateText(text: string): Promise<{ text: string; lang: string }> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text.slice(0, 1800))}`;
  const j = JSON.parse(await api.fetchText(url));
  const out = (j[0] as [string][]).map((p) => p[0]).join('');
  return { text: out, lang: typeof j[2] === 'string' ? j[2] : '' };
}

export const translatedPage = (url: string) => `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(url)}`;

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

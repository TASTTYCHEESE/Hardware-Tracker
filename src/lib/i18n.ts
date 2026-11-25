/// <reference types="vite/client" />
// App language. The app is written in English; other languages are applied on top of the
// rendered page: every visible text (and placeholder / tooltip) is looked up in a ready-made
// dictionary (src/i18n/<lang>.json, made by tools/i18n/build.cjs), and anything not in it
// (news, recaps, new text) is translated with Google Translate's public endpoint and cached.
// Elements with translate="no" or class "notranslate" are left alone.
import { api } from './platform';

/** Languages, most spoken first (total speakers, Ethnologue 2025). English is the default. */
export const LANGS: { code: string; name: string; english: string }[] = [
  { code: 'en', name: 'English', english: 'English' },
  { code: 'zh-CN', name: '中文 (简体)', english: 'Chinese' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi' },
  { code: 'es', name: 'Español', english: 'Spanish' },
  { code: 'fr', name: 'Français', english: 'French' },
  { code: 'pt', name: 'Português', english: 'Portuguese' },
  { code: 'ru', name: 'Русский', english: 'Russian' },
  { code: 'id', name: 'Bahasa Indonesia', english: 'Indonesian' },
  { code: 'de', name: 'Deutsch', english: 'German' },
  { code: 'ja', name: '日本語', english: 'Japanese' },
  { code: 'tr', name: 'Türkçe', english: 'Turkish' },
  { code: 'vi', name: 'Tiếng Việt', english: 'Vietnamese' },
  { code: 'ko', name: '한국어', english: 'Korean' },
  { code: 'it', name: 'Italiano', english: 'Italian' },
  { code: 'pl', name: 'Polski', english: 'Polish' },
  { code: 'uk', name: 'Українська', english: 'Ukrainian' },
  { code: 'nl', name: 'Nederlands', english: 'Dutch' },
  { code: 'bg', name: 'Български', english: 'Bulgarian' },
];

const dictionaries = import.meta.glob<{ default: Record<string, string> }>('../i18n/*.json');

const ATTRS = ['placeholder', 'title', 'aria-label'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT', 'svg', 'SVG']);
const PHONE = typeof window !== 'undefined' ? window.matchMedia('(max-width: 760px)') : null;

/** Text worth translating: has words, and isn't just a product name, model number or value. */
export function translatable(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || !/\p{L}{2}/u.test(t)) return false;
  if (/^https?:\/\//.test(t)) return false;
  // "GeForce RTX 5070 Laptop GPU", "DDR5-6000 2x16GB", "Ryzen 7 9800X3D": every word capitalised or a number.
  if (/\d/.test(t) && t.split(/\s+/).every((w) => /^[^\p{Ll}]/u.test(w) || /\d/.test(w))) return false;
  return true;
}

let lang = 'en';
let dict: Record<string, string> = {};
let cache: Record<string, string> = {};
const orig = new WeakMap<Node, string>(); // text node -> its English text
const applied = new WeakMap<Node, string>(); // text node -> what we wrote into it
const attrOrig = new WeakMap<Element, Record<string, string>>();
const attrApplied = new WeakMap<Element, Record<string, string>>();
let observer: MutationObserver | null = null;
const pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const cacheKey = (l: string) => `hwt-i18n-${l}`;
function loadCache(l: string) {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(l)) || '{}');
  } catch {
    return {};
  }
}
function saveCache() {
  try {
    const keys = Object.keys(cache);
    if (keys.length > 4000) cache = Object.fromEntries(keys.slice(-3000).map((k) => [k, cache[k]]));
    localStorage.setItem(cacheKey(lang), JSON.stringify(cache));
  } catch {
    /* storage full */
  }
}

/** Phones show "Laptop" where wider screens say "Laptop GPU". */
const shorten = (s: string) => (PHONE?.matches ? s.replace(/\bLaptop GPU\b/g, 'Laptop') : s);

function lookup(text: string): string | null {
  const core = text.trim();
  if (lang === 'en' || !translatable(core)) return null;
  const hit = dict[core] ?? cache[core];
  if (hit === undefined) {
    if (core.length <= 4000) {
      pending.add(core);
      scheduleFlush();
    }
    return null;
  }
  const lead = text.match(/^\s*/)![0];
  const tail = text.match(/\s*$/)![0];
  return lead + hit + tail;
}

function skipped(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName)) return true;
    if (e.getAttribute('translate') === 'no' || e.classList.contains('notranslate')) return true;
  }
  return false;
}

function doText(node: Text) {
  const cur = node.nodeValue ?? '';
  if (applied.get(node) === cur) return; // our own write
  orig.set(node, cur);
  if (skipped(node.parentElement)) return;
  const out = shorten(lookup(cur) ?? cur);
  if (out !== cur) {
    applied.set(node, out);
    node.nodeValue = out;
  } else applied.delete(node);
}

function doAttrs(el: Element) {
  if (skipped(el)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v === null) continue;
    const ap = attrApplied.get(el) ?? {};
    if (ap[a] === v) continue;
    const o = attrOrig.get(el) ?? {};
    o[a] = v;
    attrOrig.set(el, o);
    const out = lookup(v);
    if (out !== null && out !== v) {
      ap[a] = out;
      attrApplied.set(el, ap);
      el.setAttribute(a, out);
    }
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (SKIP_TAGS.has(el.tagName)) return;
  doAttrs(el);
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
    else doAttrs(n as Element);
  }
}

/** Put every node back to its English text. */
function restore() {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const o = orig.get(n);
      if (o !== undefined && applied.get(n) === n.nodeValue) {
        applied.delete(n);
        n.nodeValue = o;
      }
    } else {
      const el = n as Element;
      const o = attrOrig.get(el);
      const ap = attrApplied.get(el);
      if (o && ap) for (const a of Object.keys(ap)) if (el.getAttribute(a) === ap[a]) el.setAttribute(a, o[a]);
      attrApplied.delete(el);
    }
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 250);
}

async function gt(text: string, to: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
  const j = JSON.parse(await api.fetchText(url));
  return (j[0] as [string][]).map((p) => p[0]).join('');
}

/** Translate the queued texts in batches (one line each) and re-apply them to the page. */
async function flush() {
  flushTimer = null;
  const to = lang;
  const items = [...pending].filter((s) => !(s in cache) && !(s in dict));
  pending.clear();
  if (!items.length || to === 'en') return;
  const batches: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const s of items) {
    if (cur.length && (len + s.length > 1500 || cur.length >= 40)) {
      batches.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(s);
    len += s.length + 1;
  }
  if (cur.length) batches.push(cur);
  for (const b of batches) {
    if (lang !== to) return;
    try {
      const multi = b.some((s) => s.includes('\n'));
      let out: string[] | null = null;
      if (!multi && b.length > 1) {
        const lines = (await gt(b.join('\n'), to)).split('\n');
        if (lines.length === b.length) out = lines;
      }
      if (!out) out = await Promise.all(b.map((s) => gt(s, to)));
      const cap = (src: string, t: string) => (/^\p{Lu}/u.test(src) && /^\p{Ll}/u.test(t) ? t[0].toUpperCase() + t.slice(1) : t);
      b.forEach((s, i) => (cache[s] = cap(s, out![i].trim()) || s));
    } catch {
      b.forEach((s) => (cache[s] = cache[s] ?? s)); // offline or rate-limited: keep English for now
      setTimeout(() => b.forEach((s) => delete cache[s]), 60_000);
    }
  }
  if (lang !== to) return;
  saveCache();
  walk(document.body);
}

function observe() {
  observer?.disconnect();
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') doText(r.target as Text);
      else if (r.type === 'attributes') doAttrs(r.target as Element);
      else r.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/** Switch the whole app to a language ('en' = English, no translation). */
export async function setLanguage(code: string) {
  const next = LANGS.some((l) => l.code === code) ? code : 'en';
  if (next === lang && observer) return;
  restore();
  lang = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem('hwt-lang', next);
  } catch {
    /* ignore */
  }
  dict = {};
  cache = next === 'en' ? {} : loadCache(next);
  if (next !== 'en') {
    const load = dictionaries[`../i18n/${next}.json`];
    if (load) dict = (await load().catch(() => ({ default: {} }))).default;
  }
  if (lang !== next) return;
  walk(document.body);
  observe();
  listeners.forEach((f) => f());
}

export const currentLanguage = () => lang;
export function onLanguage(f: () => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

// Phones: re-apply the "Laptop" short form when the screen size changes.
PHONE?.addEventListener('change', () => {
  restore();
  walk(document.body);
});

// PC Hardware catalog: downloads catalog/*.json from the GitHub repo on demand
// and keeps a copy in <data folder>/catalog so it also works offline. The repo
// rebuilds the catalog twice a week; refresh() pulls new versions of every
// category the user has opened, so the app updates itself.
const { net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/TASTTYCHEESE/Hardware-Tracker/main/catalog/';
const CHECK_EVERY = 12 * 3600e3;
const SAFE_ID = /^[a-z0-9-]{1,40}$/;

function create({ readSettings, patchSettings, dataDir }) {
  const dir = () => {
    const d = path.join(dataDir(), 'catalog');
    fs.mkdirSync(d, { recursive: true });
    return d;
  };
  const base = () => {
    const u = (readSettings().catalogUrl || DEFAULT_CATALOG_URL).trim();
    return u.endsWith('/') ? u : `${u}/`;
  };
  const readJson = (f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir(), f), 'utf8'));
    } catch {
      return null;
    }
  };
  async function fetchText(url) {
    const r = await net.fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }
  // Which catalog version each cached category file came from.
  const versions = () => readJson('versions.json') || {};
  const saveVersions = (v) => fs.writeFileSync(path.join(dir(), 'versions.json'), JSON.stringify(v));

  /** Index of all categories. Re-downloaded at most every 12 hours unless forced. */
  async function index(force = false) {
    const cached = readJson('index.json');
    const last = readSettings().catalogChecked || 0;
    if (cached && !force && Date.now() - last < CHECK_EVERY) return { ...cached, offline: false };
    try {
      const text = await fetchText(`${base()}index.json`);
      const idx = JSON.parse(text);
      if (!Array.isArray(idx.categories)) throw new Error('Bad catalog index');
      fs.writeFileSync(path.join(dir(), 'index.json'), text);
      patchSettings({ catalogChecked: Date.now(), catalogError: '' });
      return { ...idx, offline: false };
    } catch (e) {
      patchSettings({ catalogError: String(e.message || e) });
      if (cached) return { ...cached, offline: true };
      throw new Error(`Couldn't download the hardware catalog (${e.message || e}). Check your internet connection.`);
    }
  }

  /** One category with all its items. Uses the cached copy when it's current. */
  async function category(id) {
    if (!SAFE_ID.test(id)) throw new Error('Bad category');
    const idx = await index();
    const file = `${id}.json`;
    const v = versions();
    const cached = readJson(file);
    if (cached && v[id] === idx.version) return cached;
    try {
      const text = await fetchText(base() + file);
      const data = JSON.parse(text);
      fs.writeFileSync(path.join(dir(), file), text);
      saveVersions({ ...versions(), [id]: idx.version });
      return data;
    } catch (e) {
      if (cached) return { ...cached, stale: true };
      throw new Error(`Couldn't download this category (${e.message || e}).`);
    }
  }

  /** Background: pick up a new catalog version and refresh the cached categories. */
  async function refresh() {
    try {
      const idx = await index();
      const v = versions();
      let updated = 0;
      for (const id of Object.keys(v)) {
        if (v[id] === idx.version || !idx.categories.some((c) => c.id === id)) continue;
        await category(id);
        updated++;
      }
      return { version: idx.version, updated };
    } catch (e) {
      return { error: String(e.message || e) };
    }
  }

  return { index, category, refresh };
}

module.exports = { create, DEFAULT_CATALOG_URL };

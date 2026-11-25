// Adds interface texts found in the source (JSX text and quoted UI strings) to a collected list,
// so screens the crawler didn't reach are covered too.
// Usage: node tools/i18n/source-texts.cjs <texts.json>   (updates the file in place)
const fs = require('fs');
const path = require('path');
const FILE = process.argv[2];
const SRC = path.join(__dirname, '..', '..', 'src');

const ok = (t) => {
  t = t.trim();
  if (t.length < 2 || t.length > 200 || !/\p{L}{2}/u.test(t) || /^https?:\/\//.test(t)) return false;
  if (/[{}<>=;`$]|=>|\(\)|\.tsx?$|^[a-z]+[A-Z]\w*$|^[\w-]+$/.test(t) && !/^[A-Z][a-z]+$/.test(t)) return false; // code, ids, class names
  if (/\/\/|\/\*|\*\/|\?:|\)\s*[:?]|^[):(]|\bif \(|\breturn\b|\bconst\b|Promise/.test(t)) return false; // code fragments
  if (/\d/.test(t) && t.split(/\s+/).every((w) => /^[^\p{Ll}]/u.test(w) || /\d/.test(w))) return false;
  return true;
};

const out = new Set(fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : []);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of walk(SRC).filter((f) => /\.(tsx|ts)$/.test(f) && !f.includes(`${path.sep}i18n`))) {
  const s = fs.readFileSync(f, 'utf8');
  // JSX text: >Some text<   (also the text before/after {expressions})
  for (const m of s.matchAll(/>([^<>{}]+)[<{]/g)) for (const part of m[1].split(/\n/)) if (ok(part)) out.add(part.trim().replace(/\s+/g, ' '));
  for (const m of s.matchAll(/\}([^<>{}\n]+)</g)) if (ok(m[1])) out.add(m[1].trim());
  // label: '...', title="...", placeholder="..." and similar UI props
  for (const m of s.matchAll(/\b(?:label|title|placeholder|text|short|aria-label|note|help|hint)\s*[:=]\s*(['"])((?:(?!\1).)+)\1/g)) if (ok(m[2])) out.add(m[2].trim());
  // sentence-like string literals: start with a capital, contain a space
  for (const m of s.matchAll(/(['"])([A-Z][^'"\n]*\s[^'"\n]*)\1/g)) if (ok(m[2]) && !/[\\/]/.test(m[2])) out.add(m[2].trim());
}
const list = [...out].sort();
fs.writeFileSync(FILE, JSON.stringify(list, null, 1));
console.log(`${list.length} texts`);

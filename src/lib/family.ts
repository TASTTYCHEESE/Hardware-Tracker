// "Family trees": the same tier of GPU or CPU across generations
// (GTX 1070 → RTX 2070 → RTX 3070 → RTX 4070 → RTX 5070, Ryzen 7 5800X3D → 7800X3D → 9800X3D, ...).
import type { CatalogItem } from './catalog';

/** The tier a product belongs to, or null when it isn't part of a known family. */
export function familyKey(item: CatalogItem, categoryId: string): string | null {
  const n = item.name.replace(/\s+\d+\s*GB$/i, '');
  if (/mobile|max-q|laptop|embedded|\bmxm\b/i.test(n)) return null;
  if (categoryId === 'gpu') {
    if (item.kind && item.kind !== 'GPU chip') return null;
    let m = n.match(/GeForce (?:RTX|GTX)\s?(\d{1,2})(\d{2})(\s?Ti)?(\s?SUPER)?$/i);
    if (m) return `NVIDIA xx${m[2]}${m[3] ? ' Ti' : ''}${m[4] ? ' SUPER' : ''}`;
    m = n.match(/Radeon RX\s?(\d)(\d)(\d)(\d)\s?(XTX|XT|GRE)?$/i);
    if (m) {
      const tier = m[2] === '0' ? `${m[3]}${m[4]}` : `${m[2]}0`;
      return `AMD RX x${tier}${m[5] ? ' ' + m[5].toUpperCase() : ''}`;
    }
    m = n.match(/Radeon RX\s?(\d)(\d)(\d)$/i); // RX 480 / 580 / 590
    if (m) return `AMD RX x${m[2]}0`;
    m = n.match(/Arc\s?([AB])(\d)(\d)0$/i);
    if (m) return `Intel Arc x${m[2]}${m[3]}0`;
    return null;
  }
  if (categoryId === 'cpu') {
    let m = n.match(/Ryzen (\d) (\d)(\d)(\d)(\d)(X3D|XT|X|G|F)?$/i);
    if (m) return `Ryzen ${m[1]} x${m[3]}00${m[6] ?? ''}`;
    m = n.match(/Core i(\d)-(\d{1,2})(\d)\d\d(KF|K|F|KS)?$/i);
    if (m) return `Core i${m[1]} x${m[3]}00${m[4] ?? ''}`;
    m = n.match(/Core Ultra (\d) (\d)(\d)(\d)(K|KF|F)?( Plus)?$/i);
    if (m) return `Core Ultra ${m[1]} x${m[3]}${m[4]}${m[5] ?? ''}`;
    return null;
  }
  return null;
}

/** Every member of an item's family, oldest first (one entry per name). */
export function familyOf(item: CatalogItem, items: CatalogItem[], categoryId: string): CatalogItem[] {
  const fk = familyKey(item, categoryId);
  if (!fk) return [];
  const seen = new Set<string>();
  return items
    .filter((i) => familyKey(i, categoryId) === fk)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || (a.date ?? '').localeCompare(b.date ?? '') || a.name.localeCompare(b.name))
    .filter((i) => {
      const base = i.name.replace(/\s+\d+\s*GB$/i, '');
      if (seen.has(base)) return false;
      seen.add(base);
      return true;
    });
}

import { toPng } from 'html-to-image';
import { api } from './platform';

/** Save an element (the whole thing, even the part scrolled out of view) as a PNG. */
export async function saveElementAsImage(el: HTMLElement | null, name: string): Promise<string> {
  if (!el) return '';
  const bg = getComputedStyle(document.body).backgroundColor || '#0f1115';
  const url = await toPng(el, {
    pixelRatio: 2,
    backgroundColor: bg,
    width: el.scrollWidth,
    height: el.scrollHeight,
    style: { maxHeight: 'none', overflow: 'visible' },
    filter: (n) => !(n instanceof HTMLElement && n.dataset.noExport !== undefined),
  });
  if (api.saveImage) {
    const r = await api.saveImage(url, name);
    return r.ok ? `Saved to ${r.path}` : '';
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.png`;
  a.click();
  return 'Image downloaded';
}

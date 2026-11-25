import { useEffect, useMemo, useState } from 'react';
import type { AppData } from '../lib/useData';
import type { Rates } from '../lib/fx';
import { findModel, modelRange, type PartKind, type PriceCtx, type UsedModel } from '../lib/usedModels';
import { CurrencySelect, defaultCurrency, ModelPicker, useMoney } from './Deals';

// "Sell my whole PC": pick each part of a build and see what the whole PC is fairly worth used.

type Slot = { id: string; label: string; kind?: PartKind; optional?: boolean };
const SLOTS: Slot[] = [
  { id: 'cpu', label: 'Processor', kind: 'cpu' },
  { id: 'cooler', label: 'CPU cooler' },
  { id: 'board', label: 'Motherboard', kind: 'board' },
  { id: 'ram', label: 'RAM', kind: 'ram' },
  { id: 'gpu', label: 'Graphics card', kind: 'gpu', optional: true },
  { id: 'ssd', label: 'SSD', kind: 'ssd' },
  { id: 'ssd2', label: 'Second drive', kind: 'ssd', optional: true },
  { id: 'psu', label: 'Power supply', kind: 'psu' },
  { id: 'case', label: 'Case', kind: 'case' },
];

// Coolers: [label, price new]. Used coolers sell for about half.
const COOLERS: [string, number][] = [
  ['None / stock cooler', 0],
  ['Budget air cooler (e.g. Thermalright Assassin X, Arctic Freezer 36)', 30],
  ['Tower air cooler (e.g. Thermalright Peerless Assassin, DeepCool AK620)', 50],
  ['Premium air cooler (e.g. Noctua NH-D15, be quiet! Dark Rock Pro 5)', 110],
  ['240 mm liquid cooler (AIO)', 90],
  ['360 mm liquid cooler (AIO)', 130],
  ['360 mm AIO with screen (e.g. NZXT Kraken Elite, Corsair iCUE Link)', 260],
];

const CONDITION: [string, string, number][] = [
  ['new', 'Like new (under a year, boxes kept)', 1.07],
  ['good', 'Good (normal use)', 1],
  ['worn', 'Well used (scratches, dusty, 4+ years)', 0.85],
];

interface Saved {
  parts: Record<string, string>;
  cooler: number;
  extras: string;
  cond: string;
}
const KEY = 'hwt-sell-build';
function load(): Saved {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { parts: j.parts ?? {}, cooler: j.cooler ?? 0, extras: j.extras ?? '', cond: j.cond ?? 'good' };
  } catch {
    return { parts: {}, cooler: 0, extras: '', cond: 'good' };
  }
}

export function BuildValue({ data, fx, ctx }: { data: AppData; fx: Rates | null; ctx: PriceCtx }) {
  const [saved, setSaved] = useState<Saved>(load);
  const [cur, setCur] = useState(() => defaultCurrency(data));
  const show = useMoney(fx, cur);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      /* private mode */
    }
  }, [saved]);
  const setPart = (slot: string, m: UsedModel | null) =>
    setSaved((s) => {
      const parts = { ...s.parts };
      if (m) parts[slot] = m.id;
      else delete parts[slot];
      return { ...s, parts };
    });

  const cond = CONDITION.find((c) => c[0] === saved.cond) ?? CONDITION[1];
  const lines = useMemo(() => {
    const out: { label: string; name: string; low: number; mid: number; high: number }[] = [];
    for (const slot of SLOTS) {
      if (slot.id === 'cooler') {
        const [name, usd] = COOLERS[saved.cooler] ?? COOLERS[0];
        if (usd) out.push({ label: slot.label, name, low: usd * 0.4, mid: usd * 0.5, high: usd * 0.6 });
        continue;
      }
      const m = saved.parts[slot.id] ? findModel(saved.parts[slot.id]) : undefined;
      if (!m) continue;
      const r = modelRange(m, ctx);
      out.push({ label: slot.label, name: m.name, low: r.low, mid: r.mid, high: r.high });
    }
    const extra = Number(saved.extras.replace(',', '.'));
    if (extra > 0) out.push({ label: 'Extras', name: 'Fans, cables, RGB… (what they cost new)', low: extra * 0.3, mid: extra * 0.4, high: extra * 0.5 });
    return out;
  }, [saved, ctx]);

  const sum = lines.reduce((a, l) => ({ low: a.low + l.low, mid: a.mid + l.mid, high: a.high + l.high }), { low: 0, mid: 0, high: 0 });
  const k = cond[2];
  // Complete PCs usually sell for less than their parts would one by one: buyers can't check every part,
  // and you sell to one person instead of seven. In exchange it is one quick sale.
  const whole = { low: sum.mid * 0.82 * k, mid: sum.mid * 0.9 * k, high: sum.mid * 0.98 * k };
  const quick = sum.low * 0.8 * k;
  const missing = SLOTS.filter((s) => s.kind && !s.optional && !saved.parts[s.id]).map((s) => s.label.toLowerCase());

  return (
    <div className="build-value">
      <p className="muted small">Pick the parts in your PC and see what it's fairly worth used, as a whole and part by part. Your build is kept on this device.</p>
      <div className="card build-slots">
        {SLOTS.map((slot) => (
          <div key={slot.id} className="build-slot">
            <div className="build-label">
              {slot.label}
              {slot.optional && <span className="muted small"> (optional)</span>}
            </div>
            {slot.kind ? (
              <ModelPicker kinds={[slot.kind]} value={saved.parts[slot.id] ? findModel(saved.parts[slot.id]) ?? null : null} onChange={(m) => setPart(slot.id, m)} allowNone={slot.optional ? 'None' : 'Pick the brand…'} />
            ) : (
              <select className="select" value={saved.cooler} onChange={(e) => setSaved((s) => ({ ...s, cooler: +e.target.value }))}>
                {COOLERS.map(([n], i) => (
                  <option key={n} value={i}>
                    {n}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
        <div className="build-slot">
          <div className="build-label">
            Extras <span className="muted small">(optional)</span>
          </div>
          <input className="search" inputMode="decimal" placeholder="Fans, RGB, cables: what they cost new, in USD" value={saved.extras} onChange={(e) => setSaved((s) => ({ ...s, extras: e.target.value.replace(/[^0-9.,]/g, '') }))} />
        </div>
        <div className="build-slot">
          <div className="build-label">Condition</div>
          <select className="select" value={saved.cond} onChange={(e) => setSaved((s) => ({ ...s, cond: e.target.value }))}>
            {CONDITION.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="build-slot">
          <div className="build-label">Currency</div>
          <CurrencySelect value={cur} onChange={setCur} />
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="muted small">Pick at least one part to see its value.</p>
      ) : (
        <div className="card build-result">
          <div className="build-total">
            <div>
              <div className="muted small">Fair price for the whole PC</div>
              <div className="build-big">
                {show(whole.low)} – {show(whole.high)}
              </div>
              <div className="small">
                Ask about <strong>{show(whole.mid * 1.05)}</strong> and accept around <strong>{show(whole.mid)}</strong>. For a sale within a few days: about {show(quick)}.
              </div>
            </div>
            <div className="build-parts-total">
              <div className="muted small">Sold part by part</div>
              <div>
                <strong>
                  {show(sum.low * k)} – {show(sum.high * k)}
                </strong>
              </div>
              <div className="muted small">More money, more work</div>
            </div>
          </div>
          {missing.length > 0 && <p className="muted small">Not picked yet: {missing.join(', ')}. Add them for the full value.</p>}
          <div className="build-lines">
            {lines.map((l) => (
              <div key={l.label} className="used-row">
                <div className="used-name">
                  <span className="muted small">{l.label}</span>
                  <strong translate="no">{l.name}</strong>
                </div>
                <div className="used-price">
                  <strong>{show(l.mid * k)}</strong>
                  <span className="muted small">
                    {show(l.low * k)} – {show(l.high * k)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <ul className="buy-reasons">
            <li className="r-info">
              <span>ⓘ</span> Complete PCs usually sell for 5-15% less than their parts one by one, because buyers can't check every part. In exchange it's one quick sale to one person.
            </li>
            <li className="r-info">
              <span>ⓘ</span> Clean the dust out, take clear photos, list every part by its exact name and add a benchmark or a game running: it sells faster and closer to the top of the range.
            </li>
            <li className="r-info">
              <span>ⓘ</span> Wipe your drives, sign out of Windows and your accounts. A Windows licence tied to your Microsoft account doesn't add value unless it's a retail key you hand over.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

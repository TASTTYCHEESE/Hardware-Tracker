import { useMemo, useState } from 'react';
import { countdown, launchLabel, launchTime, useLaunches, type Launch } from '../lib/launches';
import { catLabel } from './Common';
import type { Category } from '../lib/types';

const STATUS: Record<string, { label: string; cls: string }> = {
  event: { label: 'Event', cls: 'st-event' },
  confirmed: { label: 'Confirmed', cls: 'confirmed' },
  rumor: { label: 'Rumor', cls: 'rumor' },
  delayed: { label: 'Delayed', cls: 'st-delayed' },
  cancelled: { label: 'Cancelled', cls: 'st-cancelled' },
};

/** Launch calendar: upcoming launches, events and rumored dates, with countdowns. */
export function Launches() {
  const { entries, updated } = useLaunches();
  const [cat, setCat] = useState('All');
  const [showOff, setShowOff] = useState(false);
  const now = Date.now();
  const list = useMemo(
    () =>
      entries
        .filter((e) => cat === 'All' || e.category === cat)
        .filter((e) => showOff || e.status !== 'cancelled')
        .filter((e) => e.date.split('-').length < 3 || launchTime(e.date) > now - 3 * 864e5)
        .sort((a, b) => launchTime(a.date) - launchTime(b.date)),
    [entries, cat, showOff],
  );
  const cancelled = entries.filter((e) => e.status === 'cancelled').length;
  // Group by month.
  const groups = new Map<string, Launch[]>();
  for (const e of list) {
    const parts = e.date.split('-');
    const k = parts.length === 1 ? parts[0] : new Date(launchTime(e.date)).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  const cats = ['All', ...new Set(entries.map((e) => e.category))];
  return (
    <div className="page">
      <div className="section-head">
        <h1>Launch calendar</h1>
        <span className="muted small">Upcoming launches, events and rumored dates{updated ? ` · updated ${updated}` : ''}. The daily recap keeps this up to date.</span>
      </div>
      <div className="toolbar">
        <div className="tabs">
          {cats.map((c) => (
            <button key={c} className={cat === c ? 'tab active' : 'tab'} onClick={() => setCat(c)}>
              {c === 'All' ? 'All' : catLabel(c as Category)}
            </button>
          ))}
        </div>
        {cancelled > 0 && (
          <label className="small check">
            <input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} /> Show cancelled ({cancelled})
          </label>
        )}
      </div>
      {!list.length && <p className="muted">Nothing on the calendar for this filter.</p>}
      {[...groups.entries()].map(([month, items]) => (
        <section key={month} className="cal-month">
          <div className="eyebrow">{month}</div>
          {items.map((e) => (
            <div key={e.title + e.date} className={`card cal-item ${e.status}`}>
              <div className="cal-when">
                <strong>{e.status === 'cancelled' ? '—' : countdown(e.date, now)}</strong>
                <span className="muted small">{launchLabel(e.date)}</span>
              </div>
              <div className="cal-body">
                <div>
                  <span className={`badge ${STATUS[e.status]?.cls ?? ''}`}>{STATUS[e.status]?.label ?? e.status}</span>{' '}
                  {e.category !== 'Other' && <span className="badge">{catLabel(e.category as Category)}</span>} <strong>{e.title}</strong>
                </div>
                {e.note && <div className="muted small">{e.note}</div>}
                {e.source && (
                  <a className="small" href={e.source}>
                    Source →
                  </a>
                )}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

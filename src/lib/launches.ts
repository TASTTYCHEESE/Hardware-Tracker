import { useEffect, useState } from 'react';
import { api } from './platform';
import seed from '../data/launches-seed.json';

export type LaunchStatus = 'event' | 'confirmed' | 'rumor' | 'delayed' | 'cancelled';
export interface Launch {
  date: string; // YYYY-MM-DD, YYYY-MM or YYYY
  title: string;
  category: string;
  status: LaunchStatus;
  maker?: string;
  note?: string;
  source?: string;
}

const URL = 'https://raw.githubusercontent.com/TASTTYCHEESE/Hardware-Tracker/main/launches/calendar.json';

/** The launch calendar (kept up to date by the daily recap), with a built-in copy for offline use. */
export function useLaunches() {
  const [list, setList] = useState<{ entries: Launch[]; updated: string }>({ entries: seed.entries as Launch[], updated: seed.updated });
  useEffect(() => {
    api
      .fetchText(`${URL}?t=${Math.floor(Date.now() / 3600e3)}`)
      .then((t) => {
        const j = JSON.parse(t);
        if (Array.isArray(j.entries)) setList({ entries: j.entries, updated: j.updated ?? '' });
      })
      .catch(() => {});
  }, []);
  return list;
}

/** Start of the period a launch date names (for sorting and countdowns). */
export function launchTime(d: string): number {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, (m || 1) - 1, day || 1, 12).getTime();
}

export function launchLabel(d: string): string {
  const parts = d.split('-');
  const t = new Date(launchTime(d));
  if (parts.length === 3) return t.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  if (parts.length === 2) return t.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return parts[0];
}

/** "in 3 days", "in about 2 months", "this month". */
export function countdown(d: string, now = Date.now()): string {
  const parts = d.split('-').length;
  const t = launchTime(d);
  const days = Math.round((t - now) / 864e5);
  if (parts === 3) {
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days < 0) return `${-days} days ago`;
    return days < 60 ? `in ${days} days` : `in about ${Math.round(days / 30)} months`;
  }
  const n = new Date(now);
  const months = (new Date(t).getFullYear() - n.getFullYear()) * 12 + new Date(t).getMonth() - n.getMonth();
  if (parts === 1) return months <= 0 ? 'this year' : `in about ${Math.max(1, Math.round(months / 12 * 10) / 10)} years`.replace('about 1 years', 'about a year');
  if (months === 0) return 'this month';
  if (months < 0) return 'passed';
  return months === 1 ? 'next month' : `in ${months} months`;
}

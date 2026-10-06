import { indexLogs, logKey, occurrenceState, occurrencesOn } from './schedule';
import { addDays, dateKey } from './time';
import type { DoseLog, Medication, Settings } from './types';

export type DayStatus = 'none' | 'full' | 'partial' | 'missed' | 'pending';

export interface DaySummary {
  date: string;
  total: number;
  taken: number;
  skipped: number;
  missed: number;
  open: number; // due or upcoming
  status: DayStatus;
}

export function summarizeDay(
  meds: Medication[],
  logIndex: Map<string, DoseLog>,
  date: string,
  now: number,
  settings: Pick<Settings, 'missedAfterMin'>,
): DaySummary {
  const byId = new Map(meds.map((m) => [m.id, m]));
  const s: DaySummary = { date, total: 0, taken: 0, skipped: 0, missed: 0, open: 0, status: 'none' };
  for (const o of occurrencesOn(meds, date)) {
    const st = occurrenceState(o, byId.get(o.medId), logIndex.get(logKey(o.medId, o.slot)), now, settings);
    if (st == null) continue;
    s.total++;
    if (st === 'taken') s.taken++;
    else if (st === 'skipped') s.skipped++;
    else if (st === 'missed') s.missed++;
    else s.open++;
  }
  if (s.total === 0) s.status = 'none';
  else if (s.open > 0 && s.missed === 0) s.status = 'pending';
  else if (s.taken === s.total) s.status = 'full';
  else if (s.taken === 0 && s.missed > 0 && s.skipped === 0) s.status = 'missed';
  else if (s.missed === 0 && s.open === 0) s.status = 'full'; // taken + deliberate skips only
  else s.status = 'partial';
  return s;
}

export interface Adherence {
  taken: number;
  counted: number;
  pct: number | null;
}

/** Share of resolved doses that were taken, over [from, to] inclusive. Open doses are excluded. */
export function adherence(
  meds: Medication[],
  logs: DoseLog[],
  from: string,
  to: string,
  now: number,
  settings: Pick<Settings, 'missedAfterMin'>,
  medId?: string,
): Adherence {
  const idx = indexLogs(logs);
  const list = medId ? meds.filter((m) => m.id === medId) : meds;
  let taken = 0;
  let counted = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const s = summarizeDay(list, idx, d, now, settings);
    taken += s.taken;
    counted += s.taken + s.skipped + s.missed;
  }
  return { taken, counted, pct: counted ? Math.round((taken / counted) * 100) : null };
}

/**
 * A streak day is one where every scheduled dose was taken or deliberately skipped.
 * Days without scheduled doses neither extend nor break the streak.
 * Today counts once it is complete, and never breaks the streak while still in progress.
 */
export function streaks(
  meds: Medication[],
  logs: DoseLog[],
  now: number,
  settings: Pick<Settings, 'missedAfterMin'>,
  lookbackDays = 400,
): { current: number; best: number } {
  const idx = indexLogs(logs);
  const today = dateKey(new Date(now));
  const earliest = meds.reduce((min, m) => (m.startDate < min ? m.startDate : min), today);

  let current = 0;
  let best = 0;
  let run = 0;
  let currentOpen = true;
  for (let i = 0; i <= lookbackDays; i++) {
    const d = addDays(today, -i);
    if (d < earliest) break;
    const s = summarizeDay(meds, idx, d, now, settings);
    if (s.status === 'none') continue;
    if (s.status === 'pending' && d === today) continue;
    if (s.status === 'full') {
      run++;
      if (currentOpen) current = run;
    } else {
      currentOpen = false;
      best = Math.max(best, run);
      run = 0;
    }
  }
  best = Math.max(best, run, current);
  return { current, best };
}

import { compareTime, daysBetween, parseDateKey, slotKey, slotToEpoch, addDays, dateKey } from './time';
import type { DoseLog, DoseTime, Medication, Occurrence, OccurrenceState, Settings } from './types';

export function isActiveOn(med: Medication, date: string): boolean {
  if (med.paused) return false;
  if (date < med.startDate) return false;
  if (med.endDate && date > med.endDate) return false;
  return true;
}

/** Scheduled doses for one medication on one day (empty for as-needed). */
export function dosesOn(med: Medication, date: string): DoseTime[] {
  if (!isActiveOn(med, date)) return [];
  const s = med.schedule;
  switch (s.kind) {
    case 'daily':
      return s.times;
    case 'weekdays':
      return s.days.includes(parseDateKey(date).getDay()) ? s.times : [];
    case 'interval': {
      const n = Math.max(1, s.everyDays);
      return daysBetween(med.startDate, date) % n === 0 ? s.times : [];
    }
    case 'asNeeded':
      return [];
  }
}

export function occurrencesOn(meds: Medication[], date: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const med of meds) {
    for (const d of dosesOn(med, date)) {
      const slot = slotKey(date, d.time);
      out.push({ medId: med.id, slot, date, time: d.time, qty: d.qty, at: slotToEpoch(slot) });
    }
  }
  return out.sort((a, b) => compareTime(a.time, b.time) || a.medId.localeCompare(b.medId));
}

export function occurrencesBetween(meds: Medication[], fromMs: number, toMs: number): Occurrence[] {
  const out: Occurrence[] = [];
  let day = dateKey(new Date(fromMs));
  const last = dateKey(new Date(toMs));
  while (day <= last) {
    for (const o of occurrencesOn(meds, day)) if (o.at >= fromMs && o.at <= toMs) out.push(o);
    day = addDays(day, 1);
  }
  return out;
}

export const logKey = (medId: string, slot: string) => `${medId}|${slot}`;

export function indexLogs(logs: DoseLog[]): Map<string, DoseLog> {
  const m = new Map<string, DoseLog>();
  for (const l of logs) m.set(logKey(l.medId, l.slot), l);
  return m;
}

export function occurrenceState(
  o: Occurrence,
  med: Medication | undefined,
  log: DoseLog | undefined,
  now: number,
  settings: Pick<Settings, 'missedAfterMin'>,
): OccurrenceState | null {
  if (log) return log.status;
  if (now < o.at) return 'upcoming';
  // Doses that were already past the missed window when the medication was added are
  // not tracked: adding an 08:00 medication at 15:00 (or back-dating a start date)
  // must not produce instant "missed" doses. Recent ones stay loggable as due.
  if (med && o.at < med.createdAt - settings.missedAfterMin * 60_000) return null;
  if (now - o.at > settings.missedAfterMin * 60_000) return 'missed';
  return 'due';
}

export function formatQty(med: Medication, qty: number): string {
  const n = qty === 1 ? 1 : qty;
  const unitWord: Record<Medication['form'], [string, string]> = {
    tablet: ['tablet', 'tablets'],
    capsule: ['capsule', 'capsules'],
    softgel: ['softgel', 'softgels'],
    liquid: ['ml', 'ml'],
    injection: ['injection', 'injections'],
    drops: ['drop', 'drops'],
    inhaler: ['puff', 'puffs'],
    other: ['dose', 'doses'],
  };
  const [one, many] = unitWord[med.form];
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

export function strengthLabel(med: Medication): string {
  return med.strength ? `${med.strength} ${med.unit}`.trim() : '';
}

export function foodLabel(rule: Medication['food']): string {
  return { before: 'before food', with: 'with food', after: 'after food', any: '' }[rule];
}

/** Average units per day, used for the "runs out on" estimate. */
export function dailyUsage(med: Medication): number {
  const s = med.schedule;
  const perDay = (times: DoseTime[]) => times.reduce((t, d) => t + d.qty, 0);
  switch (s.kind) {
    case 'daily':
      return perDay(s.times);
    case 'weekdays':
      return (perDay(s.times) * s.days.length) / 7;
    case 'interval':
      return perDay(s.times) / Math.max(1, s.everyDays);
    case 'asNeeded':
      return 0;
  }
}

export function runsOutOn(med: Medication, today: string): string | null {
  if (med.stock == null) return null;
  const usage = dailyUsage(med);
  if (usage <= 0) return null;
  return addDays(today, Math.floor(med.stock / usage));
}

export function needsRefill(med: Medication): boolean {
  return med.stock != null && med.refillAt != null && med.stock <= med.refillAt;
}

export function scheduleSummary(med: Medication): string {
  const s = med.schedule;
  const times = 'times' in s ? s.times.map((t) => t.time).join(', ') : '';
  switch (s.kind) {
    case 'daily': {
      if (s.everyHours) return `Every ${s.everyHours} hours · ${times}`;
      const n = s.times.length;
      const freq = n === 1 ? 'Daily' : n === 2 ? 'Twice daily' : n === 3 ? '3 times daily' : `${n} times daily`;
      return `${freq} · ${times}`;
    }
    case 'weekdays': {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = [...s.days].sort().map((d) => names[d]).join(', ');
      return `${days} · ${times}`;
    }
    case 'interval':
      return `Every ${s.everyDays} days · ${times}`;
    case 'asNeeded':
      return s.maxPerDay ? `As needed · max ${s.maxPerDay}/day` : 'As needed';
  }
}

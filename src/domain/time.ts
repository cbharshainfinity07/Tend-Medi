// All scheduling uses local wall-clock time. A dose at "08:00" stays at 08:00
// local time across DST changes and when travelling between time zones.

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now = new Date()): string {
  return dateKey(now);
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Whole calendar days from a to b (b - a), DST-safe. */
export function daysBetween(a: string, b: string): number {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

export function slotKey(date: string, time: string): string {
  return `${date}T${time}`;
}

/** Epoch ms for a local date + "HH:mm". Nonexistent DST times roll forward, as Date does. */
export function slotToEpoch(slot: string): number {
  const [date, time] = slot.split('T');
  const d = parseDateKey(date);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export function epochToSlot(ms: number): string {
  const d = new Date(ms);
  return slotKey(dateKey(d), `${pad(d.getHours())}:${pad(d.getMinutes())}`);
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function timeFromMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

export function compareTime(a: string, b: string): number {
  return minutesOf(a) - minutesOf(b);
}

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export function dayPart(time: string): DayPart {
  const m = minutesOf(time);
  if (m < 5 * 60) return 'night';
  if (m < 12 * 60) return 'morning';
  if (m < 17 * 60) return 'afternoon';
  if (m < 21 * 60) return 'evening';
  return 'night';
}

/** Evenly spaced times across a day starting at `start`, e.g. every 8h from 06:00. */
export function timesEvery(hours: number, start: string): string[] {
  const out: string[] = [];
  const count = Math.max(1, Math.floor(24 / hours));
  for (let i = 0; i < count; i++) out.push(timeFromMinutes(minutesOf(start) + i * hours * 60));
  return out.sort(compareTime);
}

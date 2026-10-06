import { getCalendars, getLocales } from 'expo-localization';
import { parseDateKey } from '@/domain/time';

const locale = () => getLocales()[0]?.languageTag ?? 'en';
const uses24h = () => getCalendars()[0]?.uses24hourClock ?? true;

/** "14:00" → "14:00" or "2:00 PM" following the device clock setting. */
export function formatTime(hhmm: string): string {
  if (uses24h()) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatClock(ms: number): string {
  const d = new Date(ms);
  return formatTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
}

export function formatDate(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  return parseDateKey(key).toLocaleDateString(locale(), opts);
}

export function formatMonth(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
}

/** Short human countdown relative to now: "in 18 min", "in 2 h 5 min", "now", "12 min late". */
export function relative(at: number, now: number): string {
  const diff = Math.round((at - now) / 60_000);
  if (Math.abs(diff) < 1) return 'now';
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const text = h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  return diff > 0 ? `in ${text}` : `${text} late`;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function weekdayLetters(): string[] {
  // Monday-first narrow weekday labels in the user's language
  const base = new Date(2026, 9, 5); // a Monday
  return Array.from({ length: 7 }, (_, i) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + i).toLocaleDateString(locale(), { weekday: 'narrow' }),
  );
}

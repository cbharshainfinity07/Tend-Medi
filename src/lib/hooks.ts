import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { indexLogs, logKey, occurrenceState, occurrencesOn } from '@/domain/schedule';
import { streaks, summarizeDay } from '@/domain/stats';
import { addDays, dateKey } from '@/domain/time';
import type { DoseLog, Medication, Occurrence, OccurrenceState } from '@/domain/types';
import { useStore } from '@/store/store';

/** Current time, refreshed every `everyMs` and whenever the app returns to the foreground. */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [everyMs]);
  return now;
}

export interface DoseItem {
  o: Occurrence;
  med: Medication;
  log?: DoseLog;
  state: OccurrenceState;
}

export function useDayItems(date: string, now: number): DoseItem[] {
  const meds = useStore((s) => s.meds);
  const logs = useStore((s) => s.logs);
  const missedAfterMin = useStore((s) => s.settings.missedAfterMin);
  return useMemo(() => {
    const byId = new Map(meds.map((m) => [m.id, m]));
    const idx = indexLogs(logs);
    const out: DoseItem[] = [];
    for (const o of occurrencesOn(meds, date)) {
      const med = byId.get(o.medId)!;
      const log = idx.get(logKey(o.medId, o.slot));
      const state = occurrenceState(o, med, log, now, { missedAfterMin });
      if (state) out.push({ o, med, log, state });
    }
    return out;
  }, [meds, logs, missedAfterMin, date, now]);
}

/** The dose to surface in the hero: the earliest open dose today, else tomorrow's first. */
export function useNextDose(now: number): { item: DoseItem; tomorrow: boolean } | null {
  const today = dateKey(new Date(now));
  const items = useDayItems(today, now);
  const tomorrowItems = useDayItems(addDays(today, 1), now);
  const open = items.find((i) => i.state === 'due') ?? items.find((i) => i.state === 'upcoming');
  if (open) return { item: open, tomorrow: false };
  const t = tomorrowItems.find((i) => i.state === 'upcoming');
  return t ? { item: t, tomorrow: true } : null;
}

export function useStreak(now: number) {
  const meds = useStore((s) => s.meds);
  const logs = useStore((s) => s.logs);
  const missedAfterMin = useStore((s) => s.settings.missedAfterMin);
  // recompute at most once per minute
  const minute = Math.floor(now / 60_000);
  return useMemo(() => streaks(meds, logs, minute * 60_000, { missedAfterMin }), [meds, logs, missedAfterMin, minute]);
}

export function useDaySummary(date: string, now: number) {
  const meds = useStore((s) => s.meds);
  const logs = useStore((s) => s.logs);
  const missedAfterMin = useStore((s) => s.settings.missedAfterMin);
  return useMemo(() => summarizeDay(meds, indexLogs(logs), date, now, { missedAfterMin }), [meds, logs, missedAfterMin, date, now]);
}

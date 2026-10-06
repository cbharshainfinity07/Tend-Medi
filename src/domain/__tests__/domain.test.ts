/// <reference types="jest" />
import { dosesOn, indexLogs, occurrenceState, occurrencesBetween, occurrencesOn, runsOutOn } from '../schedule';
import { adherence, streaks, summarizeDay } from '../stats';
import { addDays, daysBetween, slotToEpoch, timesEvery } from '../time';
import type { DoseLog, Medication } from '../types';

const settings = { missedAfterMin: 180 };

function med(over: Partial<Medication> = {}): Medication {
  return {
    id: 'm1',
    name: 'Metformin',
    strength: '500',
    unit: 'mg',
    form: 'tablet',
    color: 'chalk',
    food: 'with',
    instructions: '',
    notes: '',
    schedule: { kind: 'daily', times: [{ time: '08:00', qty: 1 }, { time: '20:00', qty: 1 }] },
    startDate: '2026-09-01',
    endDate: null,
    stock: null,
    refillAt: null,
    refillNotifiedAt: null,
    remindersOn: true,
    nagOn: true,
    paused: false,
    createdAt: new Date(2026, 8, 1).getTime(),
    updatedAt: 0,
    ...over,
  };
}

const log = (slot: string, status: DoseLog['status'], medId = 'm1'): DoseLog => ({
  id: `${medId}${slot}`,
  medId,
  slot,
  status,
  at: slotToEpoch(slot),
  qty: 1,
  note: '',
});

describe('time', () => {
  it('counts calendar days across DST and month boundaries', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('spreads interval presets across the day', () => {
    expect(timesEvery(8, '06:00')).toEqual(['06:00', '14:00', '22:00']);
    expect(timesEvery(6, '20:00')).toEqual(['02:00', '08:00', '14:00', '20:00']);
  });
});

describe('schedule', () => {
  it('respects start and end dates and pause', () => {
    const m = med({ endDate: '2026-09-10' });
    expect(dosesOn(m, '2026-08-31')).toHaveLength(0);
    expect(dosesOn(m, '2026-09-10')).toHaveLength(2);
    expect(dosesOn(m, '2026-09-11')).toHaveLength(0);
    expect(dosesOn(med({ paused: true }), '2026-09-05')).toHaveLength(0);
  });

  it('handles weekday schedules', () => {
    // 2026-10-05 is a Monday, 2026-10-06 a Tuesday
    const m = med({ schedule: { kind: 'weekdays', days: [1, 3, 5], times: [{ time: '09:00', qty: 1 }] } });
    expect(dosesOn(m, '2026-10-05')).toHaveLength(1);
    expect(dosesOn(m, '2026-10-06')).toHaveLength(0);
  });

  it('handles every-N-days schedules from the start date', () => {
    const m = med({ schedule: { kind: 'interval', everyDays: 3, times: [{ time: '09:00', qty: 1 }] } });
    expect(dosesOn(m, '2026-09-01')).toHaveLength(1);
    expect(dosesOn(m, '2026-09-02')).toHaveLength(0);
    expect(dosesOn(m, '2026-09-04')).toHaveLength(1);
  });

  it('never schedules as-needed medications', () => {
    expect(occurrencesOn([med({ schedule: { kind: 'asNeeded', qty: 1 } })], '2026-09-05')).toHaveLength(0);
  });

  it('sorts occurrences across medications by time', () => {
    const a = med();
    const b = med({ id: 'm2', schedule: { kind: 'daily', times: [{ time: '09:00', qty: 1 }] } });
    expect(occurrencesOn([a, b], '2026-09-05').map((o) => o.time)).toEqual(['08:00', '09:00', '20:00']);
  });

  it('collects occurrences inside a time window', () => {
    const from = slotToEpoch('2026-09-05T12:00');
    const to = slotToEpoch('2026-09-06T12:00');
    expect(occurrencesBetween([med()], from, to).map((o) => o.slot)).toEqual(['2026-09-05T20:00', '2026-09-06T08:00']);
  });

  it('derives due, missed and upcoming states', () => {
    const m = med();
    const [o] = occurrencesOn([m], '2026-09-05');
    expect(occurrenceState(o, m, undefined, o.at - 1, settings)).toBe('upcoming');
    expect(occurrenceState(o, m, undefined, o.at + 60_000, settings)).toBe('due');
    expect(occurrenceState(o, m, undefined, o.at + 181 * 60_000, settings)).toBe('missed');
    expect(occurrenceState(o, m, log(o.slot, 'skipped'), o.at + 999 * 60_000, settings)).toBe('skipped');
  });

  it('does not count doses from before the medication was added', () => {
    const m = med({ startDate: '2026-08-01', createdAt: new Date(2026, 8, 1, 12).getTime() });
    const [o] = occurrencesOn([m], '2026-08-15');
    expect(occurrenceState(o, m, undefined, Date.now(), settings)).toBeNull();
  });

  it('does not mark a dose missed when the medication was added after its window', () => {
    // added at 15:00 with an 08:00 dose: that dose is not tracked today
    const m = med({ startDate: '2026-10-06', createdAt: slotToEpoch('2026-10-06T15:00') });
    const [morning, evening] = occurrencesOn([m], '2026-10-06');
    expect(occurrenceState(morning, m, undefined, slotToEpoch('2026-10-06T15:05'), settings)).toBeNull();
    expect(occurrenceState(evening, m, undefined, slotToEpoch('2026-10-06T15:05'), settings)).toBe('upcoming');
    // added at 08:20: the 08:00 dose is still loggable
    const early = med({ startDate: '2026-10-06', createdAt: slotToEpoch('2026-10-06T08:20') });
    expect(occurrenceState(occurrencesOn([early], '2026-10-06')[0], early, undefined, slotToEpoch('2026-10-06T08:25'), settings)).toBe('due');
  });

  it('estimates the run-out date from stock and usage', () => {
    expect(runsOutOn(med({ stock: 18 }), '2026-10-06')).toBe('2026-10-15');
    expect(runsOutOn(med({ stock: null }), '2026-10-06')).toBeNull();
  });
});

describe('stats', () => {
  const now = slotToEpoch('2026-09-05T21:00');

  it('summarises a day', () => {
    const logs = [log('2026-09-04T08:00', 'taken')];
    const s = summarizeDay([med()], indexLogs(logs), '2026-09-04', now, settings);
    expect(s).toMatchObject({ total: 2, taken: 1, missed: 1, status: 'partial' });
  });

  it('treats deliberate skips as complete days but not as adherence', () => {
    const logs = [log('2026-09-04T08:00', 'taken'), log('2026-09-04T20:00', 'skipped')];
    expect(summarizeDay([med()], indexLogs(logs), '2026-09-04', now, settings).status).toBe('full');
    expect(adherence([med()], logs, '2026-09-04', '2026-09-04', now, settings).pct).toBe(50);
  });

  it('computes current and best streaks', () => {
    const logs: DoseLog[] = [];
    for (let d = '2026-09-01'; d <= '2026-09-05'; d = addDays(d, 1)) {
      if (d === '2026-09-02') continue; // a missed day breaks the streak
      logs.push(log(`${d}T08:00`, 'taken'));
      if (d !== '2026-09-05') logs.push(log(`${d}T20:00`, 'taken'));
    }
    // today (09-05) still has the 20:00 dose open, so it neither counts nor breaks
    const s = streaks([med()], logs, slotToEpoch('2026-09-05T19:00'), settings);
    expect(s).toEqual({ current: 2, best: 2 });
  });
});

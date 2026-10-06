/// <reference types="jest" />
import { parseBackup, serializeBackup, BackupError, logsToCsv } from '@/backup/backup';
import { slotToEpoch } from '@/domain/time';
import { DEFAULT_SETTINGS, type DoseLog, type Medication } from '@/domain/types';
import { planReminders } from '@/notifications/engine';

jest.mock('@/backup/files', () => ({ saveAndShare: jest.fn(), pickText: jest.fn() }));

const med = (over: Partial<Medication> = {}): Medication => ({
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
});

const settings = { ...DEFAULT_SETTINGS, onboarded: true };

describe('planReminders', () => {
  const now = slotToEpoch('2026-10-06T07:00');

  it('schedules a reminder plus nudges for each upcoming dose', () => {
    const plans = planReminders([med()], [], settings, now);
    const first = plans.filter((p) => p.id.endsWith('2026-10-06T08:00'));
    expect(first.map((p) => p.id.split('|')[0])).toEqual(['due', 'nag1', 'nag2']);
    expect(first[1].at - first[0].at).toBe(10 * 60_000);
  });

  it('skips doses that are already logged, paused, or reminder-free', () => {
    const log: DoseLog = { id: 'l', medId: 'm1', slot: '2026-10-06T08:00', status: 'taken', at: now, qty: 1, note: '' };
    expect(planReminders([med()], [log], settings, now).some((p) => p.id.includes('2026-10-06T08:00'))).toBe(false);
    expect(planReminders([med({ paused: true })], [], settings, now)).toHaveLength(0);
    expect(planReminders([med({ remindersOn: false })], [], settings, now)).toHaveLength(0);
  });

  it('still nudges for a dose that was due a few minutes ago', () => {
    const plans = planReminders([med()], [], settings, slotToEpoch('2026-10-06T08:05'));
    expect(plans[0].id).toBe('nag1|m1|2026-10-06T08:00');
  });

  it('replaces the dose reminder with the snooze while snoozed', () => {
    const until = slotToEpoch('2026-10-06T08:30');
    const plans = planReminders([med()], [], { ...settings, snoozes: { 'm1|2026-10-06T08:00': until } }, slotToEpoch('2026-10-06T08:02'));
    const forDose = plans.filter((p) => p.id.includes('2026-10-06T08:00'));
    expect(forDose.map((p) => p.id)).toEqual(['snooze|m1|2026-10-06T08:00']);
    expect(forDose[0].at).toBe(until);
  });

  it('stays under the iOS pending-notification limit and favours main reminders', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      med({ id: `m${i}`, schedule: { kind: 'daily', times: ['06:00', '10:00', '14:00', '18:00', '22:00'].map((time) => ({ time, qty: 1 })) } }),
    );
    const plans = planReminders(many, [], settings, now);
    expect(plans.length).toBeLessThanOrEqual(60);
    const mains = plans.filter((p) => p.id.startsWith('due'));
    expect(mains.length).toBe(60);
  });

  it('hides medication names when privacy mode is on', () => {
    const [p] = planReminders([med()], [], { ...settings, hideNamesOnLockScreen: true }, now);
    expect(p.content.title).toBe('Time for your medication');
    expect(p.content.body).not.toContain('Metformin');
  });
});

describe('backup', () => {
  it('round-trips medications, logs and settings, dropping transient state', () => {
    const log: DoseLog = { id: 'l', medId: 'm1', slot: '2026-10-06T08:00', status: 'taken', at: 1, qty: 1, note: 'ok' };
    const text = serializeBackup([med()], [log], { ...settings, name: 'Asha', snoozes: { x: 1 } });
    const snap = parseBackup(text);
    expect(snap.medications[0].name).toBe('Metformin');
    expect(snap.logs).toEqual([log]);
    expect(snap.settings.name).toBe('Asha');
    expect(snap.settings.snoozes).toEqual({});
  });

  it('rejects files that are not Tend backups or come from a newer version', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ format: 'tend-backup', version: 99, medications: [], logs: [] }))).toThrow(/newer version/);
  });

  it('drops invalid records and orphaned logs', () => {
    const text = JSON.stringify({
      format: 'tend-backup',
      version: 1,
      medications: [med(), { id: 'bad' }],
      logs: [
        { id: 'a', medId: 'm1', slot: '2026-10-06T08:00', status: 'taken', at: 1 },
        { id: 'b', medId: 'ghost', slot: '2026-10-06T08:00', status: 'taken', at: 1 },
        { id: 'c', medId: 'm1', slot: '2026-10-06T20:00', status: 'eaten', at: 1 },
      ],
    });
    const snap = parseBackup(text);
    expect(snap.medications.map((m) => m.id)).toEqual(['m1']);
    expect(snap.logs.map((l) => l.id)).toEqual(['a']);
  });

  it('escapes CSV cells', () => {
    const csv = logsToCsv([med({ name: 'Vit "D", 3' })], [{ id: 'a', medId: 'm1', slot: '2026-10-06T08:00', status: 'taken', at: 1, qty: 1, note: '' }]);
    expect(csv.split('\n')[1]).toContain('"Vit ""D"", 3"');
  });
});

describe('backup photos', () => {
  const photo = 'med-abc123-x9y8z7.jpg';
  const data = 'iVBORw0KGgoAAAANSUhEUg==';

  it('round-trips a medicine photo with its medication', () => {
    const text = serializeBackup([med({ photo })], [], DEFAULT_SETTINGS, { [photo]: data });
    const snap = parseBackup(text);
    expect(snap.medications[0].photo).toBe(photo);
    expect(snap.photos).toEqual({ [photo]: data });
  });

  it('rejects unsafe names, unreferenced photos and non-base64 data', () => {
    const raw = JSON.parse(serializeBackup([med({ photo })], [], DEFAULT_SETTINGS));
    raw.photos = { '../../evil.jpg': data, 'med-other-123456.jpg': data, [photo]: '<script>' };
    const snap = parseBackup(JSON.stringify(raw));
    expect(snap.photos).toEqual({});
    // A photo whose data didn't survive is unlinked rather than left dangling.
    expect(snap.medications[0].photo).toBeNull();
  });
});

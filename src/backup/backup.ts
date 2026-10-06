import type { Snapshot } from '@/data/storage';
import { formatQty, strengthLabel } from '@/domain/schedule';
import { todayKey } from '@/domain/time';
import { DEFAULT_SETTINGS, type DoseLog, type Medication, type Settings } from '@/domain/types';
import { isPhotoName, readPhotoBase64 } from '@/photos/photos';
import { pickText, saveAndShare } from './files';

const FORMAT = 'tend-backup';
const VERSION = 1;

interface BackupFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  medications: Medication[];
  logs: DoseLog[];
  settings: Partial<Settings>;
  photos?: Record<string, string>;
}

export class BackupError extends Error {}

export function serializeBackup(meds: Medication[], logs: DoseLog[], settings: Settings, photos?: Record<string, string>): string {
  const { snoozes: _transient, ...persisted } = settings;
  const file: BackupFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    medications: meds,
    logs,
    settings: persisted,
    ...(photos && Object.keys(photos).length ? { photos } : {}),
  };
  return JSON.stringify(file, null, 1);
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validMed(m: any): m is Medication {
  return (
    m &&
    isStr(m.id) &&
    isStr(m.name) &&
    isStr(m.startDate) &&
    m.schedule &&
    isStr(m.schedule.kind) &&
    (m.schedule.kind === 'asNeeded' || Array.isArray(m.schedule.times))
  );
}

function validLog(l: any): l is DoseLog {
  return l && isStr(l.id) && isStr(l.medId) && isStr(l.slot) && ['taken', 'skipped', 'missed'].includes(l.status) && isNum(l.at);
}

export function parseBackup(text: string): Snapshot {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("This file isn't a Tend backup.");
  }
  if (raw?.format !== FORMAT || !isNum(raw.version)) throw new BackupError("This file isn't a Tend backup.");
  if (raw.version > VERSION) throw new BackupError('This backup was made by a newer version of Tend. Update the app and try again.');
  if (!Array.isArray(raw.medications) || !Array.isArray(raw.logs)) throw new BackupError('This backup is damaged.');
  const medDefaults: Partial<Medication> = { refillNotifiedAt: null, nagOn: true, remindersOn: true, paused: false, notes: '', instructions: '' };
  const medications = (raw.medications as unknown[]).filter(validMed).map((m) => ({ ...medDefaults, ...m }) as Medication);
  const ids = new Set(medications.map((m) => m.id));
  const logDefaults: Partial<DoseLog> = { note: '', qty: 1 };
  const logs = (raw.logs as unknown[]).filter(validLog).filter((l) => ids.has(l.medId)).map((l) => ({ ...logDefaults, ...l }) as DoseLog);
  const settings = { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}), snoozes: {} };
  // Photos are optional; anything that isn't a name we generate, or isn't referenced, is dropped.
  const referenced = new Set(medications.map((m) => m.photo).filter(isPhotoName));
  const photos: Record<string, string> = {};
  if (raw.photos && typeof raw.photos === 'object') {
    for (const [name, data] of Object.entries(raw.photos as Record<string, unknown>)) {
      if (referenced.has(name) && isStr(data) && /^[A-Za-z0-9+/=\s]+$/.test(data)) photos[name] = data;
    }
  }
  for (const m of medications) if (m.photo && !photos[m.photo] && !m.photo.startsWith('data:')) m.photo = null;
  return { medications, logs, settings, photos };
}

export async function exportBackup(meds: Medication[], logs: DoseLog[], settings: Settings): Promise<boolean> {
  const photos: Record<string, string> = {};
  for (const m of meds) {
    if (!isPhotoName(m.photo) || m.photo.startsWith('data:')) continue;
    const data = await readPhotoBase64(m.photo).catch(() => null);
    if (data) photos[m.photo] = data;
  }
  return saveAndShare(`tend-backup-${todayKey()}.json`, 'application/json', 'public.json', serializeBackup(meds, logs, settings, photos));
}

/** Returns null when the user cancels the picker. Throws BackupError for invalid files. */
export async function pickBackup(): Promise<Snapshot | null> {
  const text = await pickText();
  if (text == null) return null;
  return parseBackup(text);
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function logsToCsv(meds: Medication[], logs: DoseLog[]): string {
  const byId = new Map(meds.map((m) => [m.id, m]));
  const rows = [['Date', 'Scheduled', 'Medication', 'Strength', 'Dose', 'Status', 'Logged at', 'Note']];
  for (const l of [...logs].sort((a, b) => a.slot.localeCompare(b.slot))) {
    const m = byId.get(l.medId);
    if (!m) continue;
    const [date, time] = l.slot.split('T');
    rows.push([date, time, m.name, strengthLabel(m), formatQty(m, l.qty), l.status, new Date(l.at).toLocaleString(), l.note]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export async function exportCsv(meds: Medication[], logs: DoseLog[]): Promise<boolean> {
  return saveAndShare(`tend-history-${todayKey()}.csv`, 'text/csv', 'public.comma-separated-values-text', logsToCsv(meds, logs));
}

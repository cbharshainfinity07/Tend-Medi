// Web preview storage. Native builds resolve db.native.ts (SQLite) instead.
import type { DoseLog, Medication, Settings } from '@/domain/types';
import type { Snapshot, Storage } from './storage';

const KEY = 'tend.v1';

function read(): Snapshot {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) return JSON.parse(raw) as Snapshot;
  } catch {
    // corrupted preview data: start fresh
  }
  return { medications: [], logs: [], settings: {} };
}

function write(s: Snapshot) {
  globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

export async function openStorage(): Promise<Storage> {
  return {
    async load() {
      return read();
    },
    async saveMedication(med: Medication) {
      const s = read();
      write({ ...s, medications: upsert(s.medications, med) });
    },
    async deleteMedication(id: string) {
      const s = read();
      write({ ...s, medications: s.medications.filter((m) => m.id !== id), logs: s.logs.filter((l) => l.medId !== id) });
    },
    async saveLog(log: DoseLog) {
      const s = read();
      const logs = s.logs.filter((l) => l.id === log.id || !(l.medId === log.medId && l.slot === log.slot));
      write({ ...s, logs: upsert(logs, log) });
    },
    async deleteLog(id: string) {
      const s = read();
      write({ ...s, logs: s.logs.filter((l) => l.id !== id) });
    },
    async saveSettings(settings: Settings) {
      write({ ...read(), settings });
    },
    async replaceAll(snapshot: Snapshot) {
      write(snapshot);
    },
  };
}

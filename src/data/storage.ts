import type { DoseLog, Medication, Settings } from '@/domain/types';

export interface Snapshot {
  medications: Medication[];
  logs: DoseLog[];
  settings: Partial<Settings>;
  /** Medicine photos carried by a backup file: photo file name -> base64 JPEG. */
  photos?: Record<string, string>;
}

/** Persistence port. Native uses SQLite (storage.native.ts); web preview uses localStorage. */
export interface Storage {
  load(): Promise<Snapshot>;
  saveMedication(med: Medication): Promise<void>;
  deleteMedication(id: string): Promise<void>;
  saveLog(log: DoseLog): Promise<void>;
  deleteLog(id: string): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  replaceAll(snapshot: Snapshot): Promise<void>;
}

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

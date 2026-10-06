import * as SQLite from 'expo-sqlite';
import type { DoseLog, Medication, Settings } from '@/domain/types';
import type { Snapshot, Storage } from './storage';

const DB_NAME = 'tend.db';

// Each entry migrates the schema from version i to i + 1. Never edit a shipped migration.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS dose_logs (
    id TEXT PRIMARY KEY NOT NULL,
    med_id TEXT NOT NULL,
    slot TEXT NOT NULL,
    status TEXT NOT NULL,
    at INTEGER NOT NULL,
    qty REAL NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    UNIQUE (med_id, slot)
  );
  CREATE INDEX IF NOT EXISTS idx_logs_slot ON dose_logs (slot);
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version++;
  }
}

type LogRow = { id: string; med_id: string; slot: string; status: DoseLog['status']; at: number; qty: number; note: string };

const toLog = (r: LogRow): DoseLog => ({ id: r.id, medId: r.med_id, slot: r.slot, status: r.status, at: r.at, qty: r.qty, note: r.note });

async function insertLog(db: SQLite.SQLiteDatabase, log: DoseLog) {
  // One log per scheduled slot: re-logging a slot replaces its previous status.
  await db.runAsync(
    `INSERT INTO dose_logs (id, med_id, slot, status, at, qty, note) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(med_id, slot) DO UPDATE SET id = excluded.id, status = excluded.status, at = excluded.at, qty = excluded.qty, note = excluded.note`,
    [log.id, log.medId, log.slot, log.status, log.at, log.qty, log.note],
  );
}

async function insertMed(db: SQLite.SQLiteDatabase, med: Medication) {
  await db.runAsync(
    'INSERT OR REPLACE INTO medications (id, data, updated_at) VALUES (?, ?, ?)',
    [med.id, JSON.stringify(med), med.updatedAt],
  );
}

let shared: Promise<Storage> | null = null;

/** Opens (once) and migrates the on-device database. Safe to call from headless tasks. */
export function openStorage(): Promise<Storage> {
  shared ??= (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await migrate(db);
    const storage: Storage = {
      async load(): Promise<Snapshot> {
        const meds = await db.getAllAsync<{ data: string }>('SELECT data FROM medications');
        const logs = await db.getAllAsync<LogRow>('SELECT * FROM dose_logs ORDER BY slot');
        const kv = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = 'settings'");
        return {
          medications: meds.map((r) => JSON.parse(r.data) as Medication),
          logs: logs.map(toLog),
          settings: kv ? (JSON.parse(kv.value) as Partial<Settings>) : {},
        };
      },
      async saveMedication(med) {
        await insertMed(db, med);
      },
      async deleteMedication(id) {
        await db.withTransactionAsync(async () => {
          await db.runAsync('DELETE FROM dose_logs WHERE med_id = ?', [id]);
          await db.runAsync('DELETE FROM medications WHERE id = ?', [id]);
        });
      },
      async saveLog(log) {
        await insertLog(db, log);
      },
      async deleteLog(id) {
        await db.runAsync('DELETE FROM dose_logs WHERE id = ?', [id]);
      },
      async saveSettings(settings) {
        await db.runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES ('settings', ?)", [JSON.stringify(settings)]);
      },
      async replaceAll(snapshot) {
        await db.withTransactionAsync(async () => {
          await db.execAsync('DELETE FROM dose_logs; DELETE FROM medications;');
          for (const m of snapshot.medications) await insertMed(db, m);
          for (const l of snapshot.logs) await insertLog(db, l);
          await db.runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES ('settings', ?)", [JSON.stringify(snapshot.settings)]);
        });
      },
    };
    return storage;
  })().catch((e) => {
    // Don't cache a failed open; the next call tries again.
    shared = null;
    throw e;
  });
  return shared;
}

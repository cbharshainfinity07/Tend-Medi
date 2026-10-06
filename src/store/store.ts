import { create } from 'zustand';
import { openStorage } from '@/data/db';
import { newId, type Snapshot, type Storage } from '@/data/storage';
import { logKey, runsOutOn } from '@/domain/schedule';
import { daysBetween, epochToSlot, todayKey } from '@/domain/time';
import { DEFAULT_SETTINGS, type DoseLog, type DoseStatus, type Medication, type Settings } from '@/domain/types';
import { dismissDose, notifyRefill, SNOOZE_MIN, syncReminders } from '@/notifications/engine';
import { cleanOrphanPhotos, deletePhoto, isPhotoName, writePhotoBase64 } from '@/photos/photos';

export type MedDraft = Omit<Medication, 'id' | 'createdAt' | 'updatedAt' | 'refillNotifiedAt'> & { id?: string };

interface State {
  ready: boolean;
  /** Set when on-device storage couldn't be opened; the UI shows a retry screen instead of a blank app. */
  loadError: string | null;
  meds: Medication[];
  logs: DoseLog[];
  settings: Settings;
  init(): Promise<void>;
  saveMed(draft: MedDraft): Promise<Medication>;
  deleteMed(id: string): Promise<void>;
  setPaused(id: string, paused: boolean): Promise<void>;
  logDose(medId: string, slot: string, status: DoseStatus, opts?: { at?: number; note?: string; qty?: number }): Promise<void>;
  logAsNeeded(medId: string, qty: number): Promise<void>;
  undoLog(medId: string, slot: string): Promise<void>;
  snooze(medId: string, slot: string, minutes?: number): Promise<void>;
  refill(medId: string, amount: number): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  restore(snapshot: Snapshot): Promise<void>;
  resync(): void;
}

let storage: Storage | null = null;
const db = async () => (storage ??= await openStorage());

let initPromise: Promise<void> | null = null;

export const useStore = create<State>()((set, get) => {
  const persistMed = async (med: Medication) => {
    set({ meds: upsert(get().meds, med) });
    await (await db()).saveMedication(med);
  };

  const qtyFor = (med: Medication, slot: string) => {
    const t = slot.split('T')[1];
    return 'times' in med.schedule ? (med.schedule.times.find((x) => x.time === t)?.qty ?? 1) : med.schedule.qty;
  };

  /** Stock moves only on transitions into/out of "taken", so replays and corrections stay idempotent. */
  const adjustStock = async (med: Medication, delta: number) => {
    if (med.stock == null || delta === 0) return;
    const stock = Math.max(0, round(med.stock + delta));
    let refillNotifiedAt = med.refillNotifiedAt;
    const low = med.refillAt != null && stock <= med.refillAt;
    if (!low) refillNotifiedAt = null;
    const next = { ...med, stock, refillNotifiedAt, updatedAt: Date.now() };
    if (low && med.refillNotifiedAt == null) {
      next.refillNotifiedAt = Date.now();
      const out = runsOutOn(next, todayKey());
      notifyRefill(next, out ? daysBetween(todayKey(), out) : null).catch(() => undefined);
    }
    await persistMed(next);
  };

  const clearSnooze = (key: string) => {
    const { snoozes } = get().settings;
    if (!(key in snoozes)) return null;
    const rest = { ...snoozes };
    delete rest[key];
    return rest;
  };

  return {
    ready: false,
    loadError: null,
    meds: [],
    logs: [],
    settings: DEFAULT_SETTINGS,

    init() {
      initPromise ??= (async () => {
        let snap: Snapshot;
        try {
          snap = await (await db()).load();
        } catch (e) {
          // Allow a later retry to start from scratch.
          initPromise = null;
          storage = null;
          set({ loadError: e instanceof Error ? e.message : String(e) });
          return;
        }
        const now = Date.now();
        const settings = { ...DEFAULT_SETTINGS, ...snap.settings };
        // drop expired snoozes
        settings.snoozes = Object.fromEntries(Object.entries(settings.snoozes).filter(([, t]) => t > now - 3_600_000));
        set({ meds: snap.medications, logs: snap.logs, settings, ready: true, loadError: null });
        cleanOrphanPhotos(new Set(snap.medications.map((m) => m.photo).filter(isPhotoName)));
        get().resync();
      })();
      return initPromise;
    },

    resync() {
      const { meds, logs, settings } = get();
      syncReminders(meds, logs, settings).catch((e) => console.warn('reminder sync failed', e));
    },

    async saveMed(draft) {
      const now = Date.now();
      const existing = draft.id ? get().meds.find((m) => m.id === draft.id) : undefined;
      const med: Medication = {
        ...draft,
        id: existing?.id ?? newId(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        refillNotifiedAt:
          existing && draft.stock != null && draft.refillAt != null && draft.stock <= draft.refillAt
            ? existing.refillNotifiedAt
            : null,
      };
      await persistMed(med);
      if (existing?.photo && existing.photo !== med.photo) deletePhoto(existing.photo);
      get().resync();
      return med;
    },

    async deleteMed(id) {
      deletePhoto(get().meds.find((m) => m.id === id)?.photo);
      set({ meds: get().meds.filter((m) => m.id !== id), logs: get().logs.filter((l) => l.medId !== id) });
      await (await db()).deleteMedication(id);
      get().resync();
    },

    async setPaused(id, paused) {
      const med = get().meds.find((m) => m.id === id);
      if (!med) return;
      await persistMed({ ...med, paused, updatedAt: Date.now() });
      get().resync();
    },

    async logDose(medId, slot, status, opts = {}) {
      const med = get().meds.find((m) => m.id === medId);
      if (!med) return;
      const prev = get().logs.find((l) => l.medId === medId && l.slot === slot);
      const qty = opts.qty ?? prev?.qty ?? qtyFor(med, slot);
      const log: DoseLog = {
        id: prev?.id ?? newId(),
        medId,
        slot,
        status,
        at: opts.at ?? Date.now(),
        qty,
        note: opts.note ?? prev?.note ?? '',
      };
      set({ logs: upsert(get().logs, log) });
      await (await db()).saveLog(log);
      const wasTaken = prev?.status === 'taken';
      const isTaken = status === 'taken';
      if (wasTaken !== isTaken) await adjustStock(med, isTaken ? -qty : prev!.qty);
      const snoozes = clearSnooze(logKey(medId, slot));
      if (snoozes) await get().updateSettings({ snoozes });
      else get().resync();
      dismissDose(medId, slot).catch(() => undefined);
    },

    async logAsNeeded(medId, qty) {
      await get().logDose(medId, epochToSlot(Date.now()), 'taken', { qty });
    },

    async undoLog(medId, slot) {
      const prev = get().logs.find((l) => l.medId === medId && l.slot === slot);
      if (!prev) return;
      set({ logs: get().logs.filter((l) => l.id !== prev.id) });
      await (await db()).deleteLog(prev.id);
      const med = get().meds.find((m) => m.id === medId);
      if (med && prev.status === 'taken') await adjustStock(med, prev.qty);
      get().resync();
    },

    async snooze(medId, slot, minutes = SNOOZE_MIN) {
      const until = Date.now() + minutes * 60_000;
      await get().updateSettings({ snoozes: { ...get().settings.snoozes, [logKey(medId, slot)]: until } });
      dismissDose(medId, slot).catch(() => undefined);
    },

    async refill(medId, amount) {
      const med = get().meds.find((m) => m.id === medId);
      if (!med) return;
      await adjustStock({ ...med, stock: med.stock ?? 0 }, amount);
    },

    async updateSettings(patch) {
      const settings = { ...get().settings, ...patch };
      set({ settings });
      await (await db()).saveSettings(settings);
      get().resync();
    },

    async restore(snapshot) {
      const settings = { ...DEFAULT_SETTINGS, ...snapshot.settings, onboarded: true, snoozes: {} };
      for (const [name, data] of Object.entries(snapshot.photos ?? {})) writePhotoBase64(name, data);
      await (await db()).replaceAll({ ...snapshot, photos: undefined, settings });
      set({ meds: snapshot.medications, logs: snapshot.logs, settings });
      get().resync();
    },
  };
});

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

const round = (n: number) => Math.round(n * 100) / 100;

export const medById = (id: string) => useStore.getState().meds.find((m) => m.id === id);

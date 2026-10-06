export type MedForm = 'tablet' | 'capsule' | 'softgel' | 'liquid' | 'injection' | 'drops' | 'inhaler' | 'other';

export type FoodRule = 'before' | 'with' | 'after' | 'any';

export type PillColor = 'chalk' | 'pine' | 'coral' | 'amber' | 'slate' | 'rose' | 'plum';

/** A dose at a wall-clock time. `time` is local "HH:mm"; `qty` is units (tablets, ml…). */
export interface DoseTime {
  time: string;
  qty: number;
}

export type Schedule =
  /** Every day. `everyHours` is only a UI hint for "every 8 hours" style presets. */
  | { kind: 'daily'; times: DoseTime[]; everyHours?: number }
  /** Specific weekdays, 0 = Sunday … 6 = Saturday. */
  | { kind: 'weekdays'; days: number[]; times: DoseTime[] }
  /** Every N days counted from the start date. */
  | { kind: 'interval'; everyDays: number; times: DoseTime[] }
  /** No reminders; logged when taken. */
  | { kind: 'asNeeded'; qty: number; maxPerDay?: number };

export interface Medication {
  id: string;
  name: string;
  strength: string;
  unit: string;
  form: MedForm;
  color: PillColor;
  food: FoodRule;
  instructions: string;
  notes: string;
  schedule: Schedule;
  /** Local date "YYYY-MM-DD". */
  startDate: string;
  /** Inclusive local date, or null for ongoing. */
  endDate: string | null;
  /** Units left, or null when not tracking stock. */
  stock: number | null;
  /** Remind to refill when stock drops to this many units. */
  refillAt: number | null;
  /** Set when the refill reminder fired; cleared when stock is topped up. */
  refillNotifiedAt: number | null;
  /** File name of the user's photo of the medicine or its box (see src/photos). Optional. */
  photo?: string | null;
  remindersOn: boolean;
  nagOn: boolean;
  paused: boolean;
  createdAt: number;
  updatedAt: number;
}

export type DoseStatus = 'taken' | 'skipped' | 'missed';

export interface DoseLog {
  id: string;
  medId: string;
  /** Scheduled local slot "YYYY-MM-DDTHH:mm" (for as-needed doses: when it was taken). */
  slot: string;
  status: DoseStatus;
  /** Epoch ms when the dose was actually taken / the action happened. */
  at: number;
  qty: number;
  note: string;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  onboarded: boolean;
  name: string;
  theme: ThemePref;
  simpleMode: boolean;
  /** Minutes after the scheduled time before an unlogged dose counts as missed. */
  missedAfterMin: number;
  nagEveryMin: number;
  nagCount: number;
  hideNamesOnLockScreen: boolean;
  lastBackupAt: number | null;
  /** Active snoozes: slot key "medId|slot" -> epoch ms to re-remind at. */
  snoozes: Record<string, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  name: '',
  theme: 'system',
  simpleMode: false,
  missedAfterMin: 180,
  nagEveryMin: 10,
  nagCount: 2,
  hideNamesOnLockScreen: false,
  lastBackupAt: null,
  snoozes: {},
};

/** A concrete scheduled dose on a given day. */
export interface Occurrence {
  medId: string;
  slot: string;
  date: string;
  time: string;
  qty: number;
  /** Epoch ms of the scheduled moment in local time. */
  at: number;
}

export type OccurrenceState = DoseStatus | 'due' | 'upcoming';

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { foodLabel, formatQty, indexLogs, logKey, occurrencesBetween, strengthLabel } from '@/domain/schedule';
import { slotToEpoch } from '@/domain/time';
import type { DoseLog, Medication, Settings } from '@/domain/types';

export const DOSE_CATEGORY = 'dose';
export const ACTION_TAKEN = 'TAKEN';
export const ACTION_SNOOZE = 'SNOOZE';
export const ACTION_SKIP = 'SKIP';
export const CHANNEL_DOSES = 'doses';
export const CHANNEL_REFILLS = 'refills';
export const SNOOZE_MIN = 10;

/** iOS keeps at most 64 pending local notifications per app; stay safely below it. */
const MAX_PENDING = 60;
const HORIZON_DAYS = 7;

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

export type DosePayload = { medId: string; slot: string };

export async function setupNotifications(): Promise<void> {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_DOSES, {
      name: 'Dose reminders',
      description: 'Reminders at the time each dose is due',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_REFILLS, {
      name: 'Refill reminders',
      description: 'When a medication is running low',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  // iOS can't reliably run JS for background actions, so actions that write data open the app there.
  // On Android they run headlessly via the background task registered in index.ts.
  const iosOpens = Platform.OS === 'ios';
  await Notifications.setNotificationCategoryAsync(DOSE_CATEGORY, [
    { identifier: ACTION_TAKEN, buttonTitle: 'Mark taken', options: { opensAppToForeground: iosOpens } },
    { identifier: ACTION_SNOOZE, buttonTitle: `Snooze ${SNOOZE_MIN} min`, options: { opensAppToForeground: false } },
    { identifier: ACTION_SKIP, buttonTitle: 'Skip', options: { opensAppToForeground: iosOpens, isDestructive: true } },
  ]);
}

export async function hasPermission(): Promise<boolean> {
  if (!supported) return false;
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return true;
  const ios = p.ios?.status;
  return ios === Notifications.IosAuthorizationStatus.PROVISIONAL || ios === Notifications.IosAuthorizationStatus.EPHEMERAL;
}

export async function requestPermission(): Promise<boolean> {
  if (!supported) return false;
  const p = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

function doseContent(med: Medication, qty: number, payload: DosePayload, settings: Settings, kind: 'due' | 'nag' | 'snooze') {
  const hide = settings.hideNamesOnLockScreen;
  const name = hide ? 'your medication' : med.name;
  const title =
    kind === 'due' ? `Time for ${name}` : kind === 'snooze' ? `Snoozed: ${name}` : `Still to take: ${name}`;
  const parts = hide ? ['Open Tend to see the details'] : [formatQty(med, qty), strengthLabel(med), foodLabel(med.food)];
  const content: Notifications.NotificationContentInput = {
    title,
    body: parts.filter(Boolean).join(' · '),
    data: payload,
    categoryIdentifier: DOSE_CATEGORY,
    sound: 'default',
    interruptionLevel: 'timeSensitive',
    priority: Notifications.AndroidNotificationPriority.MAX,
    color: '#1F5A4C',
  };
  return content;
}

interface Planned {
  at: number;
  content: Notifications.NotificationContentInput;
  id: string;
}

export function planReminders(meds: Medication[], logs: DoseLog[], settings: Settings, now = Date.now()): Planned[] {
  const byId = new Map(meds.map((m) => [m.id, m]));
  const logIdx = indexLogs(logs);
  const reminding = meds.filter((m) => m.remindersOn && !m.paused);
  const nagSpan = settings.nagCount * settings.nagEveryMin * 60_000;
  const plans: Planned[] = [];

  for (const o of occurrencesBetween(reminding, now - nagSpan, now + HORIZON_DAYS * 86_400_000)) {
    const key = logKey(o.medId, o.slot);
    if (logIdx.has(key) || settings.snoozes[key]) continue;
    const med = byId.get(o.medId)!;
    const payload = { medId: o.medId, slot: o.slot };
    if (o.at > now) plans.push({ at: o.at, id: `due|${key}`, content: doseContent(med, o.qty, payload, settings, 'due') });
    if (med.nagOn) {
      for (let k = 1; k <= settings.nagCount; k++) {
        const at = o.at + k * settings.nagEveryMin * 60_000;
        if (at > now) plans.push({ at, id: `nag${k}|${key}`, content: doseContent(med, o.qty, payload, settings, 'nag') });
      }
    }
  }

  for (const [key, until] of Object.entries(settings.snoozes)) {
    const [medId, slot] = key.split('|');
    const med = byId.get(medId);
    if (!med || until <= now || logIdx.has(key)) continue;
    const qty = 'times' in med.schedule ? (med.schedule.times.find((t) => slot.endsWith(t.time))?.qty ?? 1) : 1;
    plans.push({ at: until, id: `snooze|${key}`, content: doseContent(med, qty, { medId, slot }, settings, 'snooze') });
  }

  // Main reminders win over nags when the budget is tight.
  plans.sort((a, b) => a.at - b.at || (a.id.startsWith('nag') ? 1 : 0) - (b.id.startsWith('nag') ? 1 : 0));
  const firstPass = plans.filter((p) => !p.id.startsWith('nag')).slice(0, MAX_PENDING);
  const budget = MAX_PENDING - firstPass.length;
  const lastMain = firstPass.at(-1)?.at ?? Infinity;
  const nags = plans.filter((p) => p.id.startsWith('nag') && p.at <= lastMain).slice(0, budget);
  return [...firstPass, ...nags].sort((a, b) => a.at - b.at);
}

let chain: Promise<void> = Promise.resolve();

/** Replace all scheduled reminders with a fresh plan. Calls are serialized. */
export function syncReminders(meds: Medication[], logs: DoseLog[], settings: Settings): Promise<void> {
  if (!supported) return Promise.resolve();
  chain = chain
    .catch(() => undefined)
    .then(async () => {
      if (!(await hasPermission())) return;
      const plans = planReminders(meds, logs, settings);
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const p of plans) {
        await Notifications.scheduleNotificationAsync({
          identifier: p.id,
          content: p.content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: p.at,
            channelId: CHANNEL_DOSES,
          },
        });
      }
    });
  return chain;
}

/** Remove reminders for a dose that was just logged from the notification tray. */
export async function dismissDose(medId: string, slot: string): Promise<void> {
  if (!supported) return;
  const presented = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(
    presented
      .filter((n) => {
        const d = n.request.content.data as Partial<DosePayload> | undefined;
        return d?.medId === medId && d?.slot === slot;
      })
      .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
  );
}

export async function notifyRefill(med: Medication, daysLeft: number | null): Promise<void> {
  if (!supported || !(await hasPermission())) return;
  const left = `${med.stock} left`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Refill soon: ${med.name}`,
      body: daysLeft != null ? `${left}, about ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.` : `${left}.`,
      data: { medId: med.id, refill: true },
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_REFILLS } : null,
  });
}

export async function sendTestReminder(): Promise<boolean> {
  if (!supported || !(await hasPermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test reminder',
      body: 'This is how your dose reminders will look and sound.',
      sound: 'default',
      interruptionLevel: 'timeSensitive',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_DOSES },
  });
  return true;
}

export function isDosePayload(data: unknown): data is DosePayload {
  const d = data as Partial<DosePayload> | null | undefined;
  return !!d && typeof d.medId === 'string' && typeof d.slot === 'string' && !Number.isNaN(slotToEpoch(d.slot));
}

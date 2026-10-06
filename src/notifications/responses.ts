import * as Notifications from 'expo-notifications';
import { useStore } from '@/store/store';
import { ACTION_SKIP, ACTION_SNOOZE, ACTION_TAKEN, isDosePayload } from './engine';

export type ResponseOutcome = { kind: 'open'; medId: string; slot: string } | { kind: 'handled' } | { kind: 'ignored' };

/**
 * Apply a notification response. Logging is idempotent per dose slot, so replaying the
 * same response (e.g. from getLastNotificationResponseAsync after a cold start) is safe.
 */
export async function applyResponse(actionIdentifier: string, data: unknown): Promise<ResponseOutcome> {
  if (!isDosePayload(data)) return { kind: 'ignored' };
  const store = useStore.getState();
  await store.init();
  const { medId, slot } = data;
  switch (actionIdentifier) {
    case ACTION_TAKEN:
      await store.logDose(medId, slot, 'taken');
      return { kind: 'handled' };
    case ACTION_SKIP:
      await store.logDose(medId, slot, 'skipped');
      return { kind: 'handled' };
    case ACTION_SNOOZE:
      await store.snooze(medId, slot);
      return { kind: 'handled' };
    case Notifications.DEFAULT_ACTION_IDENTIFIER:
      return { kind: 'open', medId, slot };
    default:
      return { kind: 'ignored' };
  }
}

/** Best-effort extraction of a response from the headless task payload (shape differs by OS version). */
export function responseFromTaskData(data: unknown): { action: string; payload: unknown } | null {
  const d = data as Record<string, any> | null | undefined;
  if (!d) return null;
  const action: unknown = d.actionIdentifier ?? d.response?.actionIdentifier;
  const content = d.notification?.request?.content ?? d.response?.notification?.request?.content;
  if (typeof action !== 'string' || !content) return null;
  return { action, payload: content.data };
}

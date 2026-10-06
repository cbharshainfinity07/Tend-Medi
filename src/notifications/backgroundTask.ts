import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { applyResponse, responseFromTaskData } from './responses';

// Android runs this headlessly when a reminder action (Mark taken / Snooze / Skip) is tapped
// while the app is backgrounded or closed, so the dose is logged without opening the app.
const BACKGROUND_NOTIFICATION_TASK = 'tend-notification-actions';

if (Platform.OS === 'android') {
  TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
    if (error) return;
    const r = responseFromTaskData(data);
    if (r) await applyResponse(r.action, r.payload);
  });
  Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(() => undefined);
}

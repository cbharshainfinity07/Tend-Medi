import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

const pkg = () => Constants.expoConfig?.android?.package ?? 'app.tend.reminders';

async function open(action: string, withPackage: boolean) {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(action, withPackage ? { data: `package:${pkg()}` } : undefined);
  } catch {
    await Linking.openSettings();
  }
}

/** Android 12+: lets reminders fire at the exact minute instead of being batched. */
export const openExactAlarmSettings = () => open('android.settings.REQUEST_SCHEDULE_EXACT_ALARM', true);

/** Lets the user exempt Tend from battery optimisation so reminders survive Doze overnight. */
export const openBatterySettings = () => open('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS', false);

export const openNotificationSettings = () => Linking.openSettings();

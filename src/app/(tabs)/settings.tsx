import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { BackupError, exportBackup, exportCsv, pickBackup } from '@/backup/backup';
import type { Snapshot } from '@/data/storage';
import type { ThemePref } from '@/domain/types';
import { openBatterySettings, openExactAlarmSettings, openNotificationSettings } from '@/lib/androidSettings';
import { formatDate } from '@/lib/format';
import { dateKey } from '@/domain/time';
import { hasPermission, requestPermission, sendTestReminder } from '@/notifications/engine';
import { useStore } from '@/store/store';
import { isAndroid, useTheme } from '@/theme/theme';
import { Icon } from '@/ui/Icon';
import { Card, Cell, Field, Row, SectionLabel, Segmented, Toggle } from '@/ui/kit';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { toast } from '@/ui/Toast';

function confirm(title: string, message: string, ok: string, destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(!!globalThis.confirm?.(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

export default function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const meds = useStore((s) => s.meds);
  const logs = useStore((s) => s.logs);
  const update = useStore((s) => s.updateSettings);
  const { c } = useTheme();
  const [notifOk, setNotifOk] = useState<boolean | null>(null);
  const [name, setName] = useState(settings.name);

  useEffect(() => {
    hasPermission()
      .then(setNotifOk)
      .catch(() => setNotifOk(false));
  }, []);

  const backup = async () => {
    const ok = await exportBackup(meds, logs, settings);
    if (ok) await update({ lastBackupAt: Date.now() });
  };

  const restore = async () => {
    let snap: Snapshot | null;
    try {
      snap = await pickBackup();
    } catch (e) {
      const msg = e instanceof BackupError ? e.message : 'That file could not be read.';
      if (Platform.OS === 'web') globalThis.alert?.(msg);
      else Alert.alert('Restore failed', msg);
      return;
    }
    if (!snap) return;
    const go = await confirm(
      'Replace data on this phone?',
      `The backup has ${snap.medications.length} medications and ${snap.logs.length} logged doses. Everything currently in Tend will be replaced.`,
      'Restore',
      true,
    );
    if (!go) return;
    await useStore.getState().restore(snap);
    toast('Backup restored', { icon: 'restore' });
  };

  const eraseAll = async () => {
    const go = await confirm('Erase all data?', 'This deletes every medication, dose log and setting from this phone. Make a backup first if you might need it.', 'Erase', true);
    if (!go) return;
    await useStore.getState().restore({ medications: [], logs: [], settings: { onboarded: true, name: settings.name } });
    toast('All data erased', { icon: 'trash' });
  };

  return (
    <Screen bottomInset={40}>
      <Text v="title" style={{ marginTop: 10, marginBottom: 18, marginHorizontal: 4 }} accessibilityRole="header">
        Settings
      </Text>

      <View style={{ borderRadius: 26, padding: 20, backgroundColor: c.accent, overflow: 'hidden' }}>
        <Icon name="shield" size={26} color={c.accentInk} />
        <Text v="h2" style={{ color: c.accentInk, marginTop: 12 }}>
          Your data stays{'\n'}on this phone.
        </Text>
        <Text v="sub" style={{ color: c.accentInk, opacity: 0.85, marginTop: 8 }}>
          No account, no cloud, no internet needed.
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            marginTop: 14,
            paddingHorizontal: 10,
            height: 28,
            borderRadius: 14,
            backgroundColor: c.accentInk,
          }}
        >
          <Icon name="restore" size={14} color={c.accent} stroke={2.2} />
          <Text v="caption" style={{ color: c.accent, fontSize: 12.5 }}>
            {settings.lastBackupAt
              ? `Last backup ${formatDate(dateKey(new Date(settings.lastBackupAt)), { weekday: 'short', day: 'numeric', month: 'short' })}`
              : 'No backup yet'}
          </Text>
        </View>
      </View>

      <SectionLabel>Backup</SectionLabel>
      <Card padded={false}>
        <Cell first icon="up" title="Export backup" subtitle="Save a file to Files, Drive or a computer" onPress={backup} />
        <Cell icon="folder" title="Restore from file" subtitle="Bring your data to a new phone" onPress={restore} />
        <Cell icon="table" title="Share report with doctor" subtitle="Dose history as a spreadsheet (CSV)" onPress={() => exportCsv(meds, logs)} />
      </Card>

      <SectionLabel>Reminders</SectionLabel>
      <Card padded={false}>
        <Cell
          first
          icon="bell"
          title="Notifications"
          subtitle={notifOk == null ? 'Checking…' : notifOk ? 'On. Reminders will arrive on time' : 'Off. You won’t get reminders'}
          right={
            notifOk === false ? (
              <Text
                v="button"
                tone="accent"
                onPress={async () => {
                  const ok = await requestPermission();
                  setNotifOk(ok);
                  if (!ok) openNotificationSettings();
                }}
              >
                Turn on
              </Text>
            ) : notifOk ? (
              <Icon name="check" size={18} tone="taken" stroke={2.4} />
            ) : null
          }
        />
        <Cell
          icon="play"
          title="Send a test reminder"
          subtitle="Arrives in 5 seconds"
          onPress={async () => {
            const ok = await sendTestReminder();
            toast(ok ? 'Test reminder on its way' : 'Turn on notifications first', { icon: ok ? 'bell' : 'info' });
          }}
        />
        <Cell
          icon="snooze"
          title="Nudge if not marked"
          subtitle={`${settings.nagCount} follow-ups, ${settings.nagEveryMin} min apart`}
          right={<Toggle label="Nudge if not marked" value={settings.nagCount > 0} onChange={(v) => update({ nagCount: v ? 2 : 0 })} />}
        />
        <Cell
          icon="lock"
          title="Hide names on lock screen"
          subtitle="Reminders say “your medication” instead"
          right={<Toggle label="Hide names on lock screen" value={settings.hideNamesOnLockScreen} onChange={(v) => update({ hideNamesOnLockScreen: v })} />}
        />
      </Card>
      <View style={{ marginTop: 12 }}>
        <Text v="caption" style={{ marginLeft: 4, marginBottom: 8 }}>
          Count a dose as missed after
        </Text>
        <Segmented
          options={[60, 120, 180, 360].map((m) => ({ value: String(m), label: `${m / 60} h` }))}
          value={String(settings.missedAfterMin)}
          onChange={(v) => update({ missedAfterMin: Number(v) })}
        />
      </View>

      {isAndroid && (
        <>
          <SectionLabel>Reliability on Android</SectionLabel>
          <Card padded={false}>
            <Cell first icon="alarm" title="Alarms & reminders" subtitle="Allow so reminders ring at the exact minute" onPress={openExactAlarmSettings} />
            <Cell icon="battery" title="Battery: unrestricted" subtitle="Keeps reminders working overnight" onPress={openBatterySettings} />
          </Card>
        </>
      )}

      <SectionLabel>You</SectionLabel>
      <Field label="Your name (optional)" value={name} onChangeText={setName} onBlur={() => update({ name: name.trim() })} placeholder="Used for greetings" autoCapitalize="words" />

      <SectionLabel>Appearance</SectionLabel>
      <Segmented<ThemePref>
        options={[
          { value: 'light', label: 'Light', icon: 'sun' },
          { value: 'dark', label: 'Dark', icon: 'moon' },
          { value: 'system', label: 'System' },
        ]}
        value={settings.theme}
        onChange={(theme) => update({ theme })}
      />
      <Card padded={false} style={{ marginTop: 12 }}>
        <Cell
          first
          icon="heart"
          title="Simple mode"
          subtitle="Bigger text, one dose at a time"
          right={<Toggle label="Simple mode" value={settings.simpleMode} onChange={(v) => update({ simpleMode: v })} />}
        />
        <Cell icon="text" title="Text size" subtitle="Follows your phone’s text size setting" />
      </Card>

      <SectionLabel>Data</SectionLabel>
      <Card padded={false}>
        <Cell first icon="trash" title="Erase all data" danger onPress={eraseAll} />
      </Card>

      <Row gap={8} style={{ justifyContent: 'center', marginTop: 28 }}>
        <Icon name="offline" size={16} tone="ink3" />
        <Text v="caption">Tend 1.0 · works fully offline</Text>
      </Row>
      <Text v="caption" center style={{ marginTop: 6, marginHorizontal: 20 }}>
        Tend is a reminder tool and does not give medical advice. Always follow your doctor’s or pharmacist’s instructions.
      </Text>
    </Screen>
  );
}

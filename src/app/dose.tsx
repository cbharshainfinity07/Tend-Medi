import { router, useLocalSearchParams } from 'expo-router';
import { Dimensions, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logKey, occurrenceState, strengthLabel, formatQty, foodLabel } from '@/domain/schedule';
import { dateKey, slotToEpoch } from '@/domain/time';
import type { DoseStatus } from '@/domain/types';
import { stateMeta } from '@/features/dose-ui';
import { formatClock, formatDate, formatTime, relative } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme/theme';
import { Icon } from '@/ui/Icon';
import { Button, Chip, Row, Tap } from '@/ui/kit';
import { MedThumb } from '@/ui/MedPhoto';
import { celebrate } from '@/ui/motion';
import { Text } from '@/ui/Text';
import { toast } from '@/ui/Toast';

export default function DoseSheet() {
  const { medId, slot } = useLocalSearchParams<{ medId: string; slot: string }>();
  const med = useStore((s) => s.meds.find((m) => m.id === medId));
  const log = useStore((s) => s.logs.find((l) => l.medId === medId && l.slot === slot));
  const settings = useStore((s) => s.settings);
  const now = useNow();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  if (!med || !slot) {
    return (
      <View style={{ padding: 24 }}>
        <Text v="headline">This dose is no longer scheduled.</Text>
      </View>
    );
  }

  const at = slotToEpoch(slot);
  const [date, time] = slot.split('T');
  const qty = log?.qty ?? ('times' in med.schedule ? (med.schedule.times.find((t) => t.time === time)?.qty ?? 1) : 1);
  const state = occurrenceState({ medId: med.id, slot, date, time, qty, at }, med, log, now, settings) ?? 'upcoming';
  const meta = stateMeta[state];
  const snoozedUntil = settings.snoozes[logKey(med.id, slot)];
  const instructions = [foodLabel(med.food) && `Take ${foodLabel(med.food)}.`, med.instructions].filter(Boolean).join(' ');

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const mark = async (status: DoseStatus, takenAt?: number) => {
    await useStore.getState().logDose(med.id, slot, status, { at: takenAt });
    toast(status === 'taken' ? `${med.name} marked taken` : status === 'skipped' ? 'Dose skipped' : 'Marked as missed', {
      icon: stateMeta[status].icon,
      action: { label: 'Undo', run: () => useStore.getState().undoLog(med.id, slot) },
    });
    close();
    if (status === 'taken') {
      // The sheet is gone by the time this plays, so the burst lands on the screen underneath.
      const { width, height } = Dimensions.get('window');
      setTimeout(() => celebrate(width / 2, height * 0.42), 320);
    }
  };

  const snooze = async (min: number) => {
    await useStore.getState().snooze(med.id, slot, min);
    toast(`We'll remind you in ${min >= 60 ? `${min / 60} hour` : `${min} minutes`}`, { icon: 'snooze' });
    close();
  };

  const isToday = date === dateKey(new Date(now));

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 22, paddingTop: Platform.OS === 'ios' ? 28 : 22, paddingBottom: insets.bottom + 20 }}
      bounces={false}
    >
      <Row gap={16}>
        <MedThumb med={med} size={66} zoomable />
        <View style={{ flex: 1 }}>
          <Text v="h2" accessibilityRole="header">
            {med.name}
          </Text>
          <Text v="sub" style={{ marginTop: 2 }}>
            {[strengthLabel(med), formatQty(med, qty)].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Row>

      <Row gap={8} style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: 10, backgroundColor: c[meta.bg] }}>
          <Icon name={meta.icon} size={15} color={c[meta.fg]} stroke={2.2} />
          <Text v="caption" style={{ color: c[meta.fg], fontSize: 13 }}>
            {log?.status === 'taken' ? `Taken at ${formatClock(log.at)}` : meta.label}
          </Text>
        </View>
        <Text v="sub">
          {isToday ? '' : `${formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })} · `}
          Scheduled {formatTime(time)}
          {!log && state !== 'missed' ? ` · ${relative(at, now)}` : ''}
        </Text>
      </Row>

      {instructions ? (
        <Row gap={10} style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: c.skipSoft, alignItems: 'flex-start' }}>
          <Icon name="note" size={18} tone="skip" />
          <Text v="bodyStrong" tone="ink" style={{ flex: 1, fontSize: 14.5 }}>
            {instructions}
          </Text>
        </Row>
      ) : null}

      <View style={{ gap: 10, marginTop: 20 }}>
        <Button
          kind="taken"
          icon="check"
          label={log?.status === 'taken' ? 'Taken now instead' : 'Taken'}
          height={62}
          trailing={<Text v="mono" style={{ color: c.takenInk, opacity: 0.85 }}>now · {formatClock(now)}</Text>}
          onPress={() => mark('taken')}
        />
        {now > at + 15 * 60_000 && log?.status !== 'taken' && (
          <Button kind="tonal" icon="clock" label={`Taken on time, at ${formatTime(time)}`} onPress={() => mark('taken', at)} />
        )}
        <Row gap={10}>
          <Button kind="skip" icon="skip" label="Skipped" style={{ flex: 1 }} height={58} onPress={() => mark('skipped')} />
          <Button kind="miss" icon="x" label="Missed" style={{ flex: 1 }} height={58} onPress={() => mark('missed')} />
        </Row>
      </View>

      {!log && now < at + settings.missedAfterMin * 60_000 && (
        <>
          <Text v="eyebrow" style={{ marginTop: 26, marginBottom: 12, marginLeft: 2 }}>
            {snoozedUntil ? `Snoozed until ${formatClock(snoozedUntil)}` : 'Remind me again'}
          </Text>
          <Row gap={8}>
            {[10, 30, 60].map((m) => (
              <View key={m} style={{ flex: 1 }}>
                <Chip fill label={m === 60 ? '1 hour' : `${m} min`} onPress={() => snooze(m)} />
              </View>
            ))}
          </Row>
        </>
      )}

      {log && (
        <Tap
          onPress={async () => {
            await useStore.getState().undoLog(med.id, slot);
            toast('Log cleared', { icon: 'restore' });
            close();
          }}
          style={{ marginTop: 22, alignSelf: 'center', padding: 8 }}
          accessibilityLabel="Clear this log"
        >
          <Text v="button" tone="accent">
            Clear this log
          </Text>
        </Tap>
      )}

      <Tap
        onPress={() => {
          close();
          setTimeout(() => router.push({ pathname: '/med/[id]', params: { id: med.id } }), 250);
        }}
        style={{ marginTop: log ? 4 : 20, alignSelf: 'center', padding: 8 }}
        accessibilityLabel={`Open ${med.name} details`}
      >
        <Text v="button" tone="ink2" style={{ fontSize: 14.5 }}>
          Medication details
        </Text>
      </Tap>
    </ScrollView>
  );
}

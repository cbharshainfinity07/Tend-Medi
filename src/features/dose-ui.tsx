import { router } from 'expo-router';
import { type RefObject, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { foodLabel, formatQty, strengthLabel } from '@/domain/schedule';
import type { OccurrenceState } from '@/domain/types';
import { formatClock, formatTime } from '@/lib/format';
import type { DoseItem } from '@/lib/hooks';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';
import { Icon, type IconName } from '@/ui/Icon';
import { Tap } from '@/ui/kit';
import { MedThumb } from '@/ui/MedPhoto';
import { celebrateFrom, measurable, usePop } from '@/ui/motion';
import { Text } from '@/ui/Text';
import { toast } from '@/ui/Toast';

export const stateMeta: Record<OccurrenceState, { label: string; icon: IconName; fg: keyof Palette; bg: keyof Palette }> = {
  taken: { label: 'Taken', icon: 'check', fg: 'taken', bg: 'takenSoft' },
  skipped: { label: 'Skipped', icon: 'skip', fg: 'skip', bg: 'skipSoft' },
  missed: { label: 'Missed', icon: 'x', fg: 'miss', bg: 'missSoft' },
  due: { label: 'Due now', icon: 'bell', fg: 'accent', bg: 'accentSoft' },
  upcoming: { label: 'Upcoming', icon: 'clock', fg: 'ink3', bg: 'surface2' },
};

export function openDose(item: DoseItem) {
  router.push({ pathname: '/dose', params: { medId: item.med.id, slot: item.o.slot } });
}

/** One-tap "taken" with an undo affordance — the fastest path for busy days. */
export async function quickTake(item: DoseItem, from?: RefObject<View | null>) {
  const store = useStore.getState();
  if (from) celebrateFrom(from);
  await store.logDose(item.med.id, item.o.slot, 'taken');
  toast(`${item.med.name} marked taken`, {
    icon: 'check',
    action: { label: 'Undo', run: () => store.undoLog(item.med.id, item.o.slot) },
  });
}

export function doseLine(item: DoseItem): string {
  const parts = [formatQty(item.med, item.o.qty), strengthLabel(item.med)];
  return parts.filter(Boolean).join(' · ');
}

/** Most useful fact first so it survives truncation on small screens and large text. */
function subtitle(item: DoseItem): string {
  const { log, state, med } = item;
  const amount = item.o.qty === 1 ? strengthLabel(med) || formatQty(med, 1) : formatQty(med, item.o.qty);
  if (log && state === 'taken') return `Taken ${formatClock(log.at)} · ${amount}`;
  if (state === 'skipped') return log?.note ? `Skipped · ${log.note}` : `Skipped · ${amount}`;
  if (state === 'missed') return `Not logged · ${amount}`;
  const food = foodLabel(med.food);
  return [formatQty(med, item.o.qty), food || strengthLabel(med)].filter(Boolean).join(' · ');
}

export function DoseRow({ item }: { item: DoseItem }) {
  const { c } = useTheme();
  const meta = stateMeta[item.state];
  const open = item.state === 'due' || item.state === 'upcoming' || item.state === 'missed';
  const a11y = `${item.med.name}, ${formatTime(item.o.time)}, ${meta.label}`;
  const dotRef = useRef<View>(null);
  const pop = usePop(item.state);
  return (
    <View style={styles.row}>
      <Tap onPress={() => openDose(item)} scaleTo={0.985} accessibilityLabel={a11y} accessibilityHint="Opens dose options" style={styles.main}>
      <Text v="mono" tone="ink2" style={styles.time}>
        {formatTime(item.o.time)}
      </Text>
      <MedThumb med={item.med} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text v="headline" numberOfLines={1}>
          {item.med.name}
        </Text>
        <Text v="sub" tone={item.state === 'missed' ? 'miss' : 'ink2'} numberOfLines={1}>
          {subtitle(item)}
        </Text>
      </View>
      </Tap>
      <Animated.View ref={dotRef} {...measurable} style={{ transform: [{ scale: pop }] }}>
      <Tap
        onPress={() => (open ? quickTake(item, dotRef) : openDose(item))}
        hapticKind={open ? 'success' : 'tap'}
        hitSlop={10}
        accessibilityLabel={open ? `Mark ${item.med.name} taken` : `${meta.label}. Change`}
        style={[
          styles.dot,
          item.state === 'due'
            ? { backgroundColor: c.accent }
            : open
              ? { borderWidth: 1.8, borderColor: item.state === 'missed' ? c.miss : c.line }
              : { backgroundColor: c[meta.bg] },
        ]}
      >
        <Icon
          name={open ? 'check' : meta.icon}
          size={18}
          stroke={2.4}
          color={item.state === 'due' ? c.accentInk : open ? (item.state === 'missed' ? c.miss : c.ink3) : c[meta.fg]}
        />
      </Tap>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, minHeight: 68 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  time: { width: 58 },
  dot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

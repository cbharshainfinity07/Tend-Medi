import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { daysBetween, todayKey } from '@/domain/time';
import { needsRefill, runsOutOn, scheduleSummary, strengthLabel } from '@/domain/schedule';
import type { Medication } from '@/domain/types';
import { formatDate } from '@/lib/format';
import { useStore } from '@/store/store';
import { isAndroid, useTheme } from '@/theme/theme';
import { Icon } from '@/ui/Icon';
import { Button, Card, IconButton, Row, SectionLabel, Tap } from '@/ui/kit';
import { MedThumb } from '@/ui/MedPhoto';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function Meds() {
  const meds = useStore((s) => s.meds);
  const { c } = useTheme();
  const today = todayKey();

  const groups = useMemo(() => {
    const sorted = [...meds].sort((a, b) => a.name.localeCompare(b.name));
    const ended = (m: Medication) => !!m.endDate && m.endDate < today;
    return {
      low: sorted.filter((m) => needsRefill(m) && !m.paused && !ended(m)),
      ongoing: sorted.filter((m) => !m.paused && !ended(m) && !m.endDate),
      courses: sorted.filter((m) => !m.paused && !ended(m) && !!m.endDate),
      paused: sorted.filter((m) => m.paused && !ended(m)),
      ended: sorted.filter(ended),
    };
  }, [meds, today]);

  return (
    <Screen bottomInset={40}>
      <Row style={{ justifyContent: 'space-between', marginTop: 10, marginBottom: 6, marginHorizontal: 4 }}>
        <Text v="title" accessibilityRole="header">
          Medications
        </Text>
        {isAndroid ? null : <IconButton name="plus" label="Add medication" onPress={() => router.push('/med/new')} />}
      </Row>

      {meds.length === 0 && (
        <Card style={{ marginTop: 16 }}>
          <Text v="headline">No medications yet</Text>
          <Text v="sub" style={{ marginTop: 4, marginBottom: 16 }}>
            Add your first one to start getting reminders.
          </Text>
          <Button label="Add medication" icon="plus" kind="accent" onPress={() => router.push('/med/new')} />
        </Card>
      )}

      {groups.low.map((m) => {
        const out = runsOutOn(m, today);
        const days = out ? daysBetween(today, out) : null;
        return (
          <Tap
            key={`low-${m.id}`}
            onPress={() => router.push({ pathname: '/med/[id]', params: { id: m.id } })}
            accessibilityLabel={`${m.name} is running low. ${m.stock} left.`}
            style={{ marginTop: 14, borderRadius: 22, padding: 16, backgroundColor: c.skipSoft, flexDirection: 'row', alignItems: 'center', gap: 14 }}
          >
            <MedThumb med={m} />
            <View style={{ flex: 1 }}>
              <Text v="headline">{m.name} is running low</Text>
              <Text v="sub" style={{ marginTop: 2 }}>
                {m.stock} left{days != null ? ` · about ${days} ${days === 1 ? 'day' : 'days'}` : ''}
              </Text>
            </View>
            <Icon name="chevron" size={18} tone="ink2" />
          </Tap>
        );
      })}

      <Group title={`Ongoing · ${groups.ongoing.length}`} meds={groups.ongoing} />
      <Group title="Courses" meds={groups.courses} />
      <Group title="Paused" meds={groups.paused} />
      <Group title="Finished" meds={groups.ended} />

      {isAndroid && meds.length > 0 && <Button label="Add medication" icon="plus" kind="tonal" style={{ marginTop: 24 }} onPress={() => router.push('/med/new')} />}
    </Screen>
  );
}

function Group({ title, meds }: { title: string; meds: Medication[] }) {
  if (!meds.length) return null;
  return (
    <>
      <SectionLabel>{title}</SectionLabel>
      <Card padded={false}>
        {meds.map((m, i) => (
          <MedRow key={m.id} med={m} first={i === 0} />
        ))}
      </Card>
    </>
  );
}

function MedRow({ med, first }: { med: Medication; first: boolean }) {
  const { c } = useTheme();
  const low = needsRefill(med);
  const course = med.endDate && med.endDate >= todayKey();
  const sub = course
    ? `${scheduleSummary(med).split(' · ')[0]} · until ${formatDate(med.endDate!, { day: 'numeric', month: 'short' })}`
    : scheduleSummary(med);
  return (
    <Tap
      onPress={() => router.push({ pathname: '/med/[id]', params: { id: med.id } })}
      scaleTo={0.985}
      accessibilityLabel={`${med.name}, ${sub}${med.stock != null ? `, ${med.stock} left` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderTopWidth: first ? 0 : 1, borderTopColor: c.line, opacity: med.paused ? 0.6 : 1 }}
    >
      <MedThumb med={med} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text v="headline" numberOfLines={1}>
          {med.name} <Text v="sub">{strengthLabel(med)}</Text>
        </Text>
        <Text v="caption" style={{ marginTop: 3 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {med.stock != null && (
        <View style={{ alignItems: 'flex-end' }}>
          <Text v="mono" tone={low ? 'skip' : 'ink'}>
            {med.stock}
          </Text>
          <Text v="caption" style={{ fontSize: 11.5 }}>
            left
          </Text>
        </View>
      )}
    </Tap>
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { foodLabel, formatQty, needsRefill, runsOutOn, scheduleSummary, strengthLabel } from '@/domain/schedule';
import { adherence } from '@/domain/stats';
import { addDays, daysBetween, todayKey } from '@/domain/time';
import { stateMeta } from '@/features/dose-ui';
import { formatClock, formatDate, formatTime } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme/theme';
import { Icon } from '@/ui/Icon';
import { Button, Card, IconButton, Row, SectionLabel, Stepper, Tap } from '@/ui/kit';
import { PillGlyph } from '@/ui/PillGlyph';
import { MedThumb } from '@/ui/MedPhoto';
import { photoUri } from '@/photos/photos';
import { Footer, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { toast } from '@/ui/Toast';

export default function MedDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const med = useStore((s) => s.meds.find((m) => m.id === id));
  const meds = useStore((s) => s.meds);
  const logs = useStore((s) => s.logs);
  const missedAfterMin = useStore((s) => s.settings.missedAfterMin);
  const now = useNow(60_000);
  const { c } = useTheme();
  const [refillOpen, setRefillOpen] = useState(false);
  const [refillAmount, setRefillAmount] = useState(30);

  const today = todayKey(new Date(now));
  const adh = useMemo(
    () => (med ? adherence(meds, logs, addDays(today, -29), today, now, { missedAfterMin }, med.id) : null),
    [med, meds, logs, today, now, missedAfterMin],
  );
  const recent = useMemo(() => logs.filter((l) => l.medId === id).sort((a, b) => b.slot.localeCompare(a.slot)).slice(0, 6), [logs, id]);

  if (!med) {
    return (
      <Screen>
        <IconButton name="back" label="Back" onPress={() => router.back()} />
        <Text v="headline" style={{ marginTop: 20 }}>
          This medication was removed.
        </Text>
      </Screen>
    );
  }

  const out = runsOutOn(med, today);
  const daysLeft = out ? daysBetween(today, out) : null;
  const low = needsRefill(med);
  const times = 'times' in med.schedule ? med.schedule.times : [];
  const instructions = [foodLabel(med.food) && `Take ${foodLabel(med.food)}.`, med.instructions].filter(Boolean).join(' ');

  return (
    <Screen
      bottomInset={28}
      footer={
        <Footer>
          <Row gap={10}>
            <Button
              kind="ghost"
              icon={med.paused ? 'play' : 'pause'}
              label={med.paused ? 'Resume' : 'Pause'}
              style={{ flex: 1 }}
              onPress={async () => {
                await useStore.getState().setPaused(med.id, !med.paused);
                toast(med.paused ? `${med.name} resumed` : `${med.name} paused. No reminders until you resume.`, { icon: med.paused ? 'play' : 'pause' });
              }}
            />
            <Button kind="primary" icon="edit" label="Edit" style={{ flex: 1.4 }} onPress={() => router.push({ pathname: '/med/new', params: { id: med.id } })} />
          </Row>
        </Footer>
      }
    >
      <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <IconButton name="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/meds'))} />
        {med.paused && (
          <View style={{ paddingHorizontal: 12, height: 30, borderRadius: 10, justifyContent: 'center', backgroundColor: c.surface2 }}>
            <Text v="caption" tone="ink2">
              Paused
            </Text>
          </View>
        )}
      </Row>

      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, marginHorizontal: 2 }}>
        <View style={{ flex: 1 }}>
          <Text v="display" accessibilityRole="header" numberOfLines={2}>
            {med.name}
          </Text>
          <Text v="body" style={{ marginTop: 8 }}>
            {[strengthLabel(med), med.form, scheduleSummary(med).split(' · ')[0].toLowerCase()].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {photoUri(med.photo) ? <MedThumb med={med} size={92} round zoomable /> : <PillGlyph form={med.form} color={med.color} size={88} />}
      </Row>

      <View style={{ flexDirection: 'row', marginTop: 22, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
        <Stat value={adh?.pct != null ? `${adh.pct}%` : '—'} label="Last 30 days" />
        <Stat value={med.stock != null ? String(med.stock) : '—'} label="Left" border />
        <Stat value={out ? formatDate(out, { day: 'numeric', month: 'short' }) : '—'} label="Runs out" border />
      </View>

      {med.stock != null && (
        <Card style={{ marginTop: 16 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={10}>
              <Icon name="bottle" tone={low ? 'skip' : 'ink2'} />
              <Text v="headline">{low ? (daysLeft != null ? `Refill in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}` : 'Refill soon') : 'Supply'}</Text>
            </Row>
            <Tap onPress={() => setRefillOpen((v) => !v)} accessibilityLabel="Log refill" style={{ backgroundColor: c.ink, paddingHorizontal: 14, height: 36, borderRadius: 12, justifyContent: 'center' }}>
              <Text v="button" style={{ color: c.bg, fontSize: 14 }}>
                Log refill
              </Text>
            </Tap>
          </Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surface2, marginTop: 14, overflow: 'hidden' }}>
            <View
              style={{
                width: `${Math.min(100, ((med.stock ?? 0) / Math.max(30, (med.refillAt ?? 0) * 3)) * 100)}%`,
                height: '100%',
                borderRadius: 4,
                backgroundColor: low ? c.skip : c.taken,
              }}
            />
          </View>
          <Text v="caption" style={{ marginTop: 9 }}>
            {med.refillAt != null ? `You'll get a reminder when ${med.refillAt} are left.` : 'Refill reminders are off.'}
          </Text>
          {refillOpen && (
            <Row style={{ justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.line }}>
              <Text v="bodyStrong" tone="ink">
                Add
              </Text>
              <Stepper value={refillAmount} min={1} max={1000} step={refillAmount >= 10 ? 5 : 1} label="refill amount" onChange={setRefillAmount} />
              <Button
                kind="accent"
                label="Add"
                height={40}
                style={{ paddingHorizontal: 18 }}
                onPress={async () => {
                  await useStore.getState().refill(med.id, refillAmount);
                  setRefillOpen(false);
                  toast(`Added ${refillAmount}. ${med.stock! + refillAmount} left.`, { icon: 'bottle' });
                }}
              />
            </Row>
          )}
        </Card>
      )}

      {times.length > 0 && (
        <>
          <SectionLabel>Schedule</SectionLabel>
          {times.map((t, i) => (
            <Row key={t.time} style={{ paddingVertical: 12, paddingHorizontal: 2, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Text v="mono" style={{ width: 80, fontSize: 17 }}>
                {formatTime(t.time)}
              </Text>
              <Text v="bodyStrong" tone="ink" style={{ flex: 1 }}>
                {formatQty(med, t.qty)}
              </Text>
              <Text v="sub">{foodLabel(med.food)}</Text>
            </Row>
          ))}
          <Text v="caption" style={{ marginTop: 6, marginLeft: 2 }}>
            {scheduleSummary(med)} · {med.endDate ? `until ${formatDate(med.endDate, { day: 'numeric', month: 'short' })}` : 'ongoing'}
          </Text>
        </>
      )}

      {instructions ? (
        <>
          <SectionLabel>Instructions</SectionLabel>
          <Text v="body" tone="ink" style={{ marginHorizontal: 2 }}>
            {instructions}
          </Text>
        </>
      ) : null}

      {med.notes ? (
        <>
          <SectionLabel>Notes</SectionLabel>
          <View style={{ padding: 18, borderRadius: 20, backgroundColor: c.surface2 }}>
            <Text v="h3" italic style={{ fontSize: 18, lineHeight: 25 }}>
              “{med.notes}”
            </Text>
          </View>
        </>
      ) : null}

      {recent.length > 0 && (
        <>
          <SectionLabel>Recent</SectionLabel>
          {recent.map((l) => {
            const m = stateMeta[l.status];
            const [d, t] = l.slot.split('T');
            return (
              <Row key={l.id} style={{ paddingVertical: 9, paddingHorizontal: 2 }}>
                <Text v="sub" style={{ flex: 1 }}>
                  {formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' })} · {formatTime(t)}
                </Text>
                <Row gap={5}>
                  <Icon name={m.icon} size={15} tone={m.fg} stroke={2.3} />
                  <Text v="caption" tone={m.fg as 'taken'} style={{ fontSize: 13 }}>
                    {l.status === 'taken' ? formatClock(l.at) : m.label}
                  </Text>
                </Row>
              </Row>
            );
          })}
        </>
      )}
    </Screen>
  );
}

function Stat({ value, label, border }: { value: string; label: string; border?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, paddingVertical: 14, paddingHorizontal: border ? 14 : 4, borderLeftWidth: border ? 1 : 0, borderLeftColor: c.line }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text v="h2" style={{ fontSize: 28 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text v="caption" style={{ marginTop: 4 }}>
        {label}
      </Text>
    </View>
  );
}

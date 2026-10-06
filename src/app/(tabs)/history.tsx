import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { exportCsv } from '@/backup/backup';
import { indexLogs } from '@/domain/schedule';
import { adherence, summarizeDay, type DayStatus } from '@/domain/stats';
import { dateKey, todayKey } from '@/domain/time';
import { DoseRow } from '@/features/dose-ui';
import { formatDate, formatMonth, weekdayLetters } from '@/lib/format';
import { useDayItems, useNow, useStreak } from '@/lib/hooks';
import { useStore } from '@/store/store';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { haptic } from '@/ui/haptics';
import { Icon } from '@/ui/Icon';
import { Card, IconButton, Row, SectionLabel, Tap } from '@/ui/kit';
import { GrowBar, Rise } from '@/ui/motion';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function History() {
  const now = useNow(60_000);
  const today = todayKey(new Date(now));
  const [cursor, setCursor] = useState(() => {
    const d = new Date(now);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const meds = useStore((s) => s.meds);
  const logs = useStore((s) => s.logs);
  const missedAfterMin = useStore((s) => s.settings.missedAfterMin);
  const streak = useStreak(now);
  const { c } = useTheme();

  const monthStart = dateKey(new Date(cursor.y, cursor.m, 1));
  const monthEnd = dateKey(new Date(cursor.y, cursor.m + 1, 0));
  const isCurrentMonth = today >= monthStart && today <= monthEnd;

  const { days, adh, perMed } = useMemo(() => {
    const idx = indexLogs(logs);
    const settings = { missedAfterMin };
    const count = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const days: { date: string; day: number; status: DayStatus }[] = [];
    for (let d = 1; d <= count; d++) {
      const date = dateKey(new Date(cursor.y, cursor.m, d));
      days.push({ date, day: d, status: date > today ? 'none' : summarizeDay(meds, idx, date, now, settings).status });
    }
    const to = isCurrentMonth ? today : monthEnd;
    const adh = adherence(meds, logs, monthStart, to, now, settings);
    const perMed = meds
      .map((m) => ({ med: m, a: adherence(meds, logs, monthStart, to, now, settings, m.id) }))
      .filter((x) => x.a.counted > 0)
      .sort((a, b) => (a.a.pct ?? 0) - (b.a.pct ?? 0));
    return { days, adh, perMed };
  }, [meds, logs, missedAfterMin, cursor, today, now, isCurrentMonth, monthStart, monthEnd]);

  const lead = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7; // Monday-first
  const items = useDayItems(selected, now);
  const shift = (delta: number) => {
    haptic.tap();
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const dot: Record<DayStatus, string | null> = { full: c.taken, partial: c.skip, missed: c.miss, pending: c.accent, none: null };

  return (
    <Screen bottomInset={40}>
      <Row style={{ justifyContent: 'space-between', marginTop: 10, marginBottom: 16, marginHorizontal: 4 }}>
        <Text v="title" accessibilityRole="header">
          History
        </Text>
        <IconButton name="down" label="Export history as CSV" onPress={() => exportCsv(meds, logs)} />
      </Row>

      <Rise key={`stat${cursor.y}-${cursor.m}`}>
      <Row style={{ alignItems: 'flex-end', marginHorizontal: 4 }} gap={16}>
        <View style={{ flex: 1, minWidth: 0 }} accessible accessibilityLabel={adh.pct != null ? `${adh.pct} percent taken in ${formatMonth(cursor.y, cursor.m)}` : 'No doses yet this month'}>
          <Text v="display" style={{ fontSize: 66, lineHeight: 70 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {adh.pct != null ? adh.pct : '—'}
            {adh.pct != null && (
              <Text v="title" style={{ fontSize: 36 }}>
                %
              </Text>
            )}
          </Text>
          <Text v="sub" style={{ marginTop: 6 }}>
            taken in {formatMonth(cursor.y, cursor.m).split(' ')[0]}
            {'\n'}
            {adh.taken} of {adh.counted} doses
          </Text>
        </View>
        <View style={[styles.streak, { backgroundColor: c.surface, borderColor: c.line }]} accessible accessibilityLabel={`Current streak ${streak.current} days. Best ${streak.best}.`}>
          <Row gap={6}>
            <Icon name="flame" size={20} tone="flame" />
            <Text v="h2" style={{ fontSize: 28 }} numberOfLines={1}>
              {streak.current} {streak.current === 1 ? 'day' : 'days'}
            </Text>
          </Row>
          <Text v="caption" style={{ marginTop: 4 }}>
            Streak · best {streak.best}
          </Text>
        </View>
      </Row>
      </Rise>

      <Card style={{ marginTop: 20, paddingHorizontal: 12 }}>
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <Tap onPress={() => shift(-1)} accessibilityLabel="Previous month" hitSlop={10} style={{ padding: 6 }}>
            <Icon name="back" size={18} tone="ink2" />
          </Tap>
          <Text v="headline" accessibilityRole="header">
            {formatMonth(cursor.y, cursor.m)}
          </Text>
          <Tap onPress={() => shift(1)} accessibilityLabel="Next month" hitSlop={10} style={{ padding: 6, opacity: isCurrentMonth ? 0.3 : 1 }} disabled={isCurrentMonth}>
            <Icon name="chevron" size={18} tone="ink2" />
          </Tap>
        </Row>
        <Rise key={`grid${cursor.y}-${cursor.m}`} from={8} style={[styles.grid, { marginTop: 12 }]}>
          {weekdayLetters().map((l, i) => (
            <View key={i} style={styles.cell}>
              <Text v="caption" style={{ fontSize: 11.5 }}>
                {l}
              </Text>
            </View>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <View key={`b${i}`} style={styles.cell} />
          ))}
          {days.map((d) => {
            const sel = d.date === selected;
            const isToday = d.date === today;
            const future = d.date > today;
            return (
              <Pressable
                key={d.date}
                style={styles.cell}
                onPress={() => {
                  haptic.tap();
                  setSelected(d.date);
                }}
                disabled={future}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={`${formatDate(d.date)}${d.status !== 'none' ? `, ${statusWord[d.status]}` : ''}`}
              >
                <View style={[styles.day, sel && { backgroundColor: c.ink }, !sel && isToday && { borderWidth: 1.5, borderColor: c.ink }]}>
                  <Text v="bodyStrong" style={{ fontSize: 14.5, color: sel ? c.bg : future ? c.ink3 : c.ink, fontFamily: isToday ? fonts.bold : fonts.medium }}>
                    {d.day}
                  </Text>
                  {dot[d.status] && <View style={[styles.dot, { backgroundColor: sel ? c.bg : dot[d.status]! }]} />}
                </View>
              </Pressable>
            );
          })}
        </Rise>
        <Row gap={14} style={{ justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          {(['full', 'partial', 'missed'] as const).map((s) => (
            <Row key={s} gap={5}>
              <View style={[styles.legend, { backgroundColor: dot[s]! }]} />
              <Text v="caption">{statusWord[s]}</Text>
            </Row>
          ))}
        </Row>
      </Card>

      <SectionLabel right={<Text v="caption">{items.filter((i) => i.state === 'taken').length} of {items.length}</Text>}>
        {selected === today ? 'Today' : formatDate(selected, { weekday: 'long', day: 'numeric', month: 'short' })}
      </SectionLabel>
      {items.length === 0 ? (
        <Text v="sub" style={{ marginHorizontal: 4 }}>
          No doses scheduled on this day.
        </Text>
      ) : (
        items.map((i) => <DoseRow key={i.o.slot + i.med.id} item={i} />)
      )}

      {perMed.length > 1 && (
        <>
          <SectionLabel>By medication</SectionLabel>
          <Card style={{ gap: 14 }}>
            {perMed.map(({ med, a }, i) => (
              <View key={med.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text v="bodyStrong" tone="ink">
                    {med.name}
                  </Text>
                  <Text v="mono">{a.pct}%</Text>
                </Row>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2, marginTop: 6, overflow: 'hidden' }}>
                  <GrowBar pct={a.pct ?? 0} delay={i * 80} color={(a.pct ?? 0) >= 90 ? c.taken : (a.pct ?? 0) >= 70 ? c.skip : c.miss} />
                </View>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const statusWord: Record<DayStatus, string> = { full: 'All taken', partial: 'Partial', missed: 'Missed', pending: 'In progress', none: '' };

const styles = StyleSheet.create({
  streak: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, minWidth: 128, flexShrink: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  day: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 3 },
  legend: { width: 9, height: 9, borderRadius: 5 },
});

import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { foodLabel, formatQty, strengthLabel } from '@/domain/schedule';
import { dateKey, dayPart, type DayPart } from '@/domain/time';
import { DoseRow, doseLine, quickTake } from '@/features/dose-ui';
import { formatDate, formatTime, greeting, relative } from '@/lib/format';
import { useDayItems, useNextDose, useNow, useStreak, type DoseItem } from '@/lib/hooks';
import { useStore } from '@/store/store';
import { isAndroid, useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Icon } from '@/ui/Icon';
import { Button, Card, Chip, ProgressSegments, Row, SectionLabel, Tap } from '@/ui/kit';
import { celebrateFrom, HoldButton, measurable, ND, Rise, useLoop, usePop, useReduceMotion } from '@/ui/motion';
import { PillGlyph } from '@/ui/PillGlyph';
import { MedThumb } from '@/ui/MedPhoto';
import { photoUri } from '@/photos/photos';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { toast } from '@/ui/Toast';

const PARTS: { key: DayPart; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
  { key: 'night', label: 'Night' },
];

export default function Today() {
  const now = useNow();
  const today = dateKey(new Date(now));
  const items = useDayItems(today, now);
  const next = useNextDose(now);
  const streak = useStreak(now);
  const meds = useStore((s) => s.meds);
  const name = useStore((s) => s.settings.name);
  const simple = useStore((s) => s.settings.simpleMode);
  const { c } = useTheme();

  const asNeeded = meds.filter((m) => m.schedule.kind === 'asNeeded' && !m.paused);
  const taken = items.filter((i) => i.state === 'taken').length;
  const resolved = items.filter((i) => i.state !== 'due' && i.state !== 'upcoming').length;
  // Celebrate only a genuinely complete day: every dose taken or deliberately skipped.
  const allDone = items.length > 0 && items.every((i) => i.state === 'taken' || i.state === 'skipped');
  // Only the moment the day completes gets the big celebration, not every later visit.
  const [prevDone, setPrevDone] = useState(allDone);
  const [justDone, setJustDone] = useState(false);
  if (allDone !== prevDone) {
    setPrevDone(allDone);
    setJustDone(allDone);
  }
  const streakPop = usePop(streak.current);

  const groups = useMemo(() => {
    const g = new Map<DayPart, DoseItem[]>();
    for (const i of items) {
      const p = dayPart(i.o.time);
      g.set(p, [...(g.get(p) ?? []), i]);
    }
    return g;
  }, [items]);

  if (meds.length === 0) return <EmptyToday />;
  if (simple) return <SimpleToday next={next} now={now} name={name} remaining={items.length - resolved} />;

  return (
    <View style={{ flex: 1 }}>
      <Screen bottomInset={isAndroid ? 120 : 40}>
        <Rise>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, marginBottom: 18, marginHorizontal: 4 }}>
          <View style={{ flex: 1 }}>
            <Text v="eyebrow">{formatDate(today)}</Text>
            <Text v="title" style={{ marginTop: 8 }} accessibilityRole="header">
              {name ? `${greeting(new Date(now))}, ${name}` : 'Today'}
            </Text>
          </View>
          {streak.current > 0 && (
            <Animated.View
              style={[styles.streak, { backgroundColor: c.surface, borderColor: c.line, transform: [{ scale: streakPop }] }]}
              accessible
              accessibilityLabel={`${streak.current} day streak`}
            >
              <Icon name="flame" size={18} tone="flame" />
              <Text v="headline" style={{ fontSize: 15 }}>
                {streak.current}
              </Text>
              <Text v="caption">{streak.current === 1 ? 'day' : 'days'}</Text>
            </Animated.View>
          )}
        </Row>
        </Rise>

        {allDone ? (
          <Rise delay={60}>
            <AllDoneCard taken={taken} total={items.length} streak={streak.current} next={next} celebrateNow={justDone} />
          </Rise>
        ) : (
          next && (
            // Re-keyed per dose so the next one rises into place after a take.
            <Rise key={next.item.med.id + next.item.o.slot} delay={60}>
              <HeroCard item={next.item} tomorrow={next.tomorrow} now={now} />
            </Rise>
          )
        )}

        {items.length > 0 && (
          <Rise delay={120} style={{ marginTop: 22, marginHorizontal: 4 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <Text v="headline" style={{ fontSize: 15 }}>
                {taken} of {items.length} taken
              </Text>
              <Text v="caption">{items.length - resolved > 0 ? `${items.length - resolved} remaining today` : 'Day complete'}</Text>
            </Row>
            <ProgressSegments total={items.length} done={taken} partial={items.filter((i) => i.state === 'due').length} />
          </Rise>
        )}

        {PARTS.filter((p) => groups.has(p.key)).map((p, gi) => (
          <Rise key={p.key} delay={170 + gi * 60}>
            <SectionLabel>{p.label}</SectionLabel>
            {groups.get(p.key)!.map((i) => (
              <DoseRow key={i.o.slot + i.med.id} item={i} />
            ))}
          </Rise>
        ))}

        {items.length === 0 && (
          <Card style={{ marginTop: 18 }}>
            <Text v="headline">Nothing scheduled today</Text>
            <Text v="sub" style={{ marginTop: 4 }}>
              Enjoy the day. As-needed medicines can still be logged below.
            </Text>
          </Card>
        )}

        {asNeeded.length > 0 && (
          <View>
            <SectionLabel>As needed</SectionLabel>
            {asNeeded.map((m) => (
              <Row key={m.id} style={{ paddingVertical: 10, paddingHorizontal: 4, minHeight: 68 }}>
                {/* Same time column as scheduled rows so every pill lines up. */}
                <Text v="mono" tone="ink3" style={{ width: 58, fontSize: 12 }}>
                  {'Any\ntime'}
                </Text>
                <MedThumb med={m} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text v="headline" numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text v="sub">{[formatQty(m, m.schedule.kind === 'asNeeded' ? m.schedule.qty : 1), strengthLabel(m)].filter(Boolean).join(' · ')}</Text>
                </View>
                <Chip
                  label="Log dose"
                  icon="plus"
                  onPress={async () => {
                    await useStore.getState().logAsNeeded(m.id, m.schedule.kind === 'asNeeded' ? m.schedule.qty : 1);
                    toast(`${m.name} logged`, { icon: 'check' });
                  }}
                />
              </Row>
            ))}
          </View>
        )}
      </Screen>
      {isAndroid && (
        <Tap
          onPress={() => router.push('/med/new')}
          hapticKind="press"
          accessibilityLabel="Add medication"
          style={[styles.fab, { backgroundColor: c.accent, bottom: 16 }]}
        >
          <Icon name="plus" size={22} color={c.accentInk} stroke={2.2} />
          <Text v="button" style={{ color: c.accentInk, fontSize: 15.5 }}>
            Add medication
          </Text>
        </Tap>
      )}
    </View>
  );
}

function HeroCard({ item, tomorrow, now }: { item: DoseItem; tomorrow: boolean; now: number }) {
  const { c } = useTheme();
  const { med, o } = item;
  const holdRef = useRef<View>(null);
  const spin = useLoop(90_000);
  const float = useLoop(3600, true);
  const late = item.state === 'due' && now > o.at + 60_000;
  const eyebrow = tomorrow ? 'Next dose · tomorrow' : item.state === 'due' ? (late ? `Due · ${relative(o.at, now)}` : 'Due now') : `Next dose · ${relative(o.at, now)}`;
  const details = [doseLine(item), foodLabel(med.food)].filter(Boolean).join(' · ');
  return (
    <View style={[styles.hero, { backgroundColor: c.hero }]} accessible={false}>
      <Animated.View style={[styles.orbit, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} pointerEvents="none">
        <Svg width={240} height={240}>
          <Circle cx={120} cy={120} r={70} fill="none" stroke={c.heroInk2} strokeWidth={0.8} strokeDasharray="2 5" opacity={0.6} />
          <Circle cx={120} cy={120} r={105} fill="none" stroke={c.heroInk2} strokeWidth={0.6} opacity={0.35} />
          <Circle cx={120} cy={15} r={3} fill={c.heroInk2} opacity={0.7} />
        </Svg>
      </Animated.View>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text v="eyebrow" style={{ color: late ? '#E9805F' : c.heroInk2 }}>
            {eyebrow}
          </Text>
          <Text v="display" style={{ color: c.heroInk, fontSize: 58, lineHeight: 62, marginTop: 10 }}>
            {formatTime(o.time)}
          </Text>
        </View>
        <Animated.View
          style={{
            transform: [
              { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
              { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-4deg'] }) },
            ],
          }}
        >
          {photoUri(med.photo) ? (
            <MedThumb med={med} size={78} round zoomable style={{ borderWidth: 3, borderColor: c.heroInk2, borderRadius: 42 }} />
          ) : (
            <PillGlyph form={med.form} color={med.color} size={76} />
          )}
        </Animated.View>
      </Row>
      <Text v="h3" style={{ color: c.heroInk, marginTop: 10, fontSize: 21 }}>
        {med.name}
      </Text>
      <Text v="sub" style={{ color: c.heroInk2, marginTop: 3, fontSize: 14.5 }}>
        {details}
      </Text>
      {!tomorrow && (
        <Row gap={10} style={{ marginTop: 18 }}>
          <View ref={holdRef} {...measurable} style={{ flex: 1.4 }}>
            <HoldButton
              label="Hold to take"
              accessibilityLabel={`Mark ${med.name} taken`}
              onComplete={() => quickTake(item, holdRef)}
              onShortPress={() => toast('Press and hold to take it', { icon: 'hold' })}
              bg={c.heroInk}
              fg={c.hero}
              fillBg={c.taken}
              fillFg={c.takenInk}
              radius={isAndroid ? 25 : 16}
            />
          </View>
          <Tap
            onPress={async () => {
              await useStore.getState().snooze(med.id, o.slot, 10);
              toast(`We'll remind you in 10 minutes`, { icon: 'snooze' });
            }}
            accessibilityLabel="Snooze 10 minutes"
            style={[styles.heroBtn, { flex: 1, borderWidth: 1.5, borderColor: c.heroInk2, borderRadius: isAndroid ? 25 : 16 }]}
          >
            <Icon name="snooze" size={19} color={c.heroInk} />
            <Text v="button" style={{ color: c.heroInk }}>
              10 min
            </Text>
          </Tap>
        </Row>
      )}
    </View>
  );
}

function AllDoneCard({
  taken,
  total,
  streak,
  next,
  celebrateNow,
}: {
  taken: number;
  total: number;
  streak: number;
  next: ReturnType<typeof useNextDose>;
  celebrateNow: boolean;
}) {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const spin = useLoop(60_000);
  const badgeRef = useRef<View>(null);
  // Captured at mount: the card only celebrates if it appeared because the day just completed.
  const [fresh] = useState(celebrateNow);
  const [badge] = useState(() => new Animated.Value(fresh ? 0.3 : 1));
  useEffect(() => {
    if (!fresh) return;
    if (reduce) {
      badge.setValue(1);
      return;
    }
    Animated.spring(badge, { toValue: 1, useNativeDriver: ND, speed: 9, bounciness: 14, delay: 150 }).start();
    const t = setTimeout(() => celebrateFrom(badgeRef, { big: true }), 260);
    return () => clearTimeout(t);
  }, [badge, fresh, reduce]);
  return (
    <View style={[styles.hero, { backgroundColor: c.accent }]}>
      <Svg width={240} height={240} style={styles.orbit} pointerEvents="none">
        <Circle cx={120} cy={120} r={70} fill="none" stroke={c.accentInk} strokeWidth={0.8} strokeDasharray="2 5" opacity={0.35} />
        <Circle cx={120} cy={120} r={105} fill="none" stroke={c.accentInk} strokeWidth={0.6} opacity={0.25} />
      </Svg>
      <View style={styles.badgeWrap}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}
          pointerEvents="none"
        >
          <Svg width={92} height={92}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                <Line
                  key={i}
                  x1={46 + Math.cos(a) * 33}
                  y1={46 + Math.sin(a) * 33}
                  x2={46 + Math.cos(a) * 42}
                  y2={46 + Math.sin(a) * 42}
                  stroke={c.accentInk}
                  strokeOpacity={0.45}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
        </Animated.View>
        <Animated.View ref={badgeRef} {...measurable} style={[styles.doneBadge, { backgroundColor: c.accentInk, transform: [{ scale: badge }] }]}>
          <Icon name="check" size={26} color={c.accent} stroke={2.8} />
        </Animated.View>
      </View>
      <Text v="title" style={{ color: c.accentInk, marginTop: 8 }}>
        All done{'\n'}
        <Text v="title" italic style={{ color: c.accentInk }}>
          for today.
        </Text>
      </Text>
      <Text v="body" style={{ color: c.accentInk, opacity: 0.8, marginTop: 8 }}>
        {taken} of {total} doses taken{streak > 1 ? ` · ${streak} days in a row` : ''}.
        {next?.tomorrow ? ` Tomorrow starts at ${formatTime(next.item.o.time)} with ${next.item.med.name}.` : ''}
      </Text>
    </View>
  );
}

function EmptyToday() {
  const { c } = useTheme();
  const bob = useLoop(4200, true);
  const drift = (px: number, deg: number) => ({
    transform: [
      { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, px] }) },
      { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${deg}deg`] }) },
    ],
  });
  return (
    <Screen>
      <Rise style={{ marginTop: 40, marginHorizontal: 4 }}>
        <View style={[styles.emptyArt, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Animated.View style={drift(-6, -5)}>
            <PillGlyph form="capsule" color="pine" size={64} />
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', right: 26, top: 22 }, drift(5, 6)]}>
            <PillGlyph form="softgel" color="amber" size={44} />
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', left: 30, bottom: 20 }, drift(-4, 4)]}>
            <PillGlyph form="tablet" color="chalk" size={42} />
          </Animated.View>
        </View>
        <Text v="title" style={{ marginTop: 28 }}>
          Let’s add your{'\n'}
          <Text v="title" italic tone="accent">
            first medication.
          </Text>
        </Text>
        <Text v="body" style={{ marginTop: 12 }}>
          It takes about 30 seconds. Tend will remind you at the right time, every time, and nothing leaves this phone.
        </Text>
        <Button label="Add medication" icon="plus" kind="accent" style={{ marginTop: 28 }} onPress={() => router.push('/med/new')} />
      </Rise>
    </Screen>
  );
}

function SimpleToday({ next, now, name, remaining }: { next: ReturnType<typeof useNextDose>; now: number; name: string; remaining: number }) {
  const { c } = useTheme();
  const tookRef = useRef<View>(null);
  if (!next) {
    return (
      <Screen>
        <Text v="h3" tone="ink2" style={{ marginTop: 20 }}>
          {greeting(new Date(now))}
          {name ? `, ${name}` : ''}
        </Text>
        <Text v="title" style={{ marginTop: 8 }}>
          No more medicine today.
        </Text>
      </Screen>
    );
  }
  const { item, tomorrow } = next;
  return (
    <Screen bottomInset={40}>
      <Text v="h3" tone="ink2" style={{ marginTop: 14, fontFamily: fonts.medium }}>
        {greeting(new Date(now))}
        {name ? `, ${name}` : ''}
      </Text>
      <Text v="title" style={{ marginTop: 6 }} accessibilityRole="header">
        {tomorrow ? 'Tomorrow’s first medicine' : 'Your next medicine'}
      </Text>
      <Card style={{ marginTop: 20, alignItems: 'center', paddingVertical: 26, borderRadius: 32 }}>
        <View style={[styles.simpleArt, { backgroundColor: c.skipSoft }]}>
          {photoUri(item.med.photo) ? <MedThumb med={item.med} size={132} round zoomable /> : <PillGlyph form={item.med.form} color={item.med.color} size={104} />}
        </View>
        <Text v="h2" style={{ marginTop: 18, fontFamily: fonts.semibold, fontSize: 30, lineHeight: 34 }} center>
          {item.med.name}
        </Text>
        <Text v="body" center style={{ marginTop: 6, fontSize: 20, lineHeight: 27 }}>
          {[formatQty(item.med, item.o.qty), foodLabel(item.med.food)].filter(Boolean).join('\n')}
        </Text>
        <Row gap={8} style={{ marginTop: 16 }}>
          <Icon name="clock" size={22} tone="accent" />
          <Text v="h3" tone="accent" style={{ fontSize: 20 }}>
            {item.state === 'due' ? `Now, at ${formatTime(item.o.time)}` : `At ${formatTime(item.o.time)}`}
          </Text>
        </Row>
      </Card>
      {!tomorrow && (
        <>
          <View ref={tookRef} {...measurable}>
            <Button label="I took it" icon="check" kind="taken" height={76} style={{ marginTop: 18, borderRadius: 24 }} onPress={() => quickTake(item, tookRef)} />
          </View>
          <Button
            label="Remind me in 10 minutes"
            icon="snooze"
            kind="ghost"
            height={64}
            style={{ marginTop: 10 }}
            onPress={async () => {
              await useStore.getState().snooze(item.med.id, item.o.slot, 10);
              toast(`We'll remind you in 10 minutes`, { icon: 'snooze' });
            }}
          />
        </>
      )}
      {remaining > 1 && (
        <Text v="bodyStrong" tone="ink2" style={{ marginTop: 22, fontSize: 18 }} center>
          Later today: {remaining - 1} more
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingLeft: 10, paddingRight: 12, borderRadius: 14, borderWidth: 1 },
  hero: { borderRadius: 28, padding: 22, overflow: 'hidden' },
  orbit: { position: 'absolute', right: -70, top: -60 },
  heroBtn: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  doneBadge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  badgeWrap: { width: 92, height: 92, marginLeft: -20, marginTop: -20, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 16,
    height: 58,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  emptyArt: { height: 170, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  simpleArt: { width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center' },
});

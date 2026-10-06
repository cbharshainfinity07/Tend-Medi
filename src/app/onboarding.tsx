import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { BackupError, pickBackup } from '@/backup/backup';
import { openBatterySettings, openExactAlarmSettings } from '@/lib/androidSettings';
import { requestPermission, sendTestReminder } from '@/notifications/engine';
import { useStore } from '@/store/store';
import { isAndroid, useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { Icon, type IconName } from '@/ui/Icon';
import { Button, Card, Cell, Field, Row, SectionLabel, Tap, Toggle } from '@/ui/kit';
import { PillGlyph } from '@/ui/PillGlyph';
import { Footer, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { toast } from '@/ui/Toast';
import { Rise, useLoop, useReduceMotion } from '@/ui/motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
// Length of the 'done so far' arc in the welcome dial: 13.7 of 24 hours at radius 80.
const DIAL_ARC = (13.7 / 24) * 2 * Math.PI * 80;

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [forOther, setForOther] = useState(false);
  const simple = useStore((s) => s.settings.simpleMode);
  const update = useStore((s) => s.updateSettings);

  const finish = async () => {
    await update({ onboarded: true, name: name.trim() });
    router.replace('/');
  };

  const restore = async () => {
    try {
      const snap = await pickBackup();
      if (!snap) return;
      await useStore.getState().restore(snap);
      toast(`Welcome back. ${snap.medications.length} medications restored`, { icon: 'restore' });
      router.replace('/');
    } catch (e) {
      const msg = e instanceof BackupError ? e.message : 'That file could not be read.';
      if (Platform.OS === 'web') globalThis.alert?.(msg);
      else Alert.alert('Restore failed', msg);
    }
  };

  if (step === 0) return <Welcome onNext={() => setStep(1)} onRestore={restore} />;

  return (
    <Screen
      footer={
        <Footer>
          <Row gap={10}>
            <Button kind="ghost" label="Back" style={{ flex: 1 }} onPress={() => setStep(step - 1)} />
            <Button kind="primary" label={step === 1 ? 'Continue' : 'Start using Tend'} style={{ flex: 2 }} onPress={() => (step === 1 ? setStep(2) : finish())} />
          </Row>
        </Footer>
      }
    >
      <Row gap={5} style={{ marginTop: 10, marginBottom: 24 }} accessible accessibilityLabel={`Step ${step} of 2`}>
        {[1, 2].map((i) => (
          <Bar key={i} on={i <= step} />
        ))}
      </Row>
      {step === 1 ? (
        <Personalise name={name} setName={setName} forOther={forOther} setForOther={setForOther} simple={simple} setSimple={(v) => update({ simpleMode: v })} />
      ) : (
        <Reminders />
      )}
    </Screen>
  );
}

function Bar({ on }: { on: boolean }) {
  const { c } = useTheme();
  return <View style={{ width: 26, height: 5, borderRadius: 3, backgroundColor: on ? c.ink : c.line }} />;
}

function Welcome({ onNext, onRestore }: { onNext: () => void; onRestore: () => void }) {
  const { c } = useTheme();
  return (
    <Screen
      footer={
        <Footer>
          <Button kind="primary" label="Get started" onPress={onNext} />
          <Text v="sub" center style={{ marginTop: 16 }}>
            Have a backup?{' '}
            <Text v="sub" tone="ink" style={{ textDecorationLine: 'underline', fontFamily: fonts.semibold }} onPress={onRestore} accessibilityRole="link">
              Restore it
            </Text>
          </Text>
        </Footer>
      }
    >
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Dial />
      </View>
      <Rise delay={500}>
      <Text v="display" style={{ fontSize: 52, lineHeight: 54, marginTop: 8 }} accessibilityRole="header">
        Every dose,{'\n'}
        <Text v="display" italic tone="accent" style={{ fontSize: 52, lineHeight: 54 }}>
          kept.
        </Text>
      </Text>
      <Text v="body" style={{ marginTop: 14, fontSize: 16.5, lineHeight: 24 }}>
        Reminders, history and refills, stored only on this phone.
      </Text>
      <Row gap={16} style={{ marginTop: 22, flexWrap: 'wrap' }}>
        <Badge icon="noAccount" label="No account" />
        <Badge icon="offline" label="Works offline" />
        <Badge icon="lock" label="Private" />
      </Row>
      </Rise>
      <View style={{ height: 1, backgroundColor: c.line, marginTop: 8, opacity: 0 }} />
    </Screen>
  );
}

function Badge({ icon, label }: { icon: IconName; label: string }) {
  return (
    <Row gap={7}>
      <Icon name={icon} size={18} tone="accent" />
      <Text v="caption" tone="ink2" style={{ fontSize: 13.5 }}>
        {label}
      </Text>
    </Row>
  );
}

/** 24-hour dial: the day as a ring, doses as pills around it. */
function Dial() {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const bob = useLoop(4200, true);
  const [draw] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) {
      draw.setValue(1);
      return;
    }
    // SVG dash offsets can't run on the native driver.
    Animated.timing(draw, { toValue: 1, duration: 1400, delay: 200, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
  }, [draw, reduce]);
  const S = 300;
  const cx = S / 2;
  const R = 104;
  const pt = (h: number, r: number) => {
    const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(a) * r, y: cx + Math.sin(a) * r };
  };
  const arc = (h1: number, h2: number, r: number) => {
    const a = pt(h1, r);
    const b = pt(h2, r);
    return `M${a.x} ${a.y} A${r} ${r} 0 ${h2 - h1 > 12 ? 1 : 0} 1 ${b.x} ${b.y}`;
  };
  const doses: { h: number; form: 'tablet' | 'capsule' | 'softgel'; color: 'chalk' | 'coral' | 'amber' | 'slate'; done: boolean }[] = [
    { h: 8, form: 'tablet', color: 'chalk', done: true },
    { h: 9.6, form: 'capsule', color: 'coral', done: true },
    { h: 14, form: 'softgel', color: 'amber', done: false },
    { h: 20, form: 'tablet', color: 'chalk', done: false },
    { h: 21.8, form: 'tablet', color: 'slate', done: false },
  ];
  return (
    <View style={{ width: S, height: S }} accessible accessibilityLabel="A 24-hour dial showing doses through the day">
      <Svg width={S} height={S}>
        <Circle cx={cx} cy={cx} r={R + 34} fill="none" stroke={c.ink} strokeOpacity={0.08} strokeDasharray="1 7" />
        <Circle cx={cx} cy={cx} r={R} fill={c.surface} stroke={c.line} />
        {Array.from({ length: 96 }, (_, i) => {
          const major = i % 4 === 0;
          const a = pt(i / 4, R - (major ? 11 : 6));
          const b = pt(i / 4, R - 3);
          return <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c.ink} strokeOpacity={major ? 0.35 : 0.14} strokeWidth={major ? 1.3 : 1} strokeLinecap="round" />;
        })}
        <AnimatedPath
          d={arc(0, 13.7, R - 24)}
          stroke={c.accent}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={[DIAL_ARC, DIAL_ARC]}
          strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [DIAL_ARC, 0] })}
        />
        <Path d={arc(13.7, 23.99, R - 24)} stroke={c.line} strokeWidth={5} fill="none" strokeLinecap="round" />
        <SvgText x={cx} y={cx + 6} textAnchor="middle" fontFamily={fonts.serif} fontSize={40} fill={c.ink}>
          14:00
        </SvgText>
        <SvgText x={cx} y={cx + 28} textAnchor="middle" fontFamily={fonts.mono} fontSize={9.5} letterSpacing={1.4} fill={c.ink3}>
          NEXT · VITAMIN D3
        </SvgText>
        {doses.map((d) => {
          const p = pt(d.h, R + 28);
          return <Circle key={d.h} cx={p.x} cy={p.y} r={19} fill={c.surface} stroke={d.done ? c.taken : c.line} strokeWidth={d.done ? 2 : 1} />;
        })}
      </Svg>
      {doses.map((d, i) => {
        const p = pt(d.h, R + 28);
        return (
          <Rise key={d.h} delay={300 + i * 110} from={10} style={{ position: 'absolute', left: p.x - 14, top: p.y - 14 }}>
            <Animated.View
              pointerEvents="none"
              style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, i % 2 ? -3 : 3] }) }] }}
            >
              <PillGlyph form={d.form} color={d.color} size={28} />
            </Animated.View>
          </Rise>
        );
      })}
    </View>
  );
}

function Personalise({
  name,
  setName,
  forOther,
  setForOther,
  simple,
  setSimple,
}: {
  name: string;
  setName: (s: string) => void;
  forOther: boolean;
  setForOther: (v: boolean) => void;
  simple: boolean;
  setSimple: (v: boolean) => void;
}) {
  const { c } = useTheme();
  const choice = (on: boolean, icon: IconName, title: string, sub: string, tint: 'accent' | 'skip', press: () => void) => (
    <Tap
      onPress={press}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={title}
      style={[styles.choice, { backgroundColor: c.surface, borderColor: on ? c.ink : c.line, borderWidth: on ? 2 : 1 }]}
    >
      <View style={[styles.choiceIcon, { backgroundColor: tint === 'accent' ? c.accentSoft : c.skipSoft }]}>
        <Icon name={icon} tone={tint} />
      </View>
      <Text v="headline" style={{ marginTop: 24 }}>
        {title}
      </Text>
      <Text v="caption" style={{ marginTop: 3 }}>
        {sub}
      </Text>
      {on && (
        <View style={[styles.check, { backgroundColor: c.ink }]}>
          <Icon name="check" size={14} color={c.bg} stroke={3} />
        </View>
      )}
    </Tap>
  );
  return (
    <View>
      <Text v="title" accessibilityRole="header">
        Who are you{'\n'}keeping track for?
      </Text>
      <Row gap={10} style={{ marginTop: 22, alignItems: 'stretch' }}>
        {choice(!forOther, 'me', 'Myself', 'My own medications', 'accent', () => setForOther(false))}
        {choice(forOther, 'family', 'Someone I care for', 'A child or a parent', 'skip', () => setForOther(true))}
      </Row>
      <Field
        label={forOther ? 'Their name (optional)' : 'Your name (optional)'}
        value={name}
        onChangeText={setName}
        placeholder="For a friendlier greeting"
        autoCapitalize="words"
        style={{ marginTop: 14 }}
      />
      <SectionLabel>Make it easy to read</SectionLabel>
      <Card padded={false}>
        <Cell
          first
          icon="heart"
          title="Simple mode"
          subtitle="Bigger text and buttons, one dose at a time. Great for older eyes and for children."
          right={<Toggle label="Simple mode" value={simple} onChange={setSimple} />}
        />
      </Card>
      <Card style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <PillGlyph form="tablet" color="chalk" size={42} />
        <View>
          <Text v="headline">Metformin</Text>
          <Text v="sub">500 mg · 08:00</Text>
        </View>
      </Card>
      <Text v="caption" style={{ marginTop: 8, marginLeft: 4 }}>
        Text also follows your phone’s text size setting.
      </Text>
    </View>
  );
}

function Reminders() {
  const { c } = useTheme();
  const [granted, setGranted] = useState<boolean | null>(null);
  const ask = async () => setGranted(await requestPermission());

  return (
    <View>
      <View style={[styles.bigIcon, { backgroundColor: c.accentSoft }]}>
        <Icon name="alarm" size={28} tone="accent" />
      </View>
      <Text v="title" style={{ marginTop: 18 }} accessibilityRole="header">
        {isAndroid ? 'Never miss\na dose.' : 'Reminders that\nshow up on time.'}
      </Text>
      <Text v="body" style={{ marginTop: 10 }}>
        {isAndroid
          ? 'Android needs a few permissions so reminders ring at the right minute, even overnight.'
          : 'Tend reminds you at the exact minute, and you can mark a dose taken from the lock screen.'}
      </Text>

      <View style={{ gap: 10, marginTop: 22 }}>
        <PermissionRow
          icon="bell"
          title="Notifications"
          sub="Show dose reminders"
          state={granted}
          action={granted ? undefined : { label: granted === false ? 'Retry' : 'Allow', onPress: ask }}
        />
        {isAndroid && (
          <>
            <PermissionRow icon="alarm" title="Alarms & reminders" sub="Ring at the exact minute" action={{ label: 'Allow', onPress: openExactAlarmSettings }} />
            <PermissionRow icon="battery" title="Battery: unrestricted" sub="Keep reminders alive overnight" action={{ label: 'Allow', onPress: openBatterySettings }} />
          </>
        )}
      </View>

      {granted && (
        <Button
          kind="ghost"
          icon="play"
          label="Send a test reminder"
          style={{ marginTop: 16 }}
          onPress={async () => {
            await sendTestReminder();
            toast('Test reminder arrives in 5 seconds', { icon: 'bell' });
          }}
        />
      )}
      {granted === false && (
        <Text v="sub" tone="miss" style={{ marginTop: 14 }}>
          Notifications are off. You can still use Tend, but you won’t get reminders. Turn them on any time in Settings.
        </Text>
      )}
      <Row gap={10} style={{ marginTop: 20, paddingHorizontal: 4 }}>
        <Icon name="shield" size={18} tone="ink3" />
        <Text v="caption" style={{ flex: 1 }}>
          Reminders are scheduled on this phone. Nothing is sent to a server.
        </Text>
      </Row>
    </View>
  );
}

function PermissionRow({
  icon,
  title,
  sub,
  state,
  action,
}: {
  icon: IconName;
  title: string;
  sub: string;
  state?: boolean | null;
  action?: { label: string; onPress: () => void };
}) {
  const { c } = useTheme();
  const ok = state === true;
  return (
    <View style={[styles.perm, { backgroundColor: c.surface, borderColor: ok ? c.line : c.line }]}>
      <View style={[styles.permIcon, { backgroundColor: ok ? c.takenSoft : c.accentSoft }]}>
        <Icon name={icon} tone={ok ? 'taken' : 'accent'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text v="headline" style={{ fontSize: 15.5 }}>
          {title}
        </Text>
        <Text v="caption" style={{ marginTop: 2 }}>
          {sub}
        </Text>
      </View>
      {ok ? (
        <Row gap={5}>
          <Icon name="check" size={17} tone="taken" stroke={2.6} />
          <Text v="caption" tone="taken" style={{ fontFamily: fonts.semibold, fontSize: 13.5 }}>
            On
          </Text>
        </Row>
      ) : action ? (
        <Tap onPress={action.onPress} accessibilityLabel={`${action.label} ${title}`} style={[styles.permBtn, { backgroundColor: c.accent }]}>
          <Text v="button" style={{ color: c.accentInk, fontSize: 14 }}>
            {action.label}
          </Text>
        </Tap>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  choice: { flex: 1, borderRadius: 24, padding: 16, minHeight: 150 },
  choiceIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', top: 14, right: 14, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bigIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  perm: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, borderWidth: 1 },
  permIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  permBtn: { height: 38, paddingHorizontal: 16, borderRadius: 19, justifyContent: 'center' },
});

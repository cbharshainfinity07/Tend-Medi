import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { create } from 'zustand';
import { useTheme } from '@/theme/theme';
import { haptic } from './haptics';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** The native driver isn't available in the web preview. */
export const ND = Platform.OS !== 'web';

/** Keeps a view in the native tree so it can be measured (Android flattens plain wrappers). No-op on web. */
export const measurable = Platform.OS === 'web' ? {} : { collapsable: false as const };

// Cached so components mounting later start in the right state without a flash of motion.
let reduceMotion = false;
let screenReader = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => (reduceMotion = v))
  .catch(() => undefined);
AccessibilityInfo.isScreenReaderEnabled()
  .then((v) => (screenReader = v))
  .catch(() => undefined);

function useA11yFlag(event: 'reduceMotionChanged' | 'screenReaderChanged') {
  const read = () => (event === 'reduceMotionChanged' ? reduceMotion : screenReader);
  const [v, setV] = useState(read);
  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener(event, (next: boolean) => {
      if (event === 'reduceMotionChanged') reduceMotion = next;
      else screenReader = next;
      setV(next);
    });
    return () => sub.remove();
  }, [event]);
  return v;
}

export const useReduceMotion = () => useA11yFlag('reduceMotionChanged');
export const useScreenReader = () => useA11yFlag('screenReaderChanged');

/** Fades and lifts its children into place on mount. Re-key it to replay. */
export function Rise({ children, delay = 0, from = 14, style }: { children: ReactNode; delay?: number; from?: number; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return;
    const a = Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: ND });
    a.start();
    return () => a.stop();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Slides content in horizontally from `dir` (1 = from the right, -1 = from the left). Re-key to replay. */
export function SlideIn({ children, dir = 1, style }: { children: ReactNode; dir?: number; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return;
    const a = Animated.timing(v, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: ND });
    a.start();
    return () => a.stop();
  }, [v]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
          transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dir * 36, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** A 0→1 value that loops forever (or rocks back and forth with `yoyo`). Stays at 0 under Reduce Motion. */
export function useLoop(ms: number, yoyo = false) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) {
      v.setValue(0);
      return;
    }
    const step = (to: number, d: number, e: (t: number) => number) => Animated.timing(v, { toValue: to, duration: d, easing: e, useNativeDriver: ND });
    const a = yoyo
      ? Animated.loop(Animated.sequence([step(1, ms / 2, Easing.inOut(Easing.sin)), step(0, ms / 2, Easing.inOut(Easing.sin))]))
      : Animated.loop(step(1, ms, Easing.linear));
    a.start();
    return () => a.stop();
  }, [reduce, ms, yoyo, v]);
  return v;
}

/** Springy scale that pops whenever `key` changes after the first render. */
export function usePop(key: unknown) {
  const [s] = useState(() => new Animated.Value(1));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduceMotion) return;
    s.setValue(0.55);
    Animated.spring(s, { toValue: 1, useNativeDriver: ND, speed: 14, bounciness: 16 }).start();
  }, [key, s]);
  return s;
}

/** Horizontal bar that grows from empty to `pct` when it mounts or the value changes. */
export function GrowBar({ pct, color, height = 6, delay = 0 }: { pct: number; color: string; height?: number; delay?: number }) {
  const [w] = useState(() => new Animated.Value(reduceMotion ? pct : 0));
  const first = useRef(true);
  useEffect(() => {
    if (reduceMotion) {
      w.setValue(pct);
      return;
    }
    // The stagger delay is for the entrance only; later changes respond immediately.
    const d = first.current ? delay : 0;
    first.current = false;
    const a = Animated.timing(w, { toValue: pct, duration: 700, delay: d, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [pct, delay, w]);
  return (
    <Animated.View
      style={{ height, borderRadius: height / 2, backgroundColor: color, width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Celebration bursts, drawn in a window-level overlay                  */
/* ------------------------------------------------------------------ */

interface Particle {
  dx: number;
  dy: number;
  fall: number;
  rot: number;
  size: number;
  round: boolean;
}

interface Burst {
  id: number;
  x: number;
  y: number;
  big: boolean;
  parts: Particle[];
}

// Randomness happens here, outside render, so each burst is fixed once created.
function makeParticles(big: boolean): Particle[] {
  const n = big ? 36 : 20;
  const reach = big ? 130 : 74;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const d = reach * (0.5 + Math.random() * 0.65);
    return {
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d,
      fall: 24 + Math.random() * (big ? 70 : 34),
      rot: Math.random() * 600 - 300,
      size: 5 + Math.random() * (big ? 6 : 4),
      round: i % 3 === 0,
    };
  });
}

const useBursts = create<{ bursts: Burst[]; seq: number; add(b: Omit<Burst, 'id'>): void; remove(id: number): void }>()((set, get) => ({
  bursts: [],
  seq: 0,
  add(b) {
    const id = get().seq + 1;
    set({ seq: id, bursts: [...get().bursts.slice(-3), { ...b, id }] });
  },
  remove(id) {
    set({ bursts: get().bursts.filter((b) => b.id !== id) });
  },
}));

/** Burst of confetti at window coordinates. Skipped entirely under Reduce Motion. */
export function celebrate(x: number, y: number, opts?: { big?: boolean }) {
  if (reduceMotion) return;
  const big = !!opts?.big;
  useBursts.getState().add({ x, y, big, parts: makeParticles(big) });
}

/** Burst from the centre of a measured view. */
export function celebrateFrom(ref: RefObject<View | null>, opts?: { big?: boolean }) {
  const node = ref.current;
  if (!node || reduceMotion) return;
  node.measureInWindow((x, y, w, h) => {
    if (Number.isFinite(x) && Number.isFinite(y)) celebrate(x + w / 2, y + h / 2, opts);
  });
}

export function CelebrationHost() {
  const { c } = useTheme();
  const bursts = useBursts((s) => s.bursts);
  const colors = [c.taken, '#E3A23A', c.flame, c.accent, '#8FC9AF'];
  if (!bursts.length) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map((b) => (
        <BurstView key={b.id} burst={b} colors={colors} />
      ))}
    </View>
  );
}

function BurstView({ burst, colors }: { burst: Burst; colors: string[] }) {
  const [p] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const duration = burst.big ? 1350 : 900;
    const remove = () => useBursts.getState().remove(burst.id);
    const a = Animated.timing(p, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: ND });
    a.start(({ finished }) => finished && remove());
    // If frames stall (app backgrounded mid-burst), never leave confetti stuck on screen.
    const fallback = setTimeout(remove, duration + 600);
    return () => {
      clearTimeout(fallback);
      a.stop();
    };
  }, [p, burst.big, burst.id]);
  const ring = burst.big ? 70 : 44;
  return (
    <>
      <Animated.View
        style={{
          position: 'absolute',
          left: burst.x - ring / 2,
          top: burst.y - ring / 2,
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: 2,
          borderColor: colors[0],
          opacity: p.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.7, 0.15, 0] }),
          transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.3, burst.big ? 3.6 : 2.4] }) }],
        }}
      />
      {burst.parts.map((q, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: burst.x - q.size / 2,
            top: burst.y - q.size / 2,
            width: q.size,
            height: q.round ? q.size : q.size * 1.5,
            borderRadius: q.round ? q.size / 2 : 1.5,
            backgroundColor: colors[i % colors.length],
            opacity: p.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, q.dx] }) },
              { translateY: p.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, q.dy, q.dy + q.fall] }) },
              { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${q.rot}deg`] }) },
              { scale: p.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0.2, 1, 0.7] }) },
            ],
          }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Hold to take                                                        */
/* ------------------------------------------------------------------ */

/**
 * Press-and-hold confirm. A fill sweeps across while held; letting go early cancels.
 * With a screen reader on, a normal activation confirms straight away.
 */
export function HoldButton({
  label,
  doneLabel = 'Taken',
  icon = 'check',
  onComplete,
  bg,
  fg,
  fillBg,
  fillFg,
  height = 52,
  radius = 16,
  duration = 750,
  style,
  accessibilityLabel,
  onShortPress,
}: {
  label: string;
  doneLabel?: string;
  icon?: IconName;
  onComplete: () => void;
  bg: string;
  fg: string;
  fillBg: string;
  fillFg: string;
  height?: number;
  radius?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Called when someone taps instead of holding, so the UI can explain the gesture. */
  onShortPress?: () => void;
}) {
  const sr = useScreenReader();
  const [w, setW] = useState(0);
  const [p] = useState(() => new Animated.Value(0));
  const [s] = useState(() => new Animated.Value(1));
  const run = useRef<Animated.CompositeAnimation | null>(null);
  const ticks = useRef<ReturnType<typeof setTimeout>[]>([]);
  const done = useRef(false);
  const startedAt = useRef(0);

  const clearTicks = () => {
    ticks.current.forEach(clearTimeout);
    ticks.current = [];
  };
  useEffect(() => () => clearTicks(), []);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    clearTicks();
    p.setValue(1);
    haptic.success();
    onComplete();
    setTimeout(() => {
      done.current = false;
      Animated.timing(p, { toValue: 0, duration: 260, useNativeDriver: ND }).start();
    }, 700);
  };

  const start = () => {
    if (sr || done.current) return;
    startedAt.current = Date.now();
    haptic.press();
    Animated.spring(s, { toValue: 0.97, useNativeDriver: ND, speed: 40, bounciness: 4 }).start();
    run.current = Animated.timing(p, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: ND });
    run.current.start(({ finished }) => finished && finish());
    ticks.current = [duration / 3, (duration * 2) / 3].map((t) => setTimeout(haptic.tap, t));
  };

  const cancel = () => {
    Animated.spring(s, { toValue: 1, useNativeDriver: ND, speed: 30, bounciness: 8 }).start();
    if (done.current) return;
    run.current?.stop();
    clearTicks();
    if (startedAt.current && Date.now() - startedAt.current < 280) onShortPress?.();
    startedAt.current = 0;
    Animated.timing(p, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: ND }).start();
  };

  const row = (color: string, text: string, ic: IconName) => (
    <View style={styles.holdRow}>
      <Icon name={ic} size={19} color={color} stroke={2.5} />
      <Text v="button" style={{ color }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );

  return (
    <Pressable
      style={style}
      onPressIn={start}
      onPressOut={cancel}
      onPress={() => sr && finish()}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={sr ? undefined : 'Press and hold to confirm'}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && finish()}
    >
      <Animated.View
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
        style={[styles.hold, { height, borderRadius: radius, backgroundColor: bg, transform: [{ scale: s }] }]}
      >
        {row(fg, label, 'hold')}
        {w > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.holdFill, { width: w, backgroundColor: fillBg, transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [-w, 0] }) }] }]}
          >
            <Animated.View style={{ width: w, height: '100%', justifyContent: 'center', transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [w, 0] }) }] }}>
              {row(fillFg, doneLabel, icon)}
            </Animated.View>
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hold: { overflow: 'hidden', justifyContent: 'center' },
  holdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
});

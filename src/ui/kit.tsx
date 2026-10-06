import { type ReactNode, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  Switch,
  TextInput,
  type TextInputProps,
  View,
  type ViewProps,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { MedForm, PillColor } from '@/domain/types';
import { isAndroid, useTheme } from '@/theme/theme';
import { fonts, radius, type Palette } from '@/theme/tokens';
import { haptic } from './haptics';
import { Icon, type IconName } from './Icon';
import { GrowBar } from './motion';
import { PillGlyph } from './PillGlyph';
import { Text } from './Text';

const OUTER_KEYS = [
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'minWidth',
  'maxWidth',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'zIndex',
] as const;

/** Pressable with a soft spring-scale response and haptic tick. */
export function Tap({
  children,
  style,
  scaleTo = 0.97,
  hapticKind = 'tap',
  onPress,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; hapticKind?: keyof typeof haptic | 'none'; children?: ReactNode }) {
  const [s] = useState(() => new Animated.Value(1));
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 6 }).start();
  // Layout props must sit on the Pressable (the flex child); visuals stay on the animated inner view.
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const outer: ViewStyle = {};
  for (const k of OUTER_KEYS) if (flat[k] !== undefined) (outer as Record<string, unknown>)[k] = flat[k];
  const inner: ViewStyle = { ...flat };
  for (const k of OUTER_KEYS) delete (inner as Record<string, unknown>)[k];
  if (outer.flex !== undefined || outer.width !== undefined) inner.flexGrow = 1;
  return (
    <Pressable
      style={outer}
      accessibilityRole="button"
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      onPress={(e) => {
        if (hapticKind !== 'none') haptic[hapticKind]();
        onPress?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[inner, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

type ButtonKind = 'primary' | 'accent' | 'ghost' | 'tonal' | 'taken' | 'skip' | 'miss' | 'danger';

export function Button({
  label,
  icon,
  kind = 'primary',
  onPress,
  height,
  style,
  disabled,
  trailing,
  accessibilityHint,
}: {
  label: string;
  icon?: IconName;
  kind?: ButtonKind;
  onPress?: () => void;
  height?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  trailing?: ReactNode;
  accessibilityHint?: string;
}) {
  const { c, scale } = useTheme();
  const map: Record<ButtonKind, { bg: string; fg: string; border?: string }> = {
    primary: { bg: isAndroid ? c.accent : c.ink, fg: isAndroid ? c.accentInk : c.bg },
    accent: { bg: c.accent, fg: c.accentInk },
    ghost: { bg: 'transparent', fg: c.ink, border: isAndroid ? c.ink3 : c.line },
    tonal: { bg: c.accentSoft, fg: c.ink },
    taken: { bg: c.taken, fg: c.takenInk },
    skip: { bg: c.skipSoft, fg: c.skip },
    miss: { bg: c.missSoft, fg: c.miss },
    danger: { bg: c.missSoft, fg: c.miss },
  };
  const k = map[kind];
  const h = (height ?? 54) * Math.min(scale, 1.12);
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      hapticKind={kind === 'taken' ? 'success' : 'press'}
      style={[
        styles.btn,
        {
          height: h,
          borderRadius: isAndroid ? h / 2 : 18,
          backgroundColor: k.bg,
          borderWidth: k.border ? 1.5 : 0,
          borderColor: k.border,
          opacity: disabled ? 0.45 : 1,
          justifyContent: trailing ? 'space-between' : 'center',
          paddingHorizontal: trailing ? 20 : 16,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {icon && <Icon name={icon} size={20} color={k.fg} stroke={kind === 'taken' ? 2.4 : 1.9} />}
        <Text v="button" style={{ color: k.fg }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {trailing}
    </Tap>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  tone = 'ink',
  filled = true,
}: {
  name: IconName;
  onPress?: () => void;
  label: string;
  tone?: keyof Palette;
  filled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={[
        styles.iconBtn,
        filled && { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1 },
        isAndroid && { borderRadius: 22 },
      ]}
    >
      <Icon name={name} size={20} tone={tone} />
    </Tap>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: c.line }, padded && { padding: 16 }, style]}>
      {children}
    </View>
  );
}

export function PillTile({ form, color, size = 46 }: { form: MedForm; color: PillColor; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
      <PillGlyph form={form} color={color} size={size * 0.86} />
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  if (isAndroid) {
    // Material 3 segmented button
    return (
      <View style={[styles.mSeg, { borderColor: c.ink3 }]} accessibilityRole="radiogroup">
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptic.tap();
                onChange(o.value);
              }}
              style={[
                styles.mSegItem,
                { backgroundColor: on ? c.accentSoft : 'transparent', borderLeftWidth: i ? 1 : 0, borderColor: c.ink3 },
              ]}
            >
              {on && <Icon name="check" size={15} stroke={2.6} />}
              <Text v="caption" tone="ink" style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 13.5 }} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <View style={[styles.seg, { backgroundColor: c.surface2 }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            style={[styles.segItem, on && { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1 }]}
          >
            {o.icon && <Icon name={o.icon} size={15} tone={on ? 'ink' : 'ink2'} />}
            <Text v="caption" tone={on ? 'ink' : 'ink2'} style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 13.5 }} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, on, onPress, icon, fill }: { label: string; on?: boolean; onPress?: () => void; icon?: IconName; /** Stretch to the parent's width, content centred. */ fill?: boolean }) {
  const { c } = useTheme();
  const bg = on ? (isAndroid ? c.accentSoft : c.ink) : isAndroid ? 'transparent' : c.surface2;
  const fg = on ? (isAndroid ? c.ink : c.bg) : c.ink2;
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={[
        styles.chip,
        { backgroundColor: bg, borderRadius: isAndroid ? 10 : 12 },
        isAndroid && !on && { borderWidth: 1.2, borderColor: c.ink3 },
        fill && { width: '100%', justifyContent: 'center', height: 44 },
      ]}
    >
      {(icon || (isAndroid && on)) && <Icon name={isAndroid && on ? 'check' : icon!} size={16} color={fg} stroke={isAndroid && on ? 2.6 : 1.8} />}
      <Text v="caption" style={{ color: fg, fontSize: 14, fontFamily: on ? fonts.semibold : fonts.medium }}>
        {label}
      </Text>
    </Tap>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { c } = useTheme();
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={(v) => {
        haptic.tap();
        onChange(v);
      }}
      trackColor={{ false: c.line, true: c.accent }}
      thumbColor={isAndroid ? (value ? c.accentInk : c.ink3) : '#fff'}
      ios_backgroundColor={c.line}
    />
  );
}

export function Row({ children, style, gap = 12, ...rest }: ViewProps & { children: ReactNode; gap?: number }) {
  return (
    <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
      {children}
    </View>
  );
}

/** A settings-style list cell with leading icon tile. */
export function Cell({
  icon,
  title,
  subtitle,
  right,
  onPress,
  first,
  danger,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  first?: boolean;
  danger?: boolean;
}) {
  const { c } = useTheme();
  const content = (
    <View style={[styles.cell, !first && { borderTopWidth: 1, borderTopColor: c.line }]}>
      {icon && (
        <View style={[styles.cellIcon, { backgroundColor: danger ? c.missSoft : c.surface2 }]}>
          <Icon name={icon} size={19} tone={danger ? 'miss' : 'ink'} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text v="bodyStrong" tone={danger ? 'miss' : 'ink'}>
          {title}
        </Text>
        {subtitle ? (
          <Text v="caption" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron" size={16} tone="ink3" stroke={2} /> : null)}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} android_ripple={{ color: c.line }}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function ProgressSegments({ total, done, partial = 0, height = 6 }: { total: number; done: number; partial?: number; height?: number }) {
  const { c } = useTheme();
  if (total <= 0) return null;
  const segs = Math.min(total, 12);
  const per = total / segs;
  return (
    <View
      style={{ flexDirection: 'row', gap: 5 }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      {Array.from({ length: segs }, (_, i) => {
        const v = (i + 1) * per;
        const isDone = v <= done + 0.001;
        const isDue = !isDone && v <= done + partial + 0.001;
        return (
          <View key={i} style={{ flex: 1, height, borderRadius: height / 2, backgroundColor: isDue ? c.accentSoft : c.line, overflow: 'hidden' }}>
            <GrowBar pct={isDone ? 100 : 0} color={c.taken} height={height} delay={i * 70} />
          </View>
        );
      })}
    </View>
  );
}

export function Ring({ size, stroke, pct, color, track }: { size: number; stroke: number; pct: number; color: string; track: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circ * Math.max(0, Math.min(1, pct))} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export function Field({ label, hint, style, ...input }: TextInputProps & { label: string; hint?: string; style?: StyleProp<ViewStyle> }) {
  const { c, scale } = useTheme();
  return (
    <View style={style}>
      {isAndroid ? (
        <View style={[styles.mField, { borderColor: c.ink3 }]}>
          <Text v="caption" tone="ink2" style={[styles.mFieldLabel, { backgroundColor: c.bg }]}>
            {label}
          </Text>
          <TextInput
            placeholderTextColor={c.ink3}
            style={{ fontFamily: fonts.regular, fontSize: 17 * scale, color: c.ink, paddingVertical: 14 }}
            accessibilityLabel={label}
            {...input}
          />
        </View>
      ) : (
        <View style={[styles.field, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text v="caption">{label}</Text>
          <TextInput
            placeholderTextColor={c.ink3}
            style={{ fontFamily: fonts.medium, fontSize: 18 * scale, color: c.ink, paddingTop: 6, paddingBottom: 2 }}
            accessibilityLabel={label}
            {...input}
          />
        </View>
      )}
      {hint ? (
        <Text v="caption" style={{ marginTop: 6, marginLeft: 14 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 26, marginBottom: 10, marginHorizontal: 4 }}>
      <Text v="eyebrow" accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; label: string }) {
  const { c } = useTheme();
  const btn = (name: IconName, delta: number) => (
    <Tap
      onPress={() => onChange(Math.max(min, Math.min(max, Math.round((value + delta) * 100) / 100)))}
      accessibilityLabel={`${delta > 0 ? 'Increase' : 'Decrease'} ${label}`}
      hitSlop={8}
      style={[styles.stepBtn, { borderColor: c.line }]}
    >
      <Icon name={name} size={16} stroke={2.2} />
    </Tap>
  );
  return (
    <Row gap={10} style={{ flexShrink: 0 }}>
      {btn('minus', -step)}
      <Text v="headline" style={{ minWidth: 26, textAlign: 'center' }} accessibilityLabel={`${label} ${value}`}>
        {value}
      </Text>
      {btn('plus', step)}
    </Row>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 2 },
  segItem: { flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 11 },
  mSeg: { flexDirection: 'row', borderRadius: 22, borderWidth: 1.2, overflow: 'hidden' },
  mSegItem: { flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', height: 44, paddingHorizontal: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14 },
  cell: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, minHeight: 60 },
  cellIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  field: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  mField: { borderRadius: 12, borderWidth: 1.3, paddingHorizontal: 16, marginTop: 8 },
  mFieldLabel: { position: 'absolute', top: -9, left: 12, paddingHorizontal: 4, fontSize: 12.5 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});

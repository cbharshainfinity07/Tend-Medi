import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';

export type Variant =
  | 'display'
  | 'title'
  | 'h2'
  | 'h3'
  | 'headline'
  | 'body'
  | 'bodyStrong'
  | 'sub'
  | 'caption'
  | 'eyebrow'
  | 'mono'
  | 'button';

const base: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.serif, fontSize: 46, lineHeight: 48, letterSpacing: -0.5 },
  title: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 39, letterSpacing: -0.3 },
  h2: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 32 },
  h3: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 24, letterSpacing: -0.2 },
  headline: { fontFamily: fonts.semibold, fontSize: 16.5, lineHeight: 21, letterSpacing: -0.15 },
  body: { fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15.5, lineHeight: 21 },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 16 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 15, letterSpacing: 1.2, textTransform: 'uppercase' },
  mono: { fontFamily: fonts.mono, fontSize: 14.5, lineHeight: 18, fontVariant: ['tabular-nums'] },
  button: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, letterSpacing: -0.15 },
};

type Tone = 'ink' | 'ink2' | 'ink3' | 'accent' | 'taken' | 'skip' | 'miss' | 'heroInk' | 'heroInk2' | 'accentInk' | 'bg';

export interface Props extends TextProps {
  v?: Variant;
  tone?: Tone;
  center?: boolean;
  italic?: boolean;
  size?: number;
}

export function Text({ v = 'body', tone, center, italic, size, style, ...rest }: Props) {
  const { c, scale } = useTheme();
  const b = base[v];
  const defaultTone: Tone = v === 'sub' || v === 'body' ? 'ink2' : v === 'caption' || v === 'eyebrow' ? 'ink3' : 'ink';
  const fontSize = (size ?? b.fontSize!) * scale;
  const lineHeight = b.lineHeight ? (b.lineHeight * fontSize) / b.fontSize! : undefined;
  return (
    <RNText
      maxFontSizeMultiplier={v === 'display' || v === 'title' ? 1.3 : 1.8}
      {...rest}
      style={[
        b,
        { color: c[tone ?? defaultTone], fontSize, lineHeight },
        italic && { fontFamily: fonts.serifItalic },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}

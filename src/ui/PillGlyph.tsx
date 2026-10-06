import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { MedForm, PillColor } from '@/domain/types';
import { pillColors } from '@/theme/tokens';

const CREAM = '#F1E8D8';
const CREAM_EDGE = '#D9CDB6';

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Depicts the medication as it looks in real life (shape + colour) so people can
 * recognise the right pill at a glance — the core of Tend's iconography.
 */
export function PillGlyph({ form, color, size = 40 }: { form: MedForm; color: PillColor; size?: number }) {
  const main = pillColors[color].main;
  const edge = shade(main, -0.12);
  const gloss = (
    <Defs>
      <RadialGradient id="gl" cx="0.35" cy="0.3" r="0.8">
        <Stop offset="0" stopColor="#fff" stopOpacity={0.55} />
        <Stop offset="0.5" stopColor="#fff" stopOpacity={0} />
      </RadialGradient>
    </Defs>
  );

  let body;
  switch (form) {
    case 'capsule':
      body = (
        <G transform="rotate(-40 24 24)">
          <Path d="M17 24V14a7 7 0 0 1 14 0v10z" fill={main} />
          <Path d="M17 24v10a7 7 0 0 0 14 0V24z" fill={CREAM} stroke={CREAM_EDGE} strokeWidth={1} />
          <Rect x={19.5} y={10} width={3} height={11} rx={1.5} fill="#fff" opacity={0.4} />
        </G>
      );
      break;
    case 'softgel':
      body = (
        <G transform="rotate(-25 24 24)">
          <Ellipse cx={24} cy={24} rx={16} ry={11} fill={main} />
          <Ellipse cx={24} cy={24} rx={16} ry={11} fill="url(#gl)" />
          <Ellipse cx={18} cy={20} rx={4} ry={2} fill="#fff" opacity={0.55} />
        </G>
      );
      break;
    case 'liquid':
      body = (
        <G>
          <Rect x={17} y={6} width={14} height={6} rx={2} fill={shade(main, -0.2)} />
          <Path d="M15 14h18l1 4v20a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V18z" fill={main} />
          <Rect x={17} y={22} width={14} height={10} rx={2} fill={CREAM} opacity={0.9} />
          <Rect x={17.5} y={16} width={3} height={22} rx={1.5} fill="#fff" opacity={0.25} />
        </G>
      );
      break;
    case 'injection':
      body = (
        <G transform="rotate(45 24 24)">
          <Rect x={19} y={6} width={10} height={28} rx={4} fill={main} />
          <Rect x={20.5} y={14} width={7} height={10} rx={2} fill={CREAM} />
          <Rect x={22} y={34} width={4} height={5} rx={1} fill={shade(main, -0.2)} />
          <Path d="M24 39v5" stroke="#9A958B" strokeWidth={1.4} strokeLinecap="round" />
        </G>
      );
      break;
    case 'drops':
      body = (
        <G>
          <Path d="M24 7c6 8 11 13.5 11 19.5a11 11 0 0 1-22 0C13 20.5 18 15 24 7z" fill={main} />
          <Path d="M24 7c6 8 11 13.5 11 19.5a11 11 0 0 1-22 0C13 20.5 18 15 24 7z" fill="url(#gl)" />
        </G>
      );
      break;
    case 'inhaler':
      body = (
        <G>
          <Rect x={19} y={5} width={10} height={18} rx={3} fill={shade(main, -0.15)} />
          <Path d="M14 20h20v10l-4 12H18l-4-12z" fill={main} />
          <Rect x={16} y={22} width={3} height={14} rx={1.5} fill="#fff" opacity={0.3} />
        </G>
      );
      break;
    case 'tablet':
    case 'other':
    default:
      body =
        color === 'slate' || color === 'plum' ? (
          // oval tablet
          <G transform="rotate(20 24 24)">
            <Rect x={8} y={15} width={32} height={18} rx={9} fill={main} />
            <Rect x={8} y={15} width={32} height={18} rx={9} fill="url(#gl)" />
            <Path d="M24 15.5v17" stroke={edge} strokeWidth={1.4} strokeLinecap="round" />
          </G>
        ) : (
          <G>
            <Circle cx={24} cy={24} r={15} fill={main} stroke={edge} strokeWidth={1.2} />
            <Path d="M13 24h22" stroke={edge} strokeWidth={1.6} strokeLinecap="round" />
            <Circle cx={24} cy={24} r={15} fill="url(#gl)" />
          </G>
        );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {gloss}
      {body}
    </Svg>
  );
}

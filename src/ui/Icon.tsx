import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';

// Custom 24px line icon set (1.8 stroke, round caps) matching the Tend design drafts.
const paths = {
  today: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 3.5v3M12 12l3.5 2" />
    </>
  ),
  camera: (
    <>
      <Path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.5-2h4.4l1.5 2h1.8A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
      <Circle cx={12} cy={12.5} r={3.3} />
    </>
  ),
  image: (
    <>
      <Rect x={3.5} y={4.5} width={17} height={15} rx={3.5} />
      <Circle cx={9} cy={9.5} r={1.6} />
      <Path d="M20.5 15.5l-4.5-4.5-8.5 8.5" />
    </>
  ),
  hold: (
    <>
      <Circle cx={12} cy={12} r={3.2} />
      <Path d="M12 4.5a7.5 7.5 0 1 1 -7.5 7.5" />
    </>
  ),
  meds: (
    <G transform="rotate(-40 12 12)">
      <Rect x={8} y={3} width={8} height={18} rx={4} />
      <Path d="M8 12h8" />
    </G>
  ),
  history: (
    <>
      <Rect x={3.5} y={5} width={17} height={15.5} rx={4.5} />
      <Path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
    </>
  ),
  settings: (
    <>
      <Path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9" />
      <Circle cx={15} cy={7.5} r={2.2} />
      <Circle cx={9} cy={16.5} r={2.2} />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M6 12h12" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  skip: <Path d="M4 16c1.5-5 5-8 9-8h6M15 4l4 4-4 4" />,
  bell: <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  snooze: (
    <>
      <Circle cx={12} cy={13} r={7.5} />
      <Path d="M9.5 10.5h5l-5 5h5M4 4.5l3-2M20 4.5l-3-2" />
    </>
  ),
  alarm: (
    <>
      <Circle cx={12} cy={13} r={7.5} />
      <Path d="M12 9.5V13l2.5 1.5M4 4.5l3-2M20 4.5l-3-2" />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  bottle: (
    <>
      <Rect x={6.5} y={3} width={11} height={4} rx={1.5} />
      <Path d="M7.5 7h9v11.5a2.5 2.5 0 0 1-2.5 2.5h-4a2.5 2.5 0 0 1-2.5-2.5zM7.5 11.5h9M7.5 16.5h9" />
    </>
  ),
  note: <Path d="M6 3.5h8.5L19 8v12.5H6zM14 3.5V8.5h5M9 13h7M9 16.5h5" />,
  chevron: <Path d="M9 5l7 7-7 7" />,
  back: <Path d="M15 5l-7 7 7 7" />,
  down: <Path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  up: <Path d="M12 15.5V4M7 8.5l5-5 5 5M5 20h14" />,
  lock: (
    <>
      <Rect x={5} y={10.5} width={14} height={10} rx={3} />
      <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  shield: <Path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6zM9 12l2 2 4-4" />,
  offline: <Path d="M4 9.5a12 12 0 0 1 16 0M7 13a7.5 7.5 0 0 1 10 0M10 16.5a3 3 0 0 1 4 0M3.5 3.5l17 17" />,
  noAccount: (
    <>
      <Circle cx={12} cy={8.5} r={3.8} />
      <Path d="M5 20a7 7 0 0 1 14 0M3.5 3.5l17 17" />
    </>
  ),
  flame: (
    <Path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 3-5.8 4-9.3 2.2 1.4 3.2 3.6 3.2 5.5 1-.6 1.7-1.6 2-2.8 1.6 1.6 3.8 4 3.8 6.6 0 3.6-2.6 6.2-6.5 6.2z" />
  ),
  sun: (
    <>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <Path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  text: <Path d="M3.5 18L8 6l4.5 12M5 14h6M14 18l3.25-8L20.5 18M15 15.5h4.5" />,
  table: (
    <>
      <Rect x={4} y={4} width={16} height={16} rx={3.5} />
      <Path d="M4 9.5h16M4 14.5h16M10 9.5v10.5" />
    </>
  ),
  folder: <Path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  edit: <Path d="M5 19l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L9 17.5zM13.5 7l3 3" />,
  pause: <Path d="M9 6v12M15 6v12" />,
  play: <Path d="M8 5.5v13l10-6.5z" />,
  trash: <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  heart: <Path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />,
  me: (
    <>
      <Circle cx={12} cy={8} r={3.8} />
      <Path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  family: (
    <>
      <Circle cx={8.5} cy={7.5} r={3} />
      <Circle cx={17} cy={10} r={2.3} />
      <Path d="M3 19.5a5.5 5.5 0 0 1 11 0M13.5 19.5a3.8 3.8 0 0 1 7.5 0" />
    </>
  ),
  battery: (
    <>
      <Rect x={7} y={4.5} width={10} height={16.5} rx={2.5} />
      <Path d="M10 2.5h4M12.8 9l-2.3 3.8h3l-2.3 3.8" />
    </>
  ),
  calendar: (
    <>
      <Rect x={3.5} y={5} width={17} height={15.5} rx={4.5} />
      <Path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
      <Circle cx={12} cy={15} r={1.2} fill="currentColor" />
    </>
  ),
  info: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 11v5.5M12 7.8v.2" />
    </>
  ),
  restore: <Path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.8h3.8M12 8v4l2.5 2" />,
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 22,
  color,
  tone = 'ink',
  stroke = 1.8,
}: {
  name: IconName;
  size?: number;
  color?: string;
  tone?: keyof Palette;
  stroke?: number;
}) {
  const { c } = useTheme();
  const col = color ?? c[tone];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={col}
      color={col}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </Svg>
  );
}

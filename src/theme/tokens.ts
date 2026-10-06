import type { PillColor } from '@/domain/types';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  taken: string;
  takenInk: string;
  takenSoft: string;
  skip: string;
  skipSoft: string;
  miss: string;
  missSoft: string;
  hero: string;
  heroInk: string;
  heroInk2: string;
  flame: string;
  scrim: string;
}

export const light: Palette = {
  bg: '#F3EFE7',
  surface: '#FBF9F4',
  surface2: '#EEE9DE',
  ink: '#1B1A17',
  ink2: '#5E5A52',
  ink3: '#736E64',
  line: '#E2DCCF',
  accent: '#1F5A4C',
  accentInk: '#F4F0E6',
  accentSoft: '#DDE8E1',
  taken: '#2E7A58',
  takenInk: '#FFFFFF',
  takenSoft: '#DCEBE1',
  skip: '#96690F',
  skipSoft: '#F3E7CC',
  miss: '#B4472B',
  missSoft: '#F4DDD3',
  hero: '#1B1A17',
  heroInk: '#F4F0E6',
  heroInk2: '#A8A296',
  flame: '#D2603F',
  scrim: 'rgba(20,18,14,0.42)',
};

export const dark: Palette = {
  bg: '#11120F',
  surface: '#1A1B18',
  surface2: '#23251F',
  ink: '#EFEBE2',
  ink2: '#AAA598',
  ink3: '#8A867C',
  line: '#2B2D27',
  accent: '#8FC9AF',
  accentInk: '#0F1A15',
  accentSoft: '#1D2D26',
  taken: '#7CC39F',
  takenInk: '#0F1A15',
  takenSoft: '#1C2D24',
  skip: '#D9AE5C',
  skipSoft: '#2E2718',
  miss: '#E08466',
  missSoft: '#33201A',
  hero: '#E9E4D8',
  heroInk: '#151512',
  heroInk2: '#6A665D',
  flame: '#E9805F',
  scrim: 'rgba(0,0,0,0.55)',
};

/** Physical pill colours: [primary, secondary/cream, outline]. Same in both themes — they depict real pills. */
export const pillColors: Record<PillColor, { main: string; label: string }> = {
  chalk: { main: '#EFEADF', label: 'White' },
  pine: { main: '#2F6B5A', label: 'Green' },
  coral: { main: '#D2603F', label: 'Red' },
  amber: { main: '#E3A23A', label: 'Yellow' },
  slate: { main: '#6E86A9', label: 'Blue' },
  rose: { main: '#C97B8C', label: 'Pink' },
  plum: { main: '#7D5F95', label: 'Purple' },
};

export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  mono: 'GeistMono_500Medium',
} as const;

export const radius = { sm: 12, md: 16, lg: 20, xl: 24, xxl: 28, pill: 999 } as const;

export const space = (n: number) => n * 4;

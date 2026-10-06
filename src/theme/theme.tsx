import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { useStore } from '@/store/store';
import { dark, light, type Palette } from './tokens';

export interface Theme {
  c: Palette;
  dark: boolean;
  /** Extra scale applied in Simple mode on top of the OS text size. */
  scale: number;
  simple: boolean;
  platform: 'ios' | 'android' | 'web';
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const pref = useStore((s) => s.settings.theme);
  const simple = useStore((s) => s.settings.simpleMode);
  const isDark = pref === 'dark' || (pref === 'system' && system === 'dark');
  const value = useMemo<Theme>(
    () => ({
      c: isDark ? dark : light,
      dark: isDark,
      simple,
      scale: simple ? 1.18 : 1,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    }),
    [isDark, simple],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside ThemeProvider');
  return t;
}

/** Android gets Material 3 structure; iOS and web preview use the iOS shell. */
export const isAndroid = Platform.OS === 'android';

import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { Animated, Easing, ScrollView, type ScrollViewProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/theme';
import { ND, useReduceMotion } from './motion';

/** Scrollable page with safe-area padding and the app background. */
export function Screen({
  children,
  bottomInset = 32,
  footer,
  padded = true,
  ...rest
}: ScrollViewProps & { children: ReactNode; bottomInset?: number; footer?: ReactNode; padded?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  // Each time a screen comes into focus (tab switch, returning from a page) it settles in softly.
  const [v] = useState(() => new Animated.Value(1));
  useFocusEffect(
    useCallback(() => {
      if (reduce) return;
      v.setValue(0);
      Animated.timing(v, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
    }, [reduce, v]),
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Animated.View style={{ flex: 1, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomInset, paddingHorizontal: padded ? 20 : 0 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        {...rest}
      >
        {children}
      </ScrollView>
      </Animated.View>
      {footer}
    </View>
  );
}

/** Sticky bottom action area that fades the content beneath it. */
export function Footer({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 16),
        backgroundColor: c.bg,
        borderTopWidth: 1,
        borderTopColor: c.line,
      }}
    >
      {children}
    </View>
  );
}

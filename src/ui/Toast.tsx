import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useTheme } from '@/theme/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface ToastState {
  id: number;
  message: string | null;
  icon?: IconName;
  action?: { label: string; run: () => void };
  show(message: string, opts?: { icon?: IconName; action?: { label: string; run: () => void } }): void;
  hide(): void;
}

export const useToast = create<ToastState>()((set, get) => ({
  id: 0,
  message: null,
  show(message, opts) {
    set({ id: get().id + 1, message, icon: opts?.icon, action: opts?.action });
    AccessibilityInfo.announceForAccessibility(message);
  },
  hide() {
    set({ message: null, action: undefined });
  },
}));

export const toast = (message: string, opts?: Parameters<ToastState['show']>[1]) => useToast.getState().show(message, opts);

export function ToastHost() {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { id, message, icon, action, hide } = useToast();
  const [y] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    y.setValue(0);
    Animated.spring(y, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 7 }).start();
    const t = setTimeout(hide, action ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [id, message, action, hide, y]);

  if (!message) return null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            backgroundColor: c.hero,
            marginBottom: insets.bottom + 104,
            opacity: y,
            transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          },
        ]}
      >
        {icon && <Icon name={icon} size={19} color={c.heroInk} stroke={2.3} />}
        <Text v="bodyStrong" style={{ color: c.heroInk, flex: 1 }} numberOfLines={2}>
          {message}
        </Text>
        {action && (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              action.run();
              hide();
            }}
          >
            <Text v="button" style={{ color: dark ? c.accentInk : '#8FC9AF' }}>
              {action.label}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    marginHorizontal: 16,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});

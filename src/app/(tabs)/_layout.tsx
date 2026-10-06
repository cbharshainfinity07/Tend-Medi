import { Redirect, router } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/store/store';
import { isAndroid, useTheme } from '@/theme/theme';
import { fonts } from '@/theme/tokens';
import { haptic } from '@/ui/haptics';
import { Icon, type IconName } from '@/ui/Icon';
import { Tap } from '@/ui/kit';
import { Text } from '@/ui/Text';

const TABS: { name: string; href: '/' | '/meds' | '/history' | '/settings'; label: string; icon: IconName }[] = [
  { name: 'index', href: '/', label: 'Today', icon: 'today' },
  { name: 'meds', href: '/meds', label: 'Meds', icon: 'meds' },
  { name: 'history', href: '/history', label: 'History', icon: 'history' },
  { name: 'settings', href: '/settings', label: 'Settings', icon: 'settings' },
];

export default function TabsLayout() {
  const onboarded = useStore((s) => s.settings.onboarded);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  if (!onboarded) return <Redirect href="/onboarding" />;

  const triggers = TABS.map((t) => (
    <TabTrigger key={t.name} name={t.name} asChild>
      <TabButton icon={t.icon} label={t.label} />
    </TabTrigger>
  ));

  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <View
        style={[
          styles.bar,
          isAndroid
            ? { backgroundColor: c.surface2, paddingBottom: insets.bottom + 12, paddingTop: 12 }
            : { backgroundColor: c.bg, borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: Math.max(insets.bottom - 4, 10), paddingTop: 10 },
        ]}
      >
        {isAndroid ? (
          triggers
        ) : (
          <>
            {triggers.slice(0, 2)}
            <View style={styles.addSlot}>
              <Tap
                onPress={() => router.push('/med/new')}
                accessibilityLabel="Add medication"
                hapticKind="press"
                style={[styles.add, { backgroundColor: c.accent }]}
              >
                <Icon name="plus" size={24} color={c.accentInk} stroke={2.3} />
              </Tap>
            </View>
            {triggers.slice(2)}
          </>
        )}
      </View>
      <TabList style={{ display: 'none' }}>
        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} />
        ))}
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: IconName; label: string };

const TabButton = forwardRef<View, TabButtonProps>(function TabButton({ icon, label, isFocused, onPress, ...props }, ref) {
  const { c } = useTheme();
  return (
    <Pressable
      ref={ref}
      {...props}
      onPress={(e) => {
        haptic.tap();
        onPress?.(e);
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      style={styles.tab}
    >
      {isAndroid ? (
        <View style={[styles.indicator, isFocused && { backgroundColor: c.accentSoft }]}>
          <Icon name={icon} size={23} color={isFocused ? c.accent : c.ink2} />
        </View>
      ) : (
        <Icon name={icon} size={25} color={isFocused ? c.ink : c.ink3} />
      )}
      <Text
        v="caption"
        style={{
          fontSize: isAndroid ? 12.5 : 11,
          color: isFocused ? c.ink : isAndroid ? c.ink2 : c.ink3,
          fontFamily: isFocused ? (isAndroid ? fonts.bold : fonts.semibold) : fonts.medium,
          marginTop: isAndroid ? 4 : 3,
        }}
        maxFontSizeMultiplier={1.3}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  // Same width as a tab so all five columns are evenly spaced.
  addSlot: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  indicator: { width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  add: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1A14',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
});

import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif/400Regular_Italic';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { AppState, LogBox, Platform, Pressable, Text as RNText, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setupNotifications } from '@/notifications/engine';
import { applyResponse } from '@/notifications/responses';
import { useStore } from '@/store/store';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { PhotoViewerHost } from '@/ui/MedPhoto';
import { CelebrationHost } from '@/ui/motion';
import { ToastHost, toast } from '@/ui/Toast';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// expo-router's tab container passes `collapsable={false}` to the DOM on web; harmless dev-only noise.
LogBox.ignoreLogs(['Received `false` for a non-boolean attribute']);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_500Medium,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });
  const ready = useStore((s) => s.ready);
  const loadError = useStore((s) => s.loadError);

  useEffect(() => {
    useStore.getState().init();
    setupNotifications().catch((e) => console.warn('notification setup failed', e));
  }, []);

  useEffect(() => {
    if (fontError) console.warn('font load failed, using system fonts', fontError);
  }, [fontError]);

  // Never hold the app hostage to fonts: carry on with system fonts if one fails or stalls.
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 5000);
    return () => clearTimeout(t);
  }, []);
  const fontsReady = fontsLoaded || !!fontError || fontTimeout;

  useEffect(() => {
    if (fontsReady && (ready || loadError)) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsReady, ready, loadError]);

  if (loadError) return <LoadErrorScreen />;
  if (!fontsReady || !ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { c, dark } = useTheme();
  useNotificationResponses();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => undefined);
  }, [c.bg]);

  // Roll the reminder window forward whenever the app comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && useStore.getState().resync());
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'ios_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="med/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="med/[id]" />
        <Stack.Screen
          name="dose"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 32,
            contentStyle: { backgroundColor: c.bg },
          }}
        />
      </Stack>
      <CelebrationHost />
      <ToastHost />
      <PhotoViewerHost />
    </>
  );
}

function useNotificationResponses() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // The cold-start response can also arrive through the listener; handle each one once.
    const seen = new Set<string>();
    const handle = async (resp: Notifications.NotificationResponse) => {
      const key = `${resp.notification.request.identifier}|${resp.actionIdentifier}|${resp.notification.date}`;
      if (seen.has(key)) return;
      seen.add(key);
      const out = await applyResponse(resp.actionIdentifier, resp.notification.request.content.data);
      if (out.kind === 'open') router.push({ pathname: '/dose', params: { medId: out.medId, slot: out.slot } });
      else if (out.kind === 'handled' && resp.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) toast('Saved', { icon: 'check' });
    };
    // Cold start from a notification tap/action
    Notifications.getLastNotificationResponseAsync()
      .then((r) => r && handle(r).then(() => Notifications.clearLastNotificationResponseAsync()))
      .catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      handle(r).catch(() => undefined);
    });
    return () => sub.remove();
  }, []);
}

/** Shown only if the on-device database can't be opened. Deliberately dependency-light. */
function LoadErrorScreen() {
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#EFEBE2' : '#1B1A17';
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 28, backgroundColor: dark ? '#11120F' : '#F3EFE7' }}>
      <RNText style={{ fontSize: 26, fontWeight: '600', color: fg }}>Tend couldn’t open your data</RNText>
      <RNText style={{ fontSize: 16, lineHeight: 23, marginTop: 10, color: fg, opacity: 0.75 }}>
        Your medications are still stored on this phone. Close the app completely and open it again. If this keeps happening,
        restart the phone.
      </RNText>
      <Pressable
        accessibilityRole="button"
        onPress={() => useStore.getState().init()}
        style={{ marginTop: 24, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F5A4C' }}
      >
        <RNText style={{ color: '#F4F0E6', fontSize: 16, fontWeight: '600' }}>Try again</RNText>
      </Pressable>
    </View>
  );
}

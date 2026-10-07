import type { ExpoConfig } from 'expo/config';

// Production builds ship without the INTERNET permission on Android, so the
// "your data never leaves this phone" promise is enforced by the OS, not just policy.
// Development builds keep it because the dev client loads JS over the network.
const blockInternet = process.env.TEND_BLOCK_INTERNET === '1';

const config: ExpoConfig = {
  name: 'Tend',
  slug: 'tend',
  owner: 'cbharsha200',
  scheme: 'tend',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#F3EFE7',
  experiments: { typedRoutes: true },
  ios: {
    bundleIdentifier: 'app.tend.reminders',
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    // Lets dose reminders break through Focus modes the user hasn't explicitly silenced Tend in.
    entitlements: {
      'com.apple.developer.usernotifications.time-sensitive': true,
    },
  },
  android: {
    package: 'app.tend.reminders',
    adaptiveIcon: {
      backgroundColor: '#1F5A4C',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    ],
    // Pulled in by libraries but never used: the photo picker needs no storage access,
    // and overlay/dump permissions only alarm users and Play review.
    blockedPermissions: [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.DUMP',
      ...(blockInternet ? ['android.permission.INTERNET'] : []),
    ],
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  extra: {
    eas: { projectId: 'e72f809b-1c4d-4042-82b0-7536777a66e9' },
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-font',
    'expo-localization',
    'expo-sharing',
    [
      'expo-image-picker',
      {
        photosPermission: 'Tend uses your photos so you can add a picture of your medicine and recognise it at a glance.',
        cameraPermission: 'Tend uses the camera so you can photograph your medicine or its box and recognise it at a glance.',
        microphonePermission: false,
      },
    ],
    '@react-native-community/datetimepicker',
    [
      'expo-notifications',
      {
        color: '#1F5A4C',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F3EFE7',
        image: './assets/splash-icon.png',
        imageWidth: 120,
        dark: { backgroundColor: '#11120F', image: './assets/splash-icon-dark.png' },
      },
    ],
    'expo-status-bar',
  ],
};

export default config;

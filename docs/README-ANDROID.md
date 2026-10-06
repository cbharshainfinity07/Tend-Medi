# Tend for Android

## What's in this zip

| File | Use it for |
|---|---|
| `Tend-1.0.0.apk` | Install directly on any Android phone for testing or sharing (sideload). |
| `Tend-1.0.0-play.aab` | The file you upload to Google Play. |
| `tend-source/` | The full app source (Expo / React Native). |
| `PRODUCTION-READINESS.md`, `STORE-LISTING.md`, `PRIVACY-POLICY.md` | Release notes, store text, privacy policy. |

Both builds are signed with the Android key Expo generated for the project `@cbharsha200/tend`.
That key lives in your Expo account (expo.dev → project → Credentials). **Never delete it**: every
future Play Store update must be signed with the same key.

## Install the APK on a phone

1. Copy `Tend-1.0.0.apk` to the phone (or open the download link from expo.dev on the phone).
2. Tap it. If Android asks, allow "Install unknown apps" for the app you opened it from.
3. Open Tend and allow notifications when asked. On first run, also allow "Alarms & reminders"
   and "Unrestricted battery" so reminders ring at the exact minute.

## Publish on Google Play

1. Create a Play Console account (one-time US$25) at play.google.com/console.
2. Create an app: name "Tend: Medication Reminder", category Medical, free.
3. Upload `Tend-1.0.0-play.aab` to Internal testing first, then Production.
4. Fill in the store listing from `STORE-LISTING.md`; add screenshots and the promo video.
5. App content:
   - Privacy policy: host `PRIVACY-POLICY.md` at a public URL and paste it.
   - Data safety: "No data collected", "No data shared".
   - Health apps declaration: medication reminder, not a medical device.
   - Exact alarm permission: Tend is a medication-reminder app; reminders must fire at the scheduled minute.
6. Submit for review.

Faster with Expo (after the Play app exists): `npx eas-cli submit --platform android --profile production`.

## Rebuild

From `tend-source/`:

```bash
npm install
npx eas-cli build --platform android --profile preview      # APK
npx eas-cli build --platform android --profile production   # Play Store AAB (version code auto-increments)
```

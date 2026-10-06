# Tend — production readiness report

Date: 6 October 2026 · App version 1.0.0 · Expo SDK 57 · React Native 0.86

## Verdict

**The app is feature-complete and technically ready for a release build.** The code, data handling,
reminders, backups and accessibility are at production quality, and all automated checks pass.

It is **not yet "live in the stores"** — that last step needs a few things only you (the account
owner) can provide: store developer accounts, a hosted privacy policy URL, store screenshots, and
real-device testing of notifications. Those are listed under "Before you publish" below.

## What was verified

| Check | Result |
|---|---|
| TypeScript (`npm run typecheck`) | Clean |
| Lint (`npm run lint`) | Clean |
| Unit tests (`npm test`) — scheduling, streaks, reminder planning, backup (incl. photos) | 27 / 27 passing |
| Expo Doctor (dependency + config health) | 21 / 21 checks passed |
| Manual pass of every screen at iPhone size, light + dark | Done; fixes below |
| Cloud release builds (EAS) | Android APK, Android AAB, iOS Simulator queued on @cbharsha200/tend |

## Fixed during the final audit

- **Startup could hang on a blank screen** if a font failed to download or on-device storage failed to open. Fonts now fall back after 5 s; a storage failure shows a clear "Try again" screen instead of a blank app.
- **Placeholder app icon** (Expo's default) replaced with the new Tend logo: iOS icon, Android adaptive icon (foreground / background / monochrome), light + dark splash screens, favicon.
- **Time picker** closed after choosing the hour; rows also re-sorted mid-edit. Fixed.
- **Tab bar** "+" button misaligned. Now five even columns.
- **Overlaps / alignment**: History header, unit picker, frequency and duration grids, as-needed rows, snooze chips, Settings privacy card.
- **New: medicine photos** — take or choose a photo of each medicine; shown on Today, rows, reminder sheet, Simple mode, full-screen viewer. Photos are private (app sandbox) and included in backups.
- **New: motion & haptics** — hold-to-take, confetti on taken, "All done" celebration, screen and step transitions, all respecting Reduce Motion and screen readers.
- **Release config**: EAS build profiles, project linked to your Expo account, auto-incrementing build numbers, dependencies updated to the latest SDK 57 patches, Android release builds strip the INTERNET permission (data physically cannot leave the phone).

## Strengths (production-grade)

- Offline-first; no account, no server, no analytics, no tracking.
- Reminder engine: rolling 7-day schedule within iOS's 64-notification limit, follow-up nudges, snooze, Taken / Snooze / Skip from the notification, survives restarts.
- Local-time scheduling that is correct across daylight-saving changes and time zones.
- Idempotent dose logging; stock counts that never double-count; refill reminders.
- Validated backup / restore (rejects foreign or unsafe files), CSV report for doctors.
- Accessibility: screen-reader labels, Dynamic Type, Simple mode, Reduce Motion, WCAG AA contrast.

## Before you publish (owner actions)

1. **Real-device test pass** of notifications on at least one recent iPhone and one Android phone (Android 13+, plus a Samsung/Xiaomi device for battery-optimisation behaviour). Expo Go cannot test background notification actions; use the APK build.
2. **Host the privacy policy** (`PRIVACY-POLICY.md`, ready to paste) at a public URL — both stores require it.
3. **Google Play**: Play Console account (one-time US$25). Complete the Data safety form ("No data collected or shared"). Exact alarms: declare that Tend is a medication-reminder app (the `SCHEDULE_EXACT_ALARM` permission is user-granted). Battery-optimisation exemption: Play may ask for justification — reminders must fire on time.
4. **Apple App Store**: Apple Developer Program (US$99/year). App Privacy label: "Data Not Collected". The time-sensitive notification entitlement is already configured.
5. **Store screenshots**: the captures in `videos/tend-promo/capture/assets/` are a good base (6.7" and 6.5" iPhone sizes and Android phone sizes needed).
6. **Medical disclaimer** is in the app (Settings footer) and in the store text — keep it.

## Known limits (acceptable for 1.0)

- English only (dates/times follow the phone's locale).
- iOS cannot log a dose from the notification while the app is fully closed (Apple limitation); the action opens the app and logs it.
- No caregiver sharing (by design: no cloud).

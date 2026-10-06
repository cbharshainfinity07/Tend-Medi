# Tend for iPhone (iOS)

## What's in this zip

| File | Use it for |
|---|---|
| `Tend-1.0.0-ios-simulator.tar.gz` | Runs Tend in the iPhone Simulator on a Mac (Xcode). Not installable on a real iPhone. |
| `tend-source/` | The full app source (Expo / React Native), already configured for iOS (bundle id `app.tend.reminders`). |
| `PRODUCTION-READINESS.md`, `STORE-LISTING.md`, `PRIVACY-POLICY.md` | Release notes, store text, privacy policy. |

## Why there's no .ipa yet

Apple only lets apps run on real iPhones, or ship to TestFlight and the App Store, when they're
signed with an **Apple Developer Program** account (US$99/year). Once you have one, Expo builds and
signs the iPhone version in the cloud. You don't need a Mac.

## Try it now

- **Any iPhone, today:** install **Expo Go** from the App Store and open the project from a development server (`npm start` in `tend-source/`). This is how you've been testing.
- **On a Mac:** extract the simulator build and drag `Tend.app` onto an open iOS Simulator.

## Make the App Store build (after joining the Apple Developer Program)

From `tend-source/`:

```bash
npm install
npx eas-cli build --platform ios --profile production
```

EAS asks you to sign in to your Apple account **yourself** in the terminal, then creates the
certificates and provisioning profile for you. Then:

```bash
npx eas-cli submit --platform ios --profile production
```

That uploads the build to App Store Connect / TestFlight.

## App Store Connect checklist

1. Create the app: name "Tend: Medication Reminder", bundle id `app.tend.reminders`, category Medical.
2. App Privacy: **Data Not Collected**.
3. Privacy policy URL: host `PRIVACY-POLICY.md` publicly.
4. Store text and keywords: `STORE-LISTING.md`. Screenshots: 6.7" and 6.5" iPhone.
5. Notifications: the time-sensitive notification entitlement is already configured, so reminders can break through Focus.
6. Submit for review.

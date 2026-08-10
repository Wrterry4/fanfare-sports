# Shipping as a PWA

One codebase, two targets. `expo export --platform web` produces the PWA;
`expo run:ios` produces the native app later, from the same source. Metro picks
`*.web.js` over `*.js` automatically, so the platform differences live in five
small files and nothing else changes.

## What I got wrong earlier

I said background audio was a reason native was required. **That was overstated.**
The walk-up use case is a scorekeeper tapping "next batter" with the app open and
the screen on — browsers handle that fine, and the Cache API stores trimmed clips
offline. Background audio only matters with the screen locked, which isn't the
scenario.

The real losses are narrower, and listed below.

## What actually changes

| | Native | PWA |
|---|---|---|
| Engine, stats, invites, rules, functions | identical | identical |
| Offline scoring | native SDK, disk-backed | IndexedDB, disk-backed |
| Push on Android/desktop | yes | yes |
| Push on iPhone | yes | **only after Add to Home Screen** (iOS 16.4+) |
| Haptics | yes | Android only — iOS Safari has no Vibration API |
| Walk-up audio (app open) | yes | yes |
| Walk-up audio (screen locked) | yes | no |
| Cost to ship | $99/yr + $25 | $0 |
| Install friction | app store | a link |

**The link is worth more than it sounds.** Your invite flow is a coach texting
fifteen parents. On a PWA that link opens the app instantly, with no store,
no download, no account-before-value. That's a materially better funnel than
native, and for a product that lives or dies on parent adoption it may outweigh
everything in the "native" column.

## The one real constraint: iOS push needs the home screen

Safari in a tab cannot receive Web Push at all. Only an installed PWA can, and
only on iOS 16.4+. Since the on-deck alert is the feature that makes a
grandparent bother, iPhone users must be walked through Share → Add to Home
Screen first.

`push.web.js` exposes `requiresInstallFirst()` so the UI detects this instead of
showing a button that silently does nothing. `InstallPrompt.jsx` handles both
paths — Chrome's one-tap `beforeinstallprompt`, and manual instructions on iOS
where that event never fires.

**The same step fixes offline durability.** Safari evicts IndexedDB for sites
unused for seven days; installed PWAs are exempt. So installing is what makes the
scorekeeper's offline write queue survive between games. Prompt hard for anyone
who might keep the book — `InstallPrompt` takes `reason="scoring"` for that
framing.

## Platform-split files

```
src/services/firebase.js       native  →  @react-native-firebase
src/services/firebase.web.js   web     →  firebase JS SDK + persistentLocalCache
src/services/push.js           native  →  FCM native
src/services/push.web.js       web     →  FCM web + VAPID + install detection
src/services/haptics.js        native  →  expo-haptics
src/services/haptics.web.js    web     →  navigator.vibrate (Android only)
```

Everything else imports from `'./firebase'` and `'./push'` **without an
extension** — that's what lets Metro swap them. Adding `.js` back would silently
break the web build.

## Setup

```bash
npx create-expo-app@latest ridgeview --template blank
cd ridgeview
# copy this bundle in, delete the template App.js
npm install
npx expo install react-dom react-native-web @expo/metro-runtime
```

Create `.env`:

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_VAPID_KEY=...
```

VAPID key: Firebase Console → Project Settings → Cloud Messaging → Web Push
certificates → Generate key pair.

Then fill in the same values in `public/firebase-messaging-sw.js` — the service
worker has no bundler and can't read env vars. These are public identifiers, not
secrets; access is controlled by Firestore rules.

Icons needed in `public/icons/`: `icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`, `badge-72.png`.

## Run and deploy

```bash
firebase emulators:start        # terminal 1
npm run web                     # terminal 2

npm run deploy:backend          # rules, indexes, functions
npm run deploy:web              # export + firebase hosting
```

Hosting is configured with an SPA rewrite, so `/join/:id` and every deep route
resolve to `index.html` and get handled client-side. The invite fragment works
natively on the web — no interception needed, though `linking.js` still handles
it so the same code ships to native.

`firebase-messaging-sw.js` is served with `no-cache`. A stale service worker
silently breaks push after a deploy, and it's a miserable thing to debug.

## Converting to native later

The work is roughly:

1. `npx expo install expo-dev-client @react-native-firebase/app` (+ auth,
   firestore, functions, messaging)
2. Drop in `google-services.json` and `GoogleService-Info.plist`
3. `npx expo run:ios` / `run:android`

The `.web.js` files stay for the PWA; the plain `.js` files activate for native.
Nothing in `src/engine`, `src/shared`, `src/components`, `src/screens`, or
`functions/` changes.

## Verification order

1. `npm test` → 150 passing
2. Rules suite against the emulator — **still the highest-value unrun check**
3. `npm run web`, score a half-inning
4. Chrome DevTools → Application → Service Workers: confirm registration
5. **Offline test:** DevTools → Network → Offline, score an inning, reload the
   page, confirm nothing was lost. This is the whole architecture bet.
6. Install on an Android phone, verify push
7. Install on an iPhone via Add to Home Screen, verify push (this will fail from
   a Safari tab — that's expected, not a bug)
8. Open an invite link on a real phone

# Running & Deploying

## Read this first

**What you have is source, not a runnable project.** There's no `android/`,
`ios/`, Metro config, or native Firebase config. Step 1 creates that scaffolding
and drops these files into it.

**Nothing here has run on a device.** The engine, stats, invites, and scoring
modes are covered by 140 passing tests. The screens have been parsed and their
imports resolved, but never rendered. Expect layout adjustments on first run.

---

## 1. Scaffold the project

Expo with a **dev build** — not Expo Go. Expo Go can't load `@react-native-firebase`
native modules, and the walk-up audio feature will need background audio and local
file caching later. Starting here avoids a build-system migration mid-project.

```bash
npx create-expo-app@latest ridgeview --template blank
cd ridgeview
```

Copy in from this bundle:

```
App.jsx  app.json  package.json  firebase.json  firestore.rules
storage.rules  firestore.indexes.json
src/  functions/  tests/  prototype/  build-prototype.js
```

Delete the template's `App.js` so `App.jsx` is the entry point.

```bash
npm install
npx expo install expo-dev-client expo-build-properties expo-font
```

## 2. Fonts

Download [Archivo](https://fonts.google.com/specimen/Archivo) and
[Public Sans](https://fonts.google.com/specimen/Public+Sans), put the six `.ttf`
files named in `app.json` into `assets/fonts/`. Without these, `theme.js` falls
back to system fonts and the scoreboard numerals lose their character.

## 3. Firebase project

In the console:

1. Create a project.
2. **Build → Firestore Database** → Create, production mode, pick a region close
   to your leagues. *Region is permanent.*
3. **Build → Authentication** → enable Email/Password.
4. **Build → Storage** → Create.
5. Upgrade to **Blaze**. Cloud Functions require it. Free-tier quotas still apply,
   so a single team's usage should cost near nothing — but set a budget alert.
6. Add an **iOS app** (bundle `app.ridgeview.mobile`) → download
   `GoogleService-Info.plist` into the project root.
7. Add an **Android app** (package `app.ridgeview.mobile`) → download
   `google-services.json` into the project root.

Both files are gitignored by default in Expo templates — verify, they contain
project identifiers you don't want public.

## 4. Deploy backend

```bash
npm i -g firebase-tools
firebase login
firebase use --add          # select your project
```

Deploy in this order. Rules first means the database is never briefly open:

```bash
firebase deploy --only firestore:rules,storage:rules
firebase deploy --only firestore:indexes
firebase deploy --only functions
```

Indexes take a few minutes to build. Queries against them fail until they're
ready, and the error message includes a direct link to create any you missed.

> **The functions deploy has a trap, already handled.** `functions/index.js`
> imports the engine, which lives outside `functions/`. The Firebase CLI zips
> *only* that directory, so the import would resolve locally and crash in
> production. `functions/build-shared.js` vendors the shared modules into
> `functions/shared/` and is wired to `predeploy` in `firebase.json`, so it runs
> automatically. If you ever see `ERR_MODULE_NOT_FOUND` in function logs, that
> hook didn't run.

## 5. Run locally against emulators

Terminal 1:

```bash
firebase emulators:start
```

Terminal 2:

```bash
npx expo run:ios      # or: npx expo run:android
```

`connectEmulators()` in `App.jsx` fires only when `__DEV__` is true. Android
emulators reach the host at `10.0.2.2`, iOS simulators at `localhost` — that's
handled in `firebase.js`, but getting it wrong produces a silent hang rather than
an error, so it's worth knowing.

## 6. Run the rules tests — do this before trusting anything

**These have never been executed.** The emulator jar downloads from a host that
was outside the network allowlist where this code was written.

```bash
npm i -D @firebase/rules-unit-testing vitest
firebase emulators:exec --only firestore "npx vitest run tests/rules"
```

Expect failures on the first pass. Rules are fiddly and a suite that passes
immediately usually means the tests are wrong. The assertions cover the failures
that would be quietly catastrophic: a parent reading another family's child, a
coach without the baton writing to the event log, a fan gaining guardian
authority.

## 7. Seed enough data to see a screen

`GameDayScreen` expects `route.params` with `teamId`, `gameId`, `team`, `roster`,
`rules`, and `config`. Nothing creates those yet — the sign-in and roster screens
are stubs. Fastest path is the Emulator UI at `localhost:4000`: create a team doc,
a members doc for your UID with `role: "owner"`, a few players, and a game with
`scorekeeperUid` set to your UID.

Without that last field you'll render in spectator mode and wonder why the
buttons are missing.

---

## Verification order

Work down this list. Each step depends on the one above it.

1. `npm test` → 140 passing. Confirms the engine survived the copy.
2. Rules tests against the emulator. **The highest-value unrun check.**
3. App builds and launches on a simulator.
4. Fonts render — if the scoreboard looks generic, `expo-font` didn't link.
5. Score a full half-inning. Verify the diamond, count, and stat line update.
6. **Airplane mode, score an inning, force-quit, reopen.** This is the one that
   matters most — it's the whole reason for the `@react-native-firebase` switch,
   and it's never been proven.
7. Deploy functions, then test `createPlayerInvites` from the console.
8. Open an invite link on a real device to confirm the deep link and that the
   URL fragment survives.

## Known rough edges

- Sign in, sign up, schedule, roster, and messages are **placeholder stubs**.
- No screen creates a team or game yet; seed by hand for now.
- `expo-haptics` needs the dev build — it's a no-op in Expo Go.
- Deep links need domain verification (`apple-app-site-association` and
  `assetlinks.json` on `ridgeview.app`) before `https://` links open the app.
  The `ridgeview://` scheme works immediately for testing.
- Real device push requires an APNs key uploaded to Firebase for iOS.

## Cost note

Firestore charges per document read. The event-log-as-subcollection design keeps
this sane — each spectator receives one small doc per play instead of the whole
log. A 400-play game with 30 watchers is roughly 12,000 reads, well inside the
free daily quota. Had the log stayed an array field, the same game would have
been closer to 2.4 million.

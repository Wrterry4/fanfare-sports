# Setup & Wiring

```
src/services/firebase.js       Init, offline persistence, emulator wiring
src/services/authService.js    Accounts + push token lifecycle
src/navigation/linking.js      Deep links, notification routing, pending invites
firebase.json                  Emulator + deploy config
firestore.indexes.json         6 composite indexes
tests/rules/                   Rules suite — NOT YET RUN (see below)
```

## Correction: the SDK choice was wrong

`gameService.js` was originally written against the Firebase **JS SDK**
(`firebase/firestore`). That's now switched to **`@react-native-firebase`**, and the
reason is load-bearing rather than stylistic.

The JS SDK's offline persistence is backed by IndexedDB, which does not exist in
React Native. You get an in-memory cache that dies with the process. A scorekeeper
who loses signal in the third inning, backgrounds the app, and comes back would lose
every unsynced event.

Offline durability is the hardest constraint in this product — the entire scoring
model assumes writes queue locally and flush later. `@react-native-firebase` wraps
the native SDKs, which persist the write queue to disk across restarts, and gives
real background FCM delivery that the on-deck alert depends on.

The modular API is nearly identical, so the service layer barely changed.

## The fragment problem

The invite secret lives in the URL fragment specifically so it stays out of server
access logs and referrer headers. But React Navigation's path parser **discards
fragments** — the standard `linking.config` route map can't see it.

`linking.js` intercepts the raw URL first, pulls the token out, persists it, and
hands React Navigation a clean `/join/:inviteId` path. The token never enters
navigation state, which gets serialized into crash reports.

## Pending invites survive the auth detour

A parent tapping an invite almost never has an account. The invite is persisted to
AsyncStorage rather than held in memory, because the app frequently gets killed
mid-signup — that's what happens when someone leaves to check email for a
verification code. `resolvePendingInvite()` closes the loop once auth resolves.

## Push permission timing

`requestPushAtTheRightMoment()` deliberately does not fire at launch. A cold
"Allow notifications?" on first open gets denied, and on iOS that denial is close to
permanent — the user has to visit Settings to undo it. The ask happens right after
someone joins a team, on the screen that just told them they'll be alerted when
their kid is up.

## Running the rules tests

**These have not been run.** The emulator jar downloads from
`storage.googleapis.com`, which was outside the network allowlist where these files
were written. Everything in `tests/*.test.js` is verified and passing; the rules are
careful but unproven.

```bash
npm i -D @firebase/rules-unit-testing firebase-tools vitest
npx firebase emulators:exec --only firestore "npx vitest run tests/rules"
```

The suite asserts the failures that would be quietly catastrophic:

- a parent reading another family's child, or their season stats
- a coach without the baton appending to the event log
- events being edited or deleted after the fact
- a fan gaining chat access or guardian authority
- career code and invite documents being readable at all
- a member promoting themselves, or a coach minting an owner
- transfers being approved client-side

Expect some to fail on first run. Rules are fiddly, and a test suite that passes
immediately usually means the tests are wrong.

## Still open

- `App.tsx` root, navigation container, auth gate
- Screen components (the prototype is the layout reference, not RN code)
- Storage rules for walk-up audio uploads
- `functions/package.json` with Node 20 + ESM

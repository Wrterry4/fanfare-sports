# Notifications and linking: what to check

Both symptoms probably share one cause — **your functions deploy never
succeeded.** `assignGuardian` is a Cloud Function, and so is every notification
sender. If they aren't deployed, linking errors and nothing ever sends.

## Do this first

```bash
npm install --prefix functions
firebase deploy --only functions
firebase functions:list
```

`functions:list` should show: `assignGuardian`, `createTeam`, `finalizeGame`,
`notifyDirectMessage`, `notifyGameStatus`, `notifyScoringPlay`,
`notifyTeamMessage`, `propagateDisplayName`, `propagatePlayerName`,
`requestPlayerClaim`, `resolvePlayerClaim`, `sendTestNotification`,
`syncPlayerAccess`, and the invite functions.

If that list is empty or short, nothing server-side is running and both
symptoms are explained.

## Then: is the VAPID key set?

```bash
grep VAPID .env
```

If the value is empty, push cannot register — permission is granted, `getToken`
fails, and nothing ever arrives. That is exactly "the prompt fires but no
notifications come through."

Firebase Console → Project settings → **Cloud Messaging** → Web Push
certificates → Generate key pair. Put it in `.env`, then rebuild — it's compiled
into the bundle, so a redeploy of hosting is required.

## What changed here

**Errors now say what's wrong.** Every callable goes through
`src/services/callable.js`, which recognises an undeployed function and says so,
with the commands to fix it. Linking will now tell you the real problem instead
of "an internal error occurred".

**`registerDevice` returns a reason** instead of throwing. A missing VAPID key
used to reject into nowhere, which is why the button appeared to do nothing.
The panel now names it: not installed, blocked, no VAPID key, or unsupported.

**"Send a test" button** in Settings → Notifications. It pushes to your own
devices and reports which link in the chain broke — no registered device, a
rejected token, or success. Four independent things have to work (VAPID key,
service worker, token storage, fan-out) and silence doesn't say which failed.

**Service worker updates properly.** It now calls `skipWaiting()` and
`clients.claim()`. Without those a deployed update sits in "waiting" until every
tab closes — on an installed PWA that can be days — while the old worker keeps
handling background pushes.

**Token registration targets the right worker.** `getToken` is now given the
registration for `/firebase-messaging-sw.js` explicitly; left to itself the FCM
SDK will register its own worker at a different scope and then listen on the
wrong one.

## iOS specifics

- Only an **installed** PWA receives push. Safari in a tab never will.
- iOS 16.4 or later.
- After adding to the home screen, open it from there and grant permission
  inside that window — permission granted in a Safari tab does not carry over.
- Delivery can lag by a few seconds when the device is idle. That's normal.

## Order to test in

1. `firebase functions:list` — confirm they exist
2. `grep VAPID .env` — confirm a key is set
3. Rebuild and redeploy hosting
4. On the installed iPhone app: Settings → Notifications → Turn on
5. **Send a test** — if this fails, it says why
6. Only then try a direct message or ending a game

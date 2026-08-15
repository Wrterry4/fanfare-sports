# Phase 5 — notifications

## Before this works: two setup steps

**1. Generate a VAPID key.** `EXPO_PUBLIC_FIREBASE_VAPID_KEY` in `.env` is
still empty, and without it `getToken()` fails and no device ever registers.

Firebase Console → Project settings → **Cloud Messaging** → Web configuration →
Web Push certificates → Generate key pair. Paste the key into `.env`.

**2. Deploy indexes and functions.**

```bash
firebase deploy --only firestore:indexes
firebase deploy --only functions
```

Indexes take a few minutes to build; the claim queries fail until they're ready.

## Who gets what

| | Who |
|---|---|
| Team chat | every member with it on, **minus fans** and the sender |
| Announcements | same |
| Direct message | the other participant, nobody else |
| Game start / final | every member of the team |
| Hits, walks, RBIs | only people linked to **that player** — their parents and grandparents |
| Player is up | same |

Fans are excluded from chat notifications because the rules exclude them from
chat entirely — notifying them would open something they can't read.

## The problem worth explaining

A hit notification needs to say *who* got the hit. But the event documents
don't record that: the scorekeeper taps "Single" and the engine derives the
batter from game state, so the payload is empty.

Rather than change the client to stamp a batter onto every event, the function
**replays the log with the same engine the app uses**. That gives the batter and
the exact RBI count, and it can't drift from what the app shows because it's
the same code. Only hits and walks reach that path, so it runs about eighty
times a game rather than on every pitch — and it's bounded to events at or
before the one that triggered it, so a fast scorekeeper can't make it attribute
the wrong play.

## Preferences

On the Settings tab, stored per member — so a coach on one team and a parent on
another don't get coach-volume alerts for both. An absent preference counts as
on; only an explicit false is a mute.

## Permission timing

Requested from the notification settings section, not at launch. A cold "Allow
notifications?" on first open gets denied, and on iOS that denial is close to
permanent — the person has to visit Settings to undo it. Asking on the screen
that explains what the alerts are is both better converting and the honest
moment.

On iPhone the panel says to add the app to the home screen first, because
Safari in a tab cannot receive push at all.

## Tokens repair themselves

FCM rotates tokens, and a reinstall issues a new one. `AuthProvider` silently
re-registers on launch whenever permission is already granted — without that,
notifications quietly stop working and nobody knows why. Dead tokens are pruned
from the user document on every send.

## Not tested

None of this has been exercised against real devices. The delivery path — VAPID
key, service worker registration, token storage, fan-out — is the part most
likely to have a problem that only shows up on hardware. Test on one Android
phone and one installed iPhone before relying on it at a game.

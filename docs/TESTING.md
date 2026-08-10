# Ready-for-testing state

150 tests passing. Every screen builds and resolves. Nothing below has been
rendered on a phone.

## What works on Spark (no Blaze, no Cloud Functions)

| | |
|---|---|
| Sign up / sign in / password reset | ✓ |
| Create team, choose rule preset | ✓ |
| Roster: add, **edit, remove**, repeatable entry | ✓ |
| **Lineup**: batting order, sit players, per game | ✓ |
| Schedule: date, time, park, field, notes; edit; repeatable | ✓ |
| Start / end a game | ✓ |
| Live scoring, full or casual mode | ✓ |
| Live stats, play-by-play | ✓ |
| **Viewer mode** + request/pass the book | ✓ |
| **Multiple people on a team** (join code) | ✓ |
| **Team chat + direct messages** | ✓ |
| **League settings**, editable | ✓ |
| Offline scoring (IndexedDB queue) | ✓ |
| Installable PWA, iOS standalone | ✓ |

## What still needs Blaze

- **Parent invite links that link a specific child.** The join code grants
  membership, not guardianship — deliberately, since guardianship should never
  be self-granted. A coach links a parent to their player manually for now.
- **Career codes / cross-season history.** Minting a code client-side would
  mean storing a hash the client can also read, defeating the point.
- **Season and career stat rollups.** In-game stats are complete and live;
  they just aren't aggregated across games yet.
- **Push notifications.** The service worker is deployed and registered, but
  nothing sends.
- **Cloud Storage** for walk-up audio.

## Getting a second person on the team

Settings → Invite people. Text the link. They sign up, pick a role, and land in
the app. This is what makes the baton, DMs, and team chat real rather than
theoretical — it's the biggest addition in this pass.

A parent who joins sees the schedule, live games, and chat. They see a player's
stats only after a coach links them to that child.

## Before a real game

1. **Score a full inning at home, then repeat with the network off**
   (DevTools → Network → Offline). Reload. Nothing should be lost.
2. Add the app to your home screen and confirm no Safari chrome.
3. Have a second person join with the code and confirm they see the live game.
4. Pass the book between two devices mid-inning.
5. Check the pitch count warning fires at your league's limit.

## Known rough edges

- Fonts are not installed, so Archivo/Public Sans fall back to system faces.
  Drop the six `.ttf` files into `assets/fonts/` and restore the `expo-font`
  plugin entry in `app.json`.
- Date and time entry is free text (`4/12`, `5:30 PM`) rather than a picker.
  Faster for entering a season from a league sheet; less discoverable.
- One team per account in the UI. The data model supports several; the switcher
  isn't built.
- `firestore.rules.dev` is deployed, not `firestore.rules`. The banner at the
  top of that file lists the four steps to switch before real families join.

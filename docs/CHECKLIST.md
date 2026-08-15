# Your list — every item, and where it landed

| # | Item | Phase |
|---|---|---|
| 1 | Editing a player: insufficient permissions | 1 |
| 2 | Full words on Game Day buttons | 4 |
| 3 | Pitch count not counting; pitches counted as balls | 1 |
| 4 | Pause button for walk-up audio | 1 |
| 5 | More audio file types accepted | 1 |
| 6 | Games starting automatically | 1 |
| 7 | Past games: full inning report | 4 |
| 8 | W or L before the score | 4 |
| 9 | Lineup: past-games sub-tab | 4 |
| 10 | Drag and drop to reorder | 4 |
| 11 | "Requested" reverting to "Request book" | 1 |
| 12 | Create an account from the join page | 3 |
| 13 | Inning grid right, team names left | 2 |
| 14 | Opposing team numbered 1–9 | 4 |
| 15 | Copy button with an invite message | 3 |
| 16 | Finished games not editable | 4 |
| 17 | Names in Settings and chat, with role | 3 |
| 18 | Grandparents restricted to Game Day and Schedule | 3 |
| 19 | Hamburger menu for account and team switching | 2 |
| 20 | **Player names showing as jumbled characters** | **6 — see below** |
| 21 | Team name and season on every tab | 2 |
| 22 | Bottom nav cut off; dead strip above it | 1 |
| 23 | Same header height on every tab | 2 |
| 24 | DM name centred on the back row | 2 |
| 25 | Notifications | 5 |
| 26 | Claim a kid | 3 |

## Item 20 needed a second pass

Phase 3 fixed a cause, not *the* cause.

`useGameDay` built the roster by reading `/players/{id}` for every player. A
parent can only read that document for **their own child** — every other row
came back null and was dropped. The roster was nearly empty, so the scoreboard
fell back to raw Firestore document ids. Those were the jumbled characters.

The fix follows what the data model was always for: **names are not the
protected thing, statistics are.** A first name and a jersey number are printed
on the back of a shirt and written in every scorebook. Birth year, guardians,
and every statistic are what actually need gating.

So first and last name are now denormalized onto the roster document, which
every team member can read — fans included, because a grandparent watching
live would otherwise see a dash for every child but their own. `/players` and
its stats subcollections stay restricted to `authorizedUserIds`.

Two things keep the copies honest:

- `propagatePlayerName`, a trigger that updates every roster reference when a
  player's name changes
- a self-healing read: anyone who *can* read `/players` fills in a missing
  roster name as they load, so existing teams repair themselves instead of
  needing a migration

## Still outstanding

**Nothing from your list.** What remains is verification, not features:

1. Generate the VAPID key — notifications cannot register without it
2. Test push on one Android phone and one **installed** iPhone
3. Run the rules suite against the emulator — still never executed
4. Score a full inning offline, force-quit, reopen, confirm nothing is lost
5. Swap `firestore.rules.dev` for `firestore.rules` before real families join.
   The banner at the top of the dev file lists the four steps.

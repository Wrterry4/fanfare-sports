# Document ids

Firestore hands out 20 random characters by default. That default is correct
for a write-heavy app with thousands of offline clients — random ids can't
collide and don't hot-spot a storage range — and it is the wrong trade for a
team app writing one game a week, where every debugging session starts by
pasting `k3Jd8sPqR2xN1vB7` into the console to find out what it is.

Helpers live in `src/shared/docIds.js`, with tests in `tests/docIds.test.js`.

## Which kind of id

| Kind | When | Example |
| --- | --- | --- |
| **Derived** | The document has one natural identity | `2026-08-22-vs-hurricanes` |
| **Prefixed random** | No natural key, but the id should say what it is | `poll-4f2a91` |
| **Auto-id** | High-volume append-only streams | chat messages, game events |

A derived id buys more than legibility: writing the same game twice becomes a
no-op instead of a second document. Where that property is wrong — a coach
genuinely scheduling a doubleheader — `uniqueId()` appends `-2`.

## Never put a person in an id

Ids show up in logs, error messages, browser history, and every screenshot of
a console. A roster does not belong in any of those. Derive ids from dates,
opponents and types — never from a child's name. `players/` keeps auto-ids for
exactly this reason.

## What Firestore rejects

`/`, an id of `.` or `..`, anything matching `__.*__`, and anything over 1500
bytes. `slug()` removes all of them by construction, so an id built from the
helpers is always legal.

## Current state

| Collection | Id | Notes |
| --- | --- | --- |
| `teams/{teamId}` | auto | Existing teams; a name is not unique across seasons |
| `teams/*/games/{eventId}` | **derived** | `2026-08-22-vs-hurricanes`, `2026-09-01-team-photos` |
| `teams/*/roster/{playerId}` | player id | The roster entry IS the player, by design |
| `teams/*/members/{uid}` | uid | Natural key |
| `players/{playerId}` | auto | Deliberate — see "never put a person in an id" |
| `users/*/teamInvites/{id}` | **derived** | `{teamId}__{playerId}`, so re-inviting overwrites |
| `invites/{inviteId}` | auto | Paired with a secret token; must not be guessable |
| `teams/*/channels/*/messages/{id}` | auto | High volume, id never spoken aloud |
| `teams/*/games/*/events/{id}` | auto | Same |

Documents created before this convention keep their random ids. Nothing
migrates: an id is a name, and renaming a document means rewriting every
reference to it.

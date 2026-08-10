# Firestore Layer

```
firestore.rules              Security rules — roles, stat privacy, the baton
src/services/gameService.js  Client read/write path for live scoring
functions/index.js           Privileged operations (Cloud Functions, ESM)
tests/finalize.test.js       Finalize math, verified without Firebase
```

## Three decisions that shaped this

**Roles are per-team.** `/teams/{id}/members/{uid}` holds the role, never the user
document. A coach on one team is a parent on another; a global `isCoach` flag breaks
the moment anyone belongs to two teams.

**Stats are separate documents.** Firestore rules are all-or-nothing per document —
there is no field-level read filtering. "Parents see only their own kid" is only
enforceable if each player's stats live in their own doc under `/players/{id}/seasons/`.
This is why the data model moved players to the root.

**Sequence numbers are assigned locally, not by transaction.** Firestore transactions
need connectivity, and ballpark dead zones are exactly where they'd fail. The baton
guarantees a single writer, so a local monotonic counter is safe — writes queue offline
and flush when signal returns. A transaction here would have made the app unusable at
half the fields it's meant for.

## The baton

Four update paths, each gated separately in the rules:

| Action | Who | Fields touched |
|---|---|---|
| Score the game | current holder | game state |
| Request the book | any coach/scorekeeper | `batonRequestedBy` only |
| Approve handoff | current holder | `scorekeeperUid` + `batonRequestedBy` |
| Reclaim | team owner | adds `batonSeizedAt` |

Requesting is not taking. The reclaim path exists because the alternative — a dead
phone holding the book with no way to get it back — leaves the game unscoreable.

## `authorizedUserIds`

Denormalized onto each player by `syncPlayerAccess`: guardians, plus staff of every
team the player is currently rostered on. Without it, "can this coach read this player"
would require an unbounded search across teams inside a rule. With it, the read rule is
one array membership check.

## Career codes

- Stored as a SHA-256 hash. The plaintext is shown to the coach exactly once.
- Alphabet excludes O/0 and I/1/L — these get read aloud across a parking lot.
- `/careerCodes/**` denies all client access. Only `claimPlayer` resolves them.
- A valid code produces a **pending transfer**, not a link. A guardian approves.
- Failure is deliberately vague, so the endpoint isn't an oracle for probing codes.

## Opponent modeling

You track your own roster. The other dugout is `opp_1`…`opp_9` placeholder slots —
nobody enters the opposing team's nine names, and their stats aren't yours to keep.
The engine needs a batting order on both sides to advance the game; placeholders are
filtered out before anything is written. `buildGameConfig()` in `functions/index.js`
is the single place this is decided, and the test mirrors it.

## Not verified

The rules file has not been run against the Firestore emulator — the emulator jars
download from a host outside this environment's network allowlist. Everything in
`tests/` is real and passing; the rules are careful but unproven. Run
`firebase emulators:exec --only firestore` with a rules test suite before trusting
them in production.

## Still open

- Rules unit tests (`@firebase/rules-unit-testing`)
- `joinTeam` function for the parent invite-code flow
- Debounce policy for `syncGameSummary` — currently every event would write
- Notification prefs UI defaults

---

# Onboarding

```
src/shared/inviteRules.js     Pure validation + role capabilities (shared)
functions/invites.js          createPlayerInvites, redeemInvite, invitePipeline
src/services/inviteService.js Client wrappers + share-sheet plumbing
tests/invites.test.js         36 assertions
```

## The role we were missing: `fan`

A grandparent needs the on-deck alert and her grandson's line. She must not be able
to approve a roster transfer or consent to media on someone else's child. Guardian
and follower are different things, and collapsing them was a latent bug in the model.

| | score | roster | approve transfers | team chat | all players' stats |
|---|---|---|---|---|---|
| owner / coach | ✓ | ✓ | | ✓ | ✓ |
| scorekeeper | ✓ | | | ✓ | |
| parent | | | ✓ | ✓ | own kid |
| fan | | | | | own kid |

Fans are excluded from channels and DMs at the rules level, not in the UI.

## Three invite shapes

**Player** — one link per kid, single use, 30 days. The coach already knows which
phone number belongs to which family, so *sending the link is the assertion*. No
approval step, which is what makes fifteen families tractable. Single-use means a
forwarded text is dead on arrival.

**Fan** — a guardian invites family to follow their own kid. Multi-use, capped at 10.
Links for notifications and stat visibility; confers no guardianship.

**Team** — general purpose, multi-use: assistant coach, team parent, scorekeeper.
No player link. Only an owner can mint a coach invite.

## Security details worth keeping

- The secret rides in the URL **fragment**, so it never reaches a server access log,
  a referrer header, or an analytics pageview.
- Tokens are stored as SHA-256. `/invites/**` denies all client access.
- The token is compared **before** expiry, revocation, or use count — otherwise the
  error message becomes an oracle for which invite ids are real. There's a test for
  exactly this.
- `previewInvite` is unauthenticated by design and returns a **first name only**.
  Whoever holds the link was texted it by the coach; a first name is the minimum
  needed to confirm it's the right child.
- Redemption is one transaction: membership, player link, guardianship, and the use
  counter. A partial success would leave a parent on a team with no kid attached.

## Two product calls embedded here

**Preview before sign-up.** `previewInvite` works unauthenticated so a parent sees
"You'll be added as Jack's parent" before any account form. A sign-up wall in front
of unexplained value is where onboarding funnels die.

**Notification defaults are conservative.** `allScoringPlays` is off for everyone.
Parents and fans get the on-deck and result alerts — that's the reason they installed
the app — and nothing else. Fatigue kills this feature by week two.

## Still open

- `firebase.js` (config/init) — stubbed by the imports, not written
- Auth screens and the deep-link handler that routes `/join/:id`
- Rules unit tests against the emulator

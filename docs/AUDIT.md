# Audit — issues found and fixed

Six real problems. One contradicts something stated in an earlier README.

## 1. Runs on steals and wild pitches were charged as unearned

`gameEngine.js` credited runs with `earned: type === EV.BALK`, so a run scoring
on a stolen base, wild pitch, or passed ball was marked unearned. None of those
is an error — all four are earned under the scoring rules. The effect was a
silently understated ERA for every pitcher.

The same block also contained a dead ternary that assigned a value to itself.

Fixed, with 10 new assertions covering all four event types plus the genuine
exception (runs after an error in the same half-inning stay unearned).

## 2. Every spectator device attempted writes it wasn't allowed to make

`useGame` scheduled a game-doc summary write on each event, for **every**
subscriber. The rules correctly reject writes from anyone without the baton —
which means thirty phones at a game producing a steady stream of
permission-denied errors and retries.

Now gated on `canScore`. The listener is read-only for everyone not scoring.

## 3. Two auth listeners → the same invite redeemed twice

`useAuth` was a plain hook called by both `RootNavigator` and `JoinScreen`. Two
instances meant two auth listeners, two FCM token watchers, and — because the
"already handled" guard was a ref local to each instance — two attempts to redeem
the same pending invite.

Player invites are **single-use**. The second attempt would burn the link and
could show a parent an "already used" error on the account they just created,
on the single path that most needs to work.

Replaced with `AuthProvider`; `useAuth()` now reads context.

## 4. Invite redemption would have thrown on navigate

`PendingInviteHandler` called `useNavigation()` from a component rendered as a
**sibling** of the navigator. `useNavigation` reads `NavigationContext`, which
only screens provide — so this would have thrown "Couldn't find a navigation
object" the first time a parent completed a redemption.

Now uses a container ref (`navigationRef`), the supported way to navigate from
outside the tree.

## 5. `buildGameConfig` was duplicated — contradicting an earlier claim

README-firestore.md stated: *"`buildGameConfig()` in `functions/index.js` is the
single place this is decided, and the test mirrors it."* Mirroring is duplication.
It existed in `functions/index.js` and again, hand-copied, in
`tests/finalize.test.js` — and not at all on the client, which needs it to build
live state.

Moved to `src/shared/gameConfig.js`. All three consumers now import the same
module, which is what the shared layer was for.

## 6. `"type": "module"` at the app root is a React Native hazard

Set for the Node test runner, but the app root package.json is read by Metro and
RN tooling. Scoped it to `src/` and `tests/` instead; the root is now the RN
default. `build-prototype.js` became `.mjs` as a consequence.

---

## Checked and found correct

- Force-advance on walks with bases loaded, including the run
- Run-cap and mercy boundaries, including "the trailing team must bat"
- Sequence numbers assigned locally, not by transaction (offline-safe)
- Events immutable; corrections void and replay
- Career codes stored hashed, resolved only inside a function
- Invite token compared before expiry/revocation/use-count
- URL secret in the fragment, not the path
- Stats as separate documents (the only way the privacy rule is enforceable)
- Opponent placeholders filtered before any write

## Still unverified

- **The rules file has never run against the emulator.** Highest-value gap.
- Nothing rendered on a device.
- `gameService.js` never exercised against a real `@react-native-firebase` install.

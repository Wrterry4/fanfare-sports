# App Shell

```
App.jsx                          Root: providers, linking, emulator wiring
src/navigation/RootNavigator.jsx Auth gate + bottom tabs
src/hooks/useAuth.js             Session + pending-invite handoff
src/hooks/useGame.js             Live game subscription, debounced summary
src/theme.js                     Design tokens
src/components/                  Diamond, Scoreboard, ActionPads, BatterBar,
                                 BatonBar, RunnerSheet
src/screens/GameDayScreen.jsx    Live scoring
src/screens/JoinScreen.jsx       Parent onboarding (works signed out)
storage.rules                    Walk-up audio + media buckets
```

**140 tests passing.** All JSX parses and every internal import resolves
(`esbuild --bundle` catches missing files and bad export names, which plain
syntax checking does not). Nothing here has been rendered on a device.

## Casual mode

Someone has to tap 300–400 times per game while trying to watch their own kid.
That person burns out around week four. Casual mode logs plate-appearance
outcomes and skips pitch-by-pitch.

**Correction to an earlier estimate.** I said this cuts taps by ~70%. The real
number is **40%**, and the arithmetic is in `tests/scoringModes.test.js`:

| | pitches | outcomes | total |
|---|---|---|---|
| Full | 304 | 80 | **384** |
| Casual | 152 | 80 | **232** |

Dropping pitch entry outright would be 79%, but two things stay: outcome taps
are unchanged, and pitch entry remains active while *your own* pitcher works,
because rest-day limits depend on an accurate count and nothing can reconstruct
it after the fact. 40% is still the difference between a chore and a burden,
but it's the honest figure and the one that should appear in the UI.

Per-game, not per-team, and changeable mid-game — a tired scorekeeper should be
able to downshift in the fourth rather than abandon the book.

**The engine needed no changes.** Casual mode is purely which buttons render;
the event log keeps the same shape and `computeStats` doesn't care whether the
pitches leading to a strikeout were logged individually. There's a test
asserting identical AVG, SLG, RBI, and score from both logging styles.

## Layout decisions carried from the prototype

- **Pitch buttons at 56pt, lowest on screen.** Apple's minimum is 44 and
  Android's is 48; neither anticipated one-handed use while watching a fly ball.
- **STRIKE is inverted** so it's findable without reading.
- **Light ground.** In direct sun, dark-on-light beats the reverse once glare is
  involved. Functional, not aesthetic — and still unverified at an actual 2pm game.
- **Haptics on every tap**, medium for pitches, light for outcomes. Confirmation
  you can feel, so the scorekeeper doesn't look down.
- **Tapping a runner scopes the drawer to that runner.** A stolen base needs to
  know which one, and asking afterward is a second tap during a finished play.

## The Join screen sits outside the auth gate

Deliberate. `previewInvite` is unauthenticated so the screen can say "You'll be
added as Jack's parent" before any account form. A sign-up wall in front of
unexplained value is where onboarding funnels die.

## Still open

- Sign in / sign up / schedule / roster / messages screens are **placeholder
  stubs** so the navigator resolves
- Rules suite still unrun (emulator jar blocked by network allowlist)
- Nothing rendered on a device — layout is inferred from the HTML prototype
- Fonts (Archivo, Public Sans) need linking into the native projects

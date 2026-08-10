# Scoring Engine — v1

Drop this at `/src/engine/` in the React Native project.

```
src/engine/
├── rules.js        League config + presets (t-ball → high school)
├── events.js       Event vocabulary and factory
├── gameEngine.js   Pure reducer: reduce(events, rules, config) -> state
├── stats.js        Derived batting / pitching / fielding
└── export.js       CSV + portable career JSON
tests/
└── engine.test.js  54 assertions, no Firebase, no device
```

Run the tests: `node tests/engine.test.js`

## Why it's built this way

**No Firebase imports anywhere in this folder.** That's the whole point. The same
module runs in three places:

1. **Client, live** — replay the events already in memory for optimistic state.
2. **Cloud Function, finalize** — authoritative recompute, writes season/career stats.
3. **Your laptop** — replay recorded games as tests.

Same shared-logic transpile pattern you used in Among Shadows: one engine, no
divergence between client and server.

**State is never stored, only derived.** `reduce(events)` is the only source of
truth. That's what makes these free:

- Undo → `reduce(events.slice(0, -1))`
- Mid-log correction → `voidEvent(events, seq)` then replay
- Stats → a projection of the same log, so a correction can't desync totals

## Integration points

**Firestore write path.** Append to `/teams/{t}/games/{g}/events/{e}`. The client
listener receives one small doc per event, not the whole log. Feed the accumulated
array into `reduce()`.

**Baton.** Rules gate the write (`request.auth.uid == game.scorekeeperUid`); the
engine doesn't know or care who wrote an event.

**Walk-up audio.** `state._walkUpFor` is set on every `BATTER_UP`. Subscribe, play
the cached clip. This is why `BATTER_UP` is explicit rather than derived — pinch
hitters and skipped slots would otherwise leave the trigger ambiguous.

**Spectator view.** `state.playByPlay` is an array of `{ inning, isTop, text, kind }`
generated as events apply. Pass a `names` map into `reduce()` for real names instead
of IDs.

**Pitch counts.** `state.pitchCounts[playerId]`. On finalize, write an appearance
doc to `/players/{id}/pitchingAppearances/` with `restDaysFor(pitches, rules)` — the
root-level collection is what lets you warn about a kid who threw 60 for another
organization on Thursday.

## Known approximations

- **Earned runs** use the standard simplification: once an error occurs in a
  half-inning, subsequent runs in that half-inning are unearned. True ER requires
  reconstructing the inning as if the error hadn't happened. Fine for youth ball;
  note it in the UI if anyone asks.
- **Fielder's choice** erases the lead runner by default. Pass
  `payload.outAtBase` to override.
- **Default advancement** on hits is uniform (single = everyone +1, double = +2).
  Pass `payload.extraScored` from the advance modal for anything else.

## Not yet wired

Dropped third strike, infield fly, courtesy runner, and `coachPitchAfterStrikes`
are present in the rules object and read by nothing. They're enumerated so the
shape is fixed — implement the branches when you target those divisions.

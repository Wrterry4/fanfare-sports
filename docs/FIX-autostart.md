# Games were starting themselves

## Cause

`syncGameSummary` mirrors the derived score onto the game document so list
views don't have to load an event log. Its payload included:

```js
status: state.status === 'final' ? 'final' : 'live',
```

So the moment a scorekeeper opened Game Day on a **scheduled** game, the
debounced mirror fired four seconds later and wrote `status: 'live'`. The Start
button rendered correctly — and then the background write started the game
behind it.

The screen wasn't wrong. A background sync was making a decision that isn't
its to make.

## Fix

**The mirror no longer writes `status` at all.** Every status transition is now
an explicit act: Start on Game Day or Schedule, End Game, or finalize.

**And it doesn't run for a game that isn't live.** `shouldSyncSummary(game,
state)` gates it — live only, and only once something has actually happened.

Two independent guards, because either alone would have prevented this and the
rule is easy to break again.

## Test

`shouldSyncSummary` lives in `src/shared/gameSummary.js` with no Firebase
import, so it's testable at a desk. `tests/summary.test.js` covers the six
cases and also asserts, by reading the source, that `syncGameSummary` never
sets a status. That last one is blunt but it's the property that actually
matters.

Wired into `npm test`.

## Also

The start gate now shows when the game is, not just where — day, time, park,
field — since it's the screen you look at before a game rather than during one.

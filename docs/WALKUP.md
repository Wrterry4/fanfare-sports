# Walk-up songs

## Where it lives

**Roster tab → ♪ button on each player.** Pick a song, choose where it starts
and how long it plays, preview it. The button turns gold once a song is set.

**Game Day → SOUND ON / SOUND OFF** in the top bar. One toggle for away
tournaments where the other team's parents don't want it.

Playback fires when a new batter comes up — the engine's `BATTER_UP`, which is
why that event was made explicit back when the event vocabulary was designed
rather than derived from the previous outcome.

## The design decision worth knowing

Songs are stored **on the device**, in IndexedDB — not in Cloud Storage.

Cloud Storage needs Blaze, which forced the question. But sitting with it, local
is the better design regardless:

- **Only one device matters.** The scorekeeper's phone is the one plugged into
  the park speaker. Syncing audio to thirty parents' phones so twenty-nine never
  play it is waste.
- **No upload wait.** Pick a song, it's ready.
- **No network at the park.** The classic failure for walk-up audio is a dead
  zone behind the backstop. A local blob can't miss.
- **No storage bill.** Fifteen 20-second clips is ~5 MB that would otherwise be
  egress every game.

**The honest tradeoff:** songs live on the device that set them. A parent can't
choose their kid's song from their own phone yet. The *trim config* (start
point, duration, filename) does sync through Firestore — so when Storage is
available, that config becomes a pointer to the uploaded file and this becomes
a cache rather than the source of truth.

For your test season, the coach's phone holds the songs. That's the same phone
that keeps the book and runs the speaker, so in practice it changes nothing.

## Details

- **Start point, not trim.** The whole file is stored and start/duration are
  just numbers, so moving the drop-in point later doesn't mean re-picking.
- **Fades out** over the last 1.5 seconds. A song cutting dead mid-bar sounds
  like equipment failure at a ballpark.
- **First play of a session may be silent.** Browsers block audio until a user
  gesture. The scorekeeper has tapped dozens of buttons by then, so this only
  bites if audio is the very first interaction.
- Defaults the start point to 25% into the song, since walk-up hooks are
  rarely in the intro.

## Suggestions

**Bluetooth latency.** Park speakers over Bluetooth add 100–200ms. Not enough
to matter for a walk-up, but worth knowing if you ever add sound effects tied to
a specific moment.

**Between-innings music** is the obvious next step and needs no new plumbing —
a team-level playlist keyed to `INNING_END` rather than a player.

**The audio should probably belong to the team, not the device, eventually.**
When you go to Blaze, the natural shape is: parent uploads from their phone,
coach approves, the scorekeeper's device caches on lineup lock. That's the
`lockLineup()` hook that's been sitting unused in `gameService.js` since the
first pass.

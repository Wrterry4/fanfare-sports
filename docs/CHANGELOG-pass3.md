# What changed in this pass

## Done

**Nav bar** — height raised to 78 with 22pt bottom padding so icons clear the
home indicator instead of being clipped. `borderTopWidth: 0` removes the
hairline that content was scrolling under. Game Day icon is now the scorebook
diamond, matching the field on the screen it opens.

**Field labels and strike button** — both were already fixed in the previous
zip; you were seeing a cached Metro bundle. Build with
`npx expo export --platform web --clear` when something looks stale.

**On deck / in the hole** — strip under the action pad showing the next two
batters.

**K button** — hidden whenever pitch buttons are showing. You were right that
it's redundant, and worse: tapping it after two logged strikes silently
backfilled a third pitch that was never thrown. It appears only in
outcome-only mode, where it's the sole way to record a strikeout.

**Line score** — runs by inning, plus R and E, under the scoreboard. The
engine now tracks `lineScore` and `errors`. Column count comes from the rules,
so changing "innings per game" in Settings is visible immediately. Extra
innings widen the strip rather than truncating.

**Games no longer auto-start** — created as `scheduled`. Game Day shows a start
gate; Schedule has a Start button. Both write the same `status` field, so
either one starts the game and both reflect it. `actualStartAt` is recorded.

**Settings limits are steppers** with real bounds: innings 1–9, run cap and
mercy up to 20, pitches 30–150 in steps of 5, time limit 60–180 shown as
"1h 45m". A free-text field could produce a 60-inning game; a stepper can't.

**Reactive rules** — stealing off greys out Stolen Base and Caught Stealing in
the runner drawer with an explanation, rather than allowing an event the
league doesn't have.

**Age divisions** — eleven presets now, researched against published rule sets
(USSSA-style tournament rules, Five Tool, 6-4-3, Baseball For All, rec league
docs): T-Ball 4-5U and 6U, Coach Pitch and 8U, 9U through 14U, High School.
Patterns that held across sources: 5 runs per half inning uncapped in the
final, mercy tightening 15-after-3 / 10-after-4 / 8-after-5, over 35 pitches
means a rest day, and time limits of ~1:10 at 6U rising to ~1:55 at 14U.

**Reverse batting order each inning** — a real t-ball rule, now in the engine
and on by default for both t-ball presets. Tested.

**Roster tab** reads "Roster" without the count.

## Not done in this pass

Being explicit rather than leaving you to discover these:

- **Add/Done toggle and inline row expansion for editing.** The forms still sit
  at the top and stay open permanently. Your instinct is right — editing
  should expand the row you tapped.
- **Calendar picker for game dates.** Still free text (`4/12`, `5:30 PM`).
- **Per-game lineup selector.** Lineups already save per game, but there's no
  picker to choose which game, and past games aren't locked read-only.
- **Past-game detail view** with final line score, R/H/E and start time.
- **Hits column** in the line score — the engine tracks hits per player but
  doesn't aggregate a team total per game yet.

These are all UI work on top of data that already exists, which is why I'd
rather hand you a verified partial pass than an unverified complete one.

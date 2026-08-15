# Phase 2 — app shell

## One header, every tab

`AppHeader` replaces five hand-rolled headers. Fixed height (58), so switching
tabs no longer shifts the content underneath.

Layout is always the same: hamburger left, team name and season next to it,
one action button right. The tab's own name isn't repeated — the bottom bar
already says where you are, and repeating it cost the space the team name
needed.

Screen-level sub-tabs (Roster/Lineup, Team chat/Direct) sit in a separate row
below, which is what keeps the main bar's height constant whether a screen has
them or not.

Game Day keeps the header through its loading, error, and empty states too, so
the team name never blinks out.

## Hamburger → account menu

Slides from the left, where the button is. Holds what belongs to *you* rather
than to the team:

- Name and phone, editable, saved to your user document
- Email shown read-only — changing it forces a re-authentication, so it needs
  its own flow rather than being a text field that fails on save
- **Team switcher** — every team you're on, with the current one marked
- Sign out (moved here from the Settings tab, where it sat oddly next to the
  league rules)

## Multiple teams actually work now

Every screen previously called `useTeams()` and took `teams[0]`, so a parent
with kids on two teams could only ever see one. There's now an `ActiveTeam`
provider: one selection, persisted across launches, changed from the menu.

## Direct messages

The other person's name is centred on the back-button row. It's positioned
against the bar rather than the gap between buttons, so a long name still
reads as centred.

## Line score

Team names are now a fixed left column and the inning grid scrolls on the
right, right-justified. Names get the room they need without squeezing the
innings, and a short grid sits against the right edge instead of stranded mid-
bar. Both columns declare explicit row heights — they're separate views, so
they'd otherwise drift apart as font metrics changed.

# Phase A — layout

## Tab order

Schedule · Roster · **Game Day** · Messages · Settings

Game Day is in the middle deliberately: it's the most-used tab and the centre
is the easiest one-handed reach. The rest read left to right in the order a
season actually happens — schedule it, roster it, play it, talk about it. It's
also still the tab that opens on launch.

## Every header is the same height now

The regression was mine. Sub-tabs (Roster/Lineup, Team chat/Direct) were
rendering *inside* the navy bar, so those two screens had a taller header than
the rest.

They're a page-level segmented control now, below the header, on the light
background. The navy bar is exactly 58pt on every tab.

## Division removed from the header

The header shows team name and season. The division — 10U, Coach Pitch — is a
league setting, not an identity, and it belongs on the Settings tab rather than
on every screen.

## Game situation moved into the top bar

Inning, count, and outs now sit right-justified in the header's right slot on
Game Day. That removes the separate scoreboard bar entirely.

Sound and scoring mode moved down onto the line score strip. They're settings,
glanced at rarely, and they were occupying a full row on a screen where nothing
scrolls.

Net effect: Game Day went from four stacked bars to two.

---

# Phase B — next

Events and RSVP, together, because they touch the same documents:

- **Event types**: game, practice, misc. Adding `type` to the existing game
  document rather than a new collection, so nothing needs migrating and every
  existing row is a game by default.
- Practice drops the opponent; misc becomes title, date, time, location, notes.
- Game Day and the Lineup tab filter to games only.
- **RSVP** — attending / maybe / not attending — as a subcollection under each
  event, readable by the team and writable only by yourself, with counts on the
  schedule row.

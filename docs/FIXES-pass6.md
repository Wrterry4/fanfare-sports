# This pass

## The Settings crash — and the checker that should have caught it

`useMyRole is not defined`. Four imports were missing from `SettingsScreen`,
including the component that renders the notification panel.

The cause is worth stating plainly: my scripted edits replace exact strings, and
one targeted a **multi-line** import block that the file actually had on a
**single line**. The replacement matched nothing, failed silently, and the
edits that depended on it went in anyway. Everything still parsed — JSX is
valid whether or not an identifier resolves — so nothing caught it until the
screen rendered.

`scripts/check-imports.mjs` now checks every JSX component and every `useFoo()`
call against what the file imports or declares. It's in `npm test` alongside
the prop checker. Between them they cover both ways an identifier can be
missing at runtime while the file still compiles.

## Assigning a kid to a parent

There genuinely was no path from the coach's side — only the parent-asks,
coach-approves direction. Now: **Roster → tap a player → "Who follows Jack?"**
It lists everyone on the team who could be linked, shows who already is, and
links or unlinks in a tap.

Guardianship still isn't written from a client. The new `assignGuardian`
function does it, same as the claim flow.

## Game Day layout

The scoring-mode toggle moved into the scoreboard's top-right corner. It's a
setting, glanced at rarely, and it was costing a full row of a screen where
nothing scrolls.

The handoff strip now appears **only when there's something to do** — an
incoming request, your own pending one, or a stale feed. Holding the book
quietly needs no banner. A viewer's button reads "Ask for the book" and turns
into "Cancel request", and a coach sees who is asking by name rather than
"someone".

## Nav bar, again

Sizing from `insets.bottom` was still wrong: an installed PWA resolves
`env(safe-area-inset-bottom)` *after* the first paint, so a bar measured on
mount comes out short. There's now a floor of 20, which covers the gesture bar
on current iPhones — on hardware with no inset it reads as breathing room
rather than a clipped label.

## Teams in the account menu

Rename and leave, with delete offered to whoever created the team. Deleting
removes the team and its schedule; **players keep their own records and career
stats**, which is exactly why they live at the root rather than inside a team.

## Teams identified by child

Once you're tracking two kids, "Ridgeview Reds" and "Northgate Fury" don't say
which is which — but "Jack" and "Maya" do. Each team in the switcher now leads
with the name of whichever of your children is on it, read from the roster
document so it works for parents and grandparents alike.

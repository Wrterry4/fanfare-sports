# Phase 4 — scoring and schedule depth

## Full-word buttons, three across

"GO" and "FO" are obvious to someone who has kept a book for years and opaque
to the parent handed the phone in the third inning — and that parent is who
this has to work for. Ground Out, Fly Out, Strikeout, Fielder's Choice, Error.

Three per row instead of five, wrapping. The words fit at a readable size and
the targets got bigger, which matters more than density on a control tapped a
few hundred times a game.

## The other dugout is numbered

Opponent slots were showing as dashes on the diamond and as placeholder ids in
the up-next strip. They're now Batter 1 through 9 with matching numbers on the
bases, so the field reads properly while your team is fielding.

## Past games show the full inning report

The line score is mirrored onto the game document whenever the score syncs, so
a finished game renders its inning-by-inning box **without loading its event
log** — one document read instead of several hundred.

## W or L leads the score

A bare "3–8" doesn't say who won, and the result is the thing a parent scans
for. The pill now reads `W 8–3` or `L 3–8`, colour-coded, computed from which
dugout you were in.

## Finished games are read-only

The EDIT button is gone once a game is final. Changing the date or opponent
afterwards would rewrite the record the stats were built from.

## Lineups: upcoming and past

Past games sit behind a toggle rather than cluttering the picker with a whole
season by August. They stay viewable and stay locked.

## Drag to reorder

Long press to lift, then drag. Touch-dragging inside a scrolling list fights
the scroll gesture — every attempt to scroll past a row starts a drag instead —
and requiring a deliberate lift separates the two intentions completely, at the
cost of about a third of a second.

Rows are fixed height so the target index is arithmetic rather than a layout
measurement per frame. Rows between the lifted one and the drop point slide out
of the way, so the gap always shows where it will land.

## A real check for the bug that caused the blue screen

`scripts/check-props.mjs` catches props used but never declared — the mistake
that made ActionPads read `rules` as an undefined global and unmount the whole
tree. It's wired into `npm test`.

Worth noting the checker itself was wrong twice before it was right: the first
version only split components on `function`, so `export function` didn't end
the previous body and one component's code bled into the next. The second
missed `const [a, b] = useState()`, so every hook value looked undeclared. Both
produced confident false alarms — which is a decent argument for checking the
checker against code you've already read.

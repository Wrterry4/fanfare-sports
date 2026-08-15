# Phase 1 — bugs

## Editing a player: insufficient permissions

`createPlayer` writes `guardianUserIds: []` — a coach adding a kid isn't that
kid's parent — but the update rule required `isGuardian()`. So the coach who
created a player couldn't then edit them.

Now `canSeePlayer()`, which is `authorizedUserIds`: guardians **plus** the staff
of every team the player is rostered on. My first attempt tried to compute that
set inside the rule, which can't be done — rules can't iterate — and capped out
at three teams. The array already holds exactly the right set, maintained by
`syncPlayerAccess`.

**Now that you're on Blaze, deploy functions.** That's what keeps
`authorizedUserIds` correct as parents join and players move teams. Without it
the array only ever contains whoever created the player.

## Pitch tally counted balls

The outcome-only tally button fired `EV.BALL`, so it incremented the ball count
and walked a batter every four taps. There's now a `PITCH_TALLY` event that
touches the pitcher's count and nothing else. Six assertions cover it.

## "REQUESTED…" flashed and reverted

The rule only let `canScore` roles request the book, so a parent's write was
rejected and Firestore rolled back the optimistic local update.

Any member can now request. Holding the baton is itself the authorization for
writing events — a coach decides who keeps the book by passing it, so a role
check on top only blocked people the coach had deliberately chosen. A team
parent keeping score is normal in youth ball.

## A finished game jumped to the next one

Game Day now pins whatever game it's showing and holds it, even after it goes
final, so you can look at the finished line score. The pin clears when the tab
loses focus — come back and you get the next game with a Start button.

## Audio file types

The accept filter is gone entirely. iOS Files applies its own reading of
`audio/*` and greys out `.m4a` — the format iOS records and Apple Music exports
— and an explicit extension list didn't reliably fix it. Files are now validated
after picking by asking the browser to decode them, with a clear message and an
8-second timeout for formats that neither load nor error.

## Play / pause

The walk-up button toggles to pause while playing and reverts on its own when
the clip fades out.

## Tab bar

`paddingTop: 6` was the empty strip above the icons. Items fill the bar now, the
label has an explicit line height so descenders aren't clipped, and the hairline
border is back deliberately rather than as leftover space.

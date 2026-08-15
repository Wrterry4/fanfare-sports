# Phase 3 — identity and access

## Claiming a child

The rule this is built around: **guardianship is never self-granted.** A join
code gets texted around and forwarded, so anything less would let a stranger
attach themselves to someone else's child and read their stats.

The flow:

1. Someone joins the team with the code — they get the schedule, live games,
   and team chat immediately.
2. On the Roster tab they tap their child and choose **I'm a parent** or
   **Family**.
3. A coach (or an existing parent of that child) approves it in Settings.
4. Approval links them, and for a parent claim, grants guardianship.

Two kinds of link, deliberately different:

| | parent | family / fan |
|---|---|---|
| That child's stats and alerts | ✓ | ✓ |
| Approve transfers, set walk-up song | ✓ | |
| Team chat and direct messages | ✓ | |
| See the roster | ✓ | |
| Approve other family members | ✓ | |

Everything lands in one transaction — a half-applied claim would leave someone
on a team with a child attached but no read access.

## Why names were missing

Names live on the user document, and nobody can read anyone else's. The member
document never carried one, so Settings and the DM list fell back to role
labels.

`displayName` is now denormalized onto the member doc when you create or join a
team, and a `propagateDisplayName` trigger keeps it current when someone edits
their name in the account menu.

## Fans see less, on purpose

A grandparent gets **Game Day and Schedule** and nothing else. No Roster tab —
that would be a directory of other people's children — and no chat or team
settings. Enforced in the rules, not just by hiding tabs.

They're hidden from the member list and the DM list too, but **staff can still
see them** — otherwise nobody could manage who they'd let in.

## Account creation on the join page

The invite link now creates the account inline: see the team, make an account,
pick your role, join. One tap does all of it. Bouncing someone to a separate
sign-up screen and hoping they find their way back is where invite funnels lose
people, and this link is how the product spreads.

## Copy invite

One button copies a written message with the link and the code, ready to paste
into a text or a team group chat. Falls back to the OS share sheet on native.

## Deploy

```bash
firebase deploy --only firestore:rules
firebase deploy --only functions
```

`propagateDisplayName` and `syncPlayerAccess` both need to be live — the first
fills in names, the second is what actually grants a linked parent read access
to their child.

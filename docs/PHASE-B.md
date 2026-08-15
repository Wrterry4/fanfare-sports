# Phase B — events and RSVP

## Three kinds of schedule entry

**Game** — opponent, home/away, scoring, lineup, line score.
**Practice** — optional title, date, time, park, field, notes.
**Event** — title, date, time, location, notes.

They live in the **same `games` collection** they always have, distinguished by
a `type` field. A separate collection would have meant migrating every existing
document, splitting the schedule query in two, and teaching Game Day to look in
two places — all to store what is really one thing: something on the calendar.

A document with no `type` is a game, which is exactly what every existing row
is. Nothing to migrate.

Only games carry scoring state. A practice never gets a rules snapshot, a line
score, or a scorekeeper — those fields would be noise in every query that
touches it. Game Day and the Lineup picker filter to games, so practices can't
be scored or given a batting order.

## RSVP is per player, not per person

This is the one place I'd push back on the obvious design.

A coach asking "how many do I have Saturday?" needs a count of **kids**, not
adults. So each RSVP is keyed by player: a parent with two on the roster
answers twice, and staff answer for themselves under a `u_` prefixed id so the
two can never collide.

The summary line reads "9 players in", which is the number that decides whether
there's a game.

## Who can answer

Everyone who isn't a fan — coaches, scorekeepers, and parents — and only for a
child they're linked to, or for themselves. That last part is enforced in the
rules:

```
rsvpId == 'u_' + uid()
|| rsvpId in member(teamId).data.linkedPlayerIds
|| isStaff(teamId)
```

Without it, one parent could mark another family's child absent.

Grandparents and family are excluded entirely, as you asked — they follow a
child, they aren't part of the headcount.

Coaches see the individual answers underneath the summary; everyone else sees
just the counts and their own buttons.

## Deploy

```bash
firebase deploy --only firestore:rules
firebase deploy --only functions
```

Rules are required — RSVP writes are rejected without them. Functions only
matter for the notification tweak (practices and events no longer trigger a
"first pitch" alert).

/**
 * gameIdentity.js — What counts as "the same live subscription."
 *
 * Split out of useGame.js specifically so it's testable in plain Node —
 * useGame.js pulls in the Firebase-backed service layer, which this doesn't
 * need at all.
 *
 * ── The bug this exists to prevent ──────────────────────────────────────
 *
 * useGame keeps rendering the PREVIOUS snapshot until a new subscription's
 * first callback arrives — fine when nothing about the shape changed, but a
 * real problem when it did: a basketball state has no `.pitchers`, a
 * baseball state has no `.onCourt`, and reading either unguarded throws.
 *
 * The obvious identity is teamId+gameId — clear the snapshot when either
 * changes, since that's a real navigation to a different game. That was the
 * first fix, and it missed a real second path to the same crash: `sport` can
 * change while teamId and gameId stay exactly the same. sportForTeam falls
 * back to baseball whenever team.sport isn't known yet, which is true for
 * one render on nearly every load — before the team document has actually
 * arrived. So the very first subscription often starts as baseball's
 * reduce() and swaps to basketball's a moment later once the real team doc
 * loads, with teamId:gameId never changing across that swap. The old check
 * never cleared the snapshot for it, so a baseball-shaped leftover kept
 * rendering through basketball's components for that gap.
 *
 * `sport.key` is part of the identity now, so a sport-only change clears the
 * snapshot exactly like a real game switch does.
 */
export function snapshotIdentity(teamId, gameId, sport) {
  return `${teamId}:${gameId}:${sport?.key || 'unknown'}`;
}

/**
 * activeTeamResolution.js — Which team is active, given what's known so far.
 *
 * Split from ActiveTeam.jsx specifically so this is testable in plain Node —
 * that file has JSX in it, which Node can't parse directly.
 *
 * ── The bug this exists to prevent ──────────────────────────────────────
 *
 * This used to resolve to `teams[0]` — an arbitrary team, whatever order
 * Firestore happened to return — the instant the team list arrived, even if
 * the stored preference (`activeId`, read from AsyncStorage) hadn't loaded
 * yet. AsyncStorage and the Firestore team-list listener are two independent
 * async operations with no ordering between them; on a fresh PWA launch the
 * team list often resolves first.
 *
 * Several consumers read `team` straight from context without checking
 * `loading` first — the header, the role check, the sport theme — so for
 * that brief window the whole app rendered whatever team happened to load
 * first, then visibly swapped to the real one a moment later once
 * AsyncStorage caught up. That's the "starts on a new team, then switches"
 * symptom.
 *
 * Returning null until `restored` is true removes the guess entirely: every
 * consumer sees "no team yet" for that window instead of "the wrong team,"
 * regardless of whether that particular consumer remembers to check
 * `loading` — which not all of them did, and that's exactly how this shipped.
 */
export function resolveActiveTeam(teams, activeId, restored) {
  if (!restored) return null;
  return teams?.find((t) => t.id === activeId) ?? teams?.[0] ?? null;
}

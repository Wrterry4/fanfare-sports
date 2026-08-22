/**
 * useSportTheme.js — The active sport's accent, without a migration.
 *
 * ThemeProvider exists and is sport-aware, but nothing mounts it: every screen
 * still imports the flat `colors` object from tokens.js, which is a single
 * hard-coded palette. Migrating all of them is a real project.
 *
 * This is the narrow version. It resolves the current team's sport theme so
 * the handful of components that genuinely define how a sport FEELS — the
 * playing surface, the scoring keys, the participant accents — can use it
 * today. Everything else keeps the brand palette, which is the intent anyway:
 * a sport contributes an accent, not a whole look.
 *
 * When the migration happens, this becomes a thin wrapper over useTheme() and
 * callers don't change.
 */

import { useMemo } from 'react';

import { useActiveTeam } from '../hooks/ActiveTeam.jsx';
import { sportForTeam } from '../sports/registry.js';
import { colors } from './tokens.js';
import { resolveTeamColor, DEFAULT_TEAM_COLOR } from '../shared/teamColors.js';

const FALLBACK = {
  name: 'sport',
  accent: colors.primary,
  accentSoft: colors.line,
  fieldStroke: colors.navy,
  fieldFill: colors.card,
  occupied: colors.primary,
};

/**
 * Merged so a pack that omits a key still gets a usable value.
 *
 * `team` is added alongside the sport accent rather than replacing it, and the
 * distinction is the point. The sport accent says what game this is — infield
 * clay, basketball leather — and belongs to the playing surface. The team
 * color says whose team this is, and belongs to the things that identify them:
 * the scoreboard, the celebration, the player card. Collapsing the two would
 * mean a team's color repainting the diamond, which helps nobody find their
 * kid and loses the sport's character at the same time.
 */
export function useSportTheme() {
  const { team } = useActiveTeam();
  return useMemo(() => {
    const packTheme = sportForTeam(team)?.theme || {};
    return { ...FALLBACK, ...packTheme, team: resolveTeamColor(team) };
  }, [team?.sport, team?.colorId, team?.color]);
}

/** Just the team's colors, for the many callers that need nothing else. */
export function useTeamColor() {
  const { team } = useActiveTeam();
  return useMemo(() => resolveTeamColor(team), [team?.colorId, team?.color]);
}

/** For components handed a pack directly rather than reading context. */
export const sportThemeOf = (sport) => ({
  ...FALLBACK, ...(sport?.theme || {}), team: DEFAULT_TEAM_COLOR,
});

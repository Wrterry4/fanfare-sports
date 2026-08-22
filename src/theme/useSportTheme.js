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

const FALLBACK = {
  name: 'sport',
  accent: colors.primary,
  accentSoft: colors.line,
  fieldStroke: colors.navy,
  fieldFill: colors.card,
  occupied: colors.primary,
};

/** Merged so a pack that omits a key still gets a usable value. */
export function useSportTheme() {
  const { team } = useActiveTeam();
  return useMemo(() => {
    const packTheme = sportForTeam(team)?.theme || {};
    return { ...FALLBACK, ...packTheme };
  }, [team?.sport]);
}

/** For components handed a pack directly rather than reading context. */
export const sportThemeOf = (sport) => ({ ...FALLBACK, ...(sport?.theme || {}) });

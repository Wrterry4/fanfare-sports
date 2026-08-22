/**
 * registry.js — Sport packs.
 *
 * A sport bundles its rules, event vocabulary, state machine, stat engine,
 * theme, terminology, and field component. Everything outside src/sports/ is
 * sport-agnostic: auth, invites, messaging, roster, transfers, the baton, the
 * event-log mechanics, and every security rule.
 *
 * Adding a sport means adding a folder and one entry here. It does NOT mean
 * touching the backend — that's the whole reason the split exists.
 */

import * as baseball from './baseball/index.js';
import * as basketball from './basketball/index.js';

export const SPORTS = {
  baseball,
  basketball,
};

export const getSport = (key) => SPORTS[key] ?? SPORTS.baseball;
export const sportKeys = () => Object.keys(SPORTS);

/**
 * Stored on the team document as `sport`. Defaults to baseball so existing
 * teams keep working when a second sport lands.
 */
export const sportForTeam = (team) => getSport(team?.sport || 'baseball');

/**
 * gameReadiness.js — What's missing before a game starts.
 *
 * ── Warn, never block ───────────────────────────────────────────────────────
 *
 * A coach standing on a field with seven kids is going to play the game
 * whatever this says. Refusing to start it would mean the game gets scored on
 * paper and never entered — the app loses, and so does every stat that would
 * have come from it. So this returns warnings and the Start button always
 * works.
 *
 * ── Two different problems, two different messages ──────────────────────────
 *
 * NOT ENOUGH ON THE ROSTER means players haven't been added to the team yet.
 * The fix is in the Roster tab, and until it's done there is nothing to score
 * with — no batters, nobody on the floor.
 *
 * NOT ENOUGH IN THE LINEUP means the people exist but this game's card is
 * short or unset. The fix is in the Schedule tab, and it's a different kind of
 * "wrong" — recoverable mid-game, and often deliberate when kids are absent.
 *
 * Collapsing them into one message would send a coach to the wrong screen,
 * which is the whole reason they're separate.
 */

/**
 * @param sport  the sport pack, which declares MIN_PLAYERS
 * @param roster the team roster
 * @param lineup this game's lineup, if one has been set
 * @param rules  resolved rules, for continuous batting order
 * @returns [{ key, severity, title, body, fix }]
 */
export function checkGameReadiness(sport, roster = [], lineup = [], rules = {}) {
  const min = sport?.MIN_PLAYERS;
  if (!min) return [];

  const warnings = [];
  const rosterCount = roster.length;
  const noun = min.noun || 'players';

  if (rosterCount === 0) {
    // Distinct from "not enough": an empty roster isn't a shortage, it's a
    // setup step nobody has done, and the game genuinely can't be scored.
    warnings.push({
      key: 'rosterEmpty',
      severity: 'high',
      title: 'No players on the roster',
      body: `Add players in the Roster tab before scoring. Without them there's `
          + `nobody to record ${noun === 'batters' ? 'at-bats' : 'stats'} for.`,
      fix: 'roster',
    });
    return warnings;   // the lineup warning would be noise on top of this
  }

  if (rosterCount < min.roster) {
    warnings.push({
      key: 'rosterShort',
      severity: 'medium',
      title: `Only ${rosterCount} on the roster`,
      body: `This sport usually needs ${min.roster}. You can still score the `
          + `game — add anyone missing in the Roster tab.`,
      fix: 'roster',
    });
  }

  /**
   * A continuous batting order bats the whole roster, so an unset lineup is
   * normal rather than a problem — the engine falls back to jersey order.
   * Warning there would train the coach to ignore this panel.
   */
  const lineupIsOptional = !!rules.continuousBattingOrder;
  const lineupCount = lineup.length;

  if (lineupCount === 0 && !lineupIsOptional) {
    warnings.push({
      key: 'lineupUnset',
      severity: 'medium',
      title: 'No lineup set for this game',
      body: `Set one from the Schedule tab. Without it the game will use the `
          + `full roster in jersey order.`,
      fix: 'lineup',
    });
  } else if (lineupCount > 0 && lineupCount < min.lineup) {
    warnings.push({
      key: 'lineupShort',
      severity: 'low',
      title: `Only ${lineupCount} in the lineup`,
      body: `This sport usually needs ${min.lineup} ${noun}. Fine if that's who `
          + `showed up — you can change it from the Schedule tab.`,
      fix: 'lineup',
    });
  }

  return warnings;
}

/** True when nothing can be scored at all, for callers that want one bit. */
export const isScoreable = (warnings) =>
  !warnings.some((w) => w.key === 'rosterEmpty');

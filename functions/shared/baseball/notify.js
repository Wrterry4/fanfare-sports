/**
 * notify.js — Turning a logged event into a sentence, for baseball.
 *
 * Split out of functions/notifications.js, which imported the baseball engine
 * directly and hard-coded "singled", "doubled", RBI counts and opponent id
 * prefixes. That made a Cloud Function a baseball function: adding a second
 * sport would have meant a switch statement in the notification path, growing
 * a branch per sport forever.
 *
 * This module is deliberately PURE and JSX-FREE. functions/build-shared.js
 * vendors every .js file in this folder into the deployed bundle, and anything
 * importing a component would break that copy at runtime.
 *
 * The contract: given the event log up to and including one event, return
 * either null (nothing worth sending) or a descriptor naming the player, the
 * preference key that gates it, and the words.
 */

import { reduce } from './engine.js';
import { EV, HITS } from './events.js';
import { buildGameConfig, isOpponentId } from './config.js';

const HIT_WORD = {
  [EV.SINGLE]: 'singled',
  [EV.DOUBLE]: 'doubled',
  [EV.TRIPLE]: 'tripled',
  [EV.HOME_RUN]: 'homered',
};

/** Events worth waking a phone for — about eighty a game, not every pitch. */
export const NOTIFIABLE_TYPES = [...HITS, EV.WALK, EV.SAC_FLY, EV.BATTER_UP];

export const isNotifiable = (type) => NOTIFIABLE_TYPES.includes(type);

/**
 * The game-start push. Lived as a hardcoded string ('First pitch — follow
 * along live.') inside functions/notifications.js — which meant a basketball
 * game announced its tip-off with baseball's words. Each sport names its own
 * moment now, the same way present.js already names its own period labels.
 */
export function describeGameStart() {
  return { body: 'First pitch — follow along live.' };
}

/**
 * @param created  the event document that fired the trigger
 * @param events   the log up to and including it, voided entries removed
 * @param game     the game document
 * @returns null, or { playerId, preferenceKey, title, body, kind }
 */
export function describePlay(created, events, game) {
  if (!isNotifiable(created.type)) return null;

  /**
   * The event document records the type but not who batted — the scorekeeper
   * taps "Single" and the engine derives the batter from game state. So the
   * log is replayed with the same engine the app uses, which gives both the
   * batter and the exact RBI count.
   */
  const state = reduce(events, game.rulesSnapshot || {}, buildGameConfig(game));
  const playerId = state._batterId;

  // Opponent slots are synthetic ids with no player record and no family to
  // notify.
  if (!playerId || isOpponentId(playerId)) return null;

  if (created.type === EV.BATTER_UP) {
    return {
      kind: 'atBat',
      playerId,
      preferenceKey: 'myPlayerAtBat',
      title: (first) => `${first} is up`,
      body: () => 'At the plate now.',
    };
  }

  const rbi = state._rbi || 0;
  const word = HIT_WORD[created.type]
    || (created.type === EV.WALK ? 'walked' : 'hit a sacrifice fly');

  return {
    kind: 'result',
    playerId,
    preferenceKey: 'myPlayerResult',
    // Titles need the team name, bodies need the child's first name; neither
    // is known here, so both arrive as functions the caller fills in.
    title: (first, context) => context.matchup,
    body: (first) => (rbi > 0 ? `${first} ${word} — ${rbi} RBI` : `${first} ${word}`),
  };
}

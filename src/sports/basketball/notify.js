/**
 * notify.js — Turning a basketball event into a sentence.
 *
 * Same contract as baseball's, and the reason it exists is the same: the
 * notification Cloud Function dispatches on sport rather than growing a switch.
 * Pure and JSX-free, because build-shared.js vendors it into the deployed
 * bundle.
 *
 * One real difference. Baseball has to replay the log to find out WHO batted,
 * because the scorekeeper taps "Single" and the engine derives the rest.
 * Basketball events name their player directly, so no replay is needed — which
 * makes this both simpler and much cheaper per event.
 */

import { EV, SHOT_VALUE } from './events.js';
import { isOpponentId } from './config.js';

/**
 * What's worth waking a phone for.
 *
 * Deliberately narrow. A rec game has 140 possessions, and a notification for
 * every rebound would get the app muted within one quarter. Made shots and
 * fouling out are the moments a family five hundred miles away wants.
 */
export const NOTIFIABLE_TYPES = [EV.MADE_1, EV.MADE_2, EV.MADE_3, EV.FOUL_PERSONAL];

export const isNotifiable = (type) => NOTIFIABLE_TYPES.includes(type);

/** See baseball/notify.js for why this exists per sport rather than once. */
export function describeGameStart() {
  return { body: 'Tip-off — follow along live.' };
}

const SHOT_WORD = {
  [EV.MADE_1]: 'made a free throw',
  [EV.MADE_2]: 'scored',
  [EV.MADE_3]: 'hit a three',
};

export function describePlay(created, events, game) {
  if (!isNotifiable(created.type)) return null;

  const playerId = created.payload?.playerId;
  if (!playerId || isOpponentId(playerId)) return null;

  if (created.type === EV.FOUL_PERSONAL) {
    // Only the foul that ends their game. Every other foul is noise.
    const limit = game.rulesSnapshot?.foulsToFoulOut || 0;
    if (!limit) return null;

    const priorFouls = (events || []).filter((e) =>
      !e.voided
      && e.type === EV.FOUL_PERSONAL
      && e.payload?.playerId === playerId
      && e.seq <= created.seq
    ).length;
    if (priorFouls < limit) return null;

    return {
      kind: 'result',
      playerId,
      preferenceKey: 'myPlayerResult',
      title: (first, ctx) => ctx.matchup,
      body: (first) => `${first} fouled out`,
    };
  }

  // Running total, so the message says something more useful than "scored".
  const points = (events || [])
    .filter((e) => !e.voided
      && e.payload?.playerId === playerId
      && SHOT_VALUE[e.type]
      && e.seq <= created.seq)
    .reduce((sum, e) => sum + SHOT_VALUE[e.type], 0);

  return {
    kind: 'result',
    playerId,
    preferenceKey: 'myPlayerResult',
    title: (first, ctx) => ctx.matchup,
    body: (first) => `${first} ${SHOT_WORD[created.type]} — ${points} on the day`,
  };
}

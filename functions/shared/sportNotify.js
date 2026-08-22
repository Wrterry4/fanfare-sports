/**
 * sportNotify.js — Which sport describes this game's events?
 *
 * A second registry, separate from src/sports/registry.js, and the reason is
 * mechanical rather than architectural: the main registry imports each pack's
 * index.js, which re-exports .jsx components. functions/build-shared.js copies
 * only .js files into the deployed bundle, so a Cloud Function importing the
 * main registry would fail at runtime on a missing Field.jsx.
 *
 * This maps a sport key straight to its pure notify module. Adding a sport is
 * one import and one entry — and if that entry is forgotten, notifications
 * fall silent rather than describing a basketball game in baseball words, so
 * tests/sportContract.test.js checks every registered sport appears here.
 */

import * as baseball from './baseball/notify.js';
import * as basketball from './basketball/notify.js';

const PACKS = { baseball, basketball };

/** Defaults to baseball: every game written before `sport` existed is one. */
export function notifyPackFor(sportKey) {
  return PACKS[sportKey] || PACKS.baseball;
}

export const notifySportKeys = () => Object.keys(PACKS);

/**
 * summary.test.js — The mirrored summary must never start a game.
 *
 * A regression test for a real bug: syncGameSummary wrote `status: 'live'`
 * unconditionally, so opening Game Day on a scheduled game started it four
 * seconds later without anyone tapping anything.
 *
 * Run: node tests/summary.test.js
 */

import { shouldSyncSummary } from '../src/shared/gameSummary.js';

let passed = 0, failed = 0;
const out = [];
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; out.push(`  ok   ${name}`); }
  else { failed++; out.push(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`); }
}

const state = (over = {}) => ({ lastEventSeq: 5, score: { home: 0, away: 0 }, ...over });

out.push('\nWhen the summary may be written');
check('a live game with events', shouldSyncSummary({ status: 'live' }, state()), true);
check('a scheduled game — never', shouldSyncSummary({ status: 'scheduled' }, state()), false);
check('a final game — never', shouldSyncSummary({ status: 'final' }, state()), false);
check('a live game with no events yet',
  shouldSyncSummary({ status: 'live' }, state({ lastEventSeq: null })), false);
check('no game', shouldSyncSummary(null, state()), false);
check('no state', shouldSyncSummary({ status: 'live' }, null), false);

out.push('\nThe write itself carries no status');
{
  // Reading the source is the only way to assert this without Firestore, and
  // it's the property that actually matters.
  const src = (await import('fs')).readFileSync('src/services/gameService.js', 'utf8');
  const body = src.slice(src.indexOf('export function syncGameSummary'));
  const fn = body.slice(0, body.indexOf('\n}'));
  check('syncGameSummary never sets status', /status\s*:/.test(fn), false);
}

console.log(out.join('\n'));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

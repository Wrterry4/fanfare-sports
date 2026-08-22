/**
 * gameIdentity.test.js — When a stale game snapshot must be cleared.
 *
 * The bug, twice over: a basketball state has no .pitchers, a baseball state
 * has no .onCourt, and rendering either through the wrong sport's components
 * throws immediately. useGame is supposed to clear its snapshot the instant
 * it's looking at something new — the first version only checked teamId and
 * gameId, which missed the actual case that shipped: `sport` resolving from
 * a baseball fallback to the real basketball value while teamId and gameId
 * never change at all, because the team document simply hadn't loaded yet
 * on the first render.
 */

import { snapshotIdentity } from '../src/shared/gameIdentity.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

const baseball = { key: 'baseball' };
const basketball = { key: 'basketball' };

group('The bug: sport resolving late, teamId and gameId unchanged');
{
  // This is exactly what happens on load: sportForTeam falls back to
  // baseball before the team document has arrived, then corrects.
  const first = snapshotIdentity('team1', 'game1', baseball);
  const second = snapshotIdentity('team1', 'game1', basketball);
  ok('the identity is different even though team and game are not',
    first !== second);
}

group('A real game switch is still caught');
{
  const a = snapshotIdentity('team1', 'game1', baseball);
  const b = snapshotIdentity('team1', 'game2', baseball);
  ok('a different game changes the identity', a !== b);
}
{
  const a = snapshotIdentity('team1', 'game1', baseball);
  const b = snapshotIdentity('team2', 'game1', baseball);
  ok('a different team changes the identity', a !== b);
}

group('Nothing actually changing does not falsely trigger a reset');
{
  const a = snapshotIdentity('team1', 'game1', baseball);
  const b = snapshotIdentity('team1', 'game1', baseball);
  ok('the same team, game, and sport produce the same identity', a === b);
}

group('A sport with no key at all is still handled, not thrown on');
{
  let threw = false;
  try { snapshotIdentity('t', 'g', undefined); } catch { threw = true; }
  ok('undefined sport does not throw', !threw);

  threw = false;
  try { snapshotIdentity('t', 'g', {}); } catch { threw = true; }
  ok('a sport object with no key does not throw', !threw);

  ok('an undefined sport is distinguishable from a real one',
    snapshotIdentity('t', 'g', undefined) !== snapshotIdentity('t', 'g', baseball));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

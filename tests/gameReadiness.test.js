/**
 * gameReadiness.test.js — The two warnings, and when each fires.
 *
 * The rule under test throughout: warn, never block. A coach with seven kids
 * plays anyway, and an app that refuses loses the game to a paper scorebook.
 */

import { checkGameReadiness, isScoreable } from '../src/shared/gameReadiness.js';
// The pack index re-exports .jsx components, which Node can't load. Only
// MIN_PLAYERS is needed here, so the rules module stands in for the pack.
import { MIN_PLAYERS as baseballMin } from '../src/sports/baseball/rules.js';
import { MIN_PLAYERS as basketballMin } from '../src/sports/basketball/rules.js';

const baseball = { MIN_PLAYERS: baseballMin };
const basketball = { MIN_PLAYERS: basketballMin };

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

const players = (n) => Array.from({ length: n }, (_, i) => ({ playerId: `p${i}` }));
const keys = (w) => w.map((x) => x.key).sort().join(',');

group('An empty roster is its own problem');
{
  const w = checkGameReadiness(basketball, [], [], {});
  ok('one warning, not two', w.length === 1);
  ok('it names the roster', w[0].key === 'rosterEmpty');
  // Telling someone their lineup is short when there are no players to put in
  // it sends them to the wrong screen.
  ok('the lineup warning is suppressed', !keys(w).includes('lineupUnset'));
  ok('it points at the Roster tab', w[0].fix === 'roster');
  ok('and nothing is scoreable', !isScoreable(w));
}

group('Basketball needs five');
{
  const w = checkGameReadiness(basketball, players(3), players(3), {});
  ok('a three-player roster warns', keys(w).includes('rosterShort'));
  ok('the count is in the message', w[0].title.includes('3'));
  ok('the requirement is too', w[0].body.includes('5'));
  ok('it is still scoreable', isScoreable(w));
}
{
  const w = checkGameReadiness(basketball, players(8), players(5), {});
  ok('eight rostered and five dressed is fine', w.length === 0);
}
{
  const w = checkGameReadiness(basketball, players(8), players(4), {});
  ok('four in the lineup warns', keys(w) === 'lineupShort');
  ok('pointing at the Schedule tab', w[0].fix === 'lineup');
  ok('and says it is fine if that is who showed up', /showed up/.test(w[0].body));
}

group('Baseball needs nine');
{
  const w = checkGameReadiness(baseball, players(9), players(9), {});
  ok('a full team warns about nothing', w.length === 0);
}
{
  const w = checkGameReadiness(baseball, players(7), players(7), {});
  ok('seven warns on both counts', keys(w) === 'lineupShort,rosterShort');
  ok('but the game can still be scored', isScoreable(w));
}

group('An unset lineup depends on the rules');
{
  // Continuous order bats the whole roster, so no lineup is the normal case.
  const w = checkGameReadiness(baseball, players(12), [], { continuousBattingOrder: true });
  ok('continuous batting order does not warn', w.length === 0);
}
{
  const w = checkGameReadiness(baseball, players(12), [], { continuousBattingOrder: false });
  ok('a fixed order does warn', keys(w) === 'lineupUnset');
  ok('explaining the fallback', /jersey order/.test(w[0].body));
}

group('Edges');
ok('a sport with no minimum declared warns about nothing',
  checkGameReadiness({}, [], [], {}).length === 0);
ok('undefined inputs do not throw',
  checkGameReadiness(basketball, undefined, undefined, undefined).length === 1);
ok('an empty warning list is scoreable', isScoreable([]));

group('Every warning is actionable');
{
  const all = [
    ...checkGameReadiness(basketball, [], [], {}),
    ...checkGameReadiness(baseball, players(7), players(7), {}),
    ...checkGameReadiness(baseball, players(12), [], {}),
  ];
  ok('each has a title, body and a screen to fix it on',
    all.every((w) => w.title && w.body && w.fix));
  ok('each names a real destination',
    all.every((w) => ['roster', 'lineup'].includes(w.fix)));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

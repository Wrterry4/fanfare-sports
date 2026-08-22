/**
 * momentPhrases.test.js — Banner copy varies, but never disagrees.
 *
 * The rotation exists so the same three banners don't read as canned. The
 * constraint that matters more is that every device watching one game shows
 * the SAME phrase for the same swing — see pickPhrase.js. Both are checked
 * here, along with the grand slam guard, which is the one place a wrong
 * answer would be loudly wrong in front of a crowd.
 */

import { pickPhrase } from '../src/sports/pickPhrase.js';
import { describeMoment } from '../src/sports/baseball/present.js';
import { EV } from '../src/sports/baseball/events.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

const personFor = (id) => (id === 'p1' ? { firstName: 'Jimmy' } : null);
const hr = (seq, extra = {}) => ({ seq, type: EV.HOME_RUN, payload: { playerId: 'p1' }, ...extra });
/** The engine hangs these transients on the reduced state after a home run. */
const afterHR = (rbi, batter = 'p1') => ({ _outcomeType: EV.HOME_RUN, _batterId: batter, _rbi: rbi });

group('pickPhrase is stable, in range, and never throws');
{
  const pool = ['a', 'b', 'c'];
  ok('the same seed always gives the same entry', pickPhrase(pool, 7) === pickPhrase(pool, 7));
  ok('wraps rather than running off the end', pickPhrase(pool, 4) === 'b');
  ok('a negative seq still lands in the pool', pool.includes(pickPhrase(pool, -5)));
  ok('a missing seed answers rather than throwing', pickPhrase(pool, undefined) === 'a');
  ok('junk seed answers rather than throwing', pickPhrase(pool, 'xyz') === 'a');
  ok('an empty pool is null, not a crash', pickPhrase([], 3) === null);
  ok('a missing pool is null, not a crash', pickPhrase(undefined, 3) === null);
}

group('Every viewer sees the same phrase for the same event');
{
  // Two devices, same event, independent calls — this is the whole reason
  // the pick is seeded instead of random.
  const a = describeMoment(hr(11), afterHR(1), { personFor });
  const b = describeMoment(hr(11), afterHR(1), { personFor });
  ok('two independent devices agree', a.text === b.text);
}

group('The copy actually varies');
{
  const seen = new Set();
  for (let seq = 1; seq <= 20; seq++) {
    seen.add(describeMoment(hr(seq), afterHR(1), { personFor }).text);
  }
  ok('twenty home runs do not all read the same', seen.size > 1);
}

group('A name is used when there is one, and never faked when there is not');
{
  const named = describeMoment(hr(3), afterHR(1), { personFor });
  ok('the first name appears, uppercased', named.text.includes('JIMMY'));

  // Every seat in the pool must have a no-name form, or some seq lands on
  // "UNDEFINED GOES YARD!" — a bug that only shows up for one hitter.
  let clean = true;
  for (let seq = 1; seq <= 40; seq++) {
    const t = describeMoment(hr(seq, { payload: {} }), afterHR(1), { personFor }).text;
    if (/undefined|null/i.test(t) || t === '') clean = false;
  }
  ok('no seq produces undefined/empty text without a name', clean);
}

group('Grand slam is announced only when it is really a grand slam');
{
  const slam = describeMoment(hr(5), afterHR(4), { personFor });
  ok('four RBI says grand slam', /GRAND SLAM|EMPTIES THE BASES|BASES CLEARED/.test(slam.text));

  const solo = describeMoment(hr(5), afterHR(1), { personFor });
  ok('one RBI never says grand slam', !/GRAND SLAM/.test(solo.text));

  // The state's transients describe the LAST event reduced. If that is not
  // this home run, the RBI count belongs to something else entirely.
  const stale = describeMoment(hr(5), { _outcomeType: EV.STRIKEOUT, _batterId: 'p9', _rbi: 4 },
    { personFor });
  ok('a stale state does not borrow another play\'s RBI', !/GRAND SLAM/.test(stale.text));

  const otherBatter = describeMoment(hr(5), afterHR(4, 'p9'), { personFor });
  ok('an RBI total for a different batter is ignored', !/GRAND SLAM/.test(otherBatter.text));

  const noState = describeMoment(hr(5), undefined, { personFor });
  ok('no state at all still produces a banner', !!noState.text);
}

group('Multi-run shots report the real number');
{
  let checked = 0;
  for (const rbi of [2, 3]) {
    for (let seq = 2; seq <= 20; seq += 2) {   // even seq is the multi-run branch
      const text = describeMoment(hr(seq), afterHR(rbi), { personFor }).text;
      if (/-RUN SHOT|COME HOME|BRINGS/.test(text)) {
        checked++;
        ok(`${rbi} RBI at seq ${seq} names the right count`, text.includes(String(rbi)));
      }
    }
  }
  ok('the multi-run branch was actually exercised', checked > 0);
  ok('no placeholder leaks into the text',
    !describeMoment(hr(2), afterHR(3), { personFor }).text.includes('{RUNS}'));

  // Regression: the branch is gated on seq % 2, so seeding the pick on seq
  // itself made seq % pool.length constant and stranded every phrase but the
  // first. Any gate whose modulus shares a factor with the pool size does it.
  const variants = new Set();
  for (let seq = 2; seq <= 40; seq += 2) {
    variants.add(describeMoment(hr(seq), afterHR(3), { personFor }).text);
  }
  ok('multi-run shots are not pinned to one phrase', variants.size > 1);
}

group('Tone still drives the banner treatment');
{
  ok('a home run is big', describeMoment(hr(1), afterHR(1), { personFor }).tone === 'big');
  ok('a grand slam is big', describeMoment(hr(4), afterHR(4), { personFor }).tone === 'big');
  ok('a triple is good',
    describeMoment({ seq: 1, type: EV.TRIPLE, payload: { playerId: 'p1' } }, {}, { personFor })
      .tone === 'good');
  ok('a strikeout is good',
    describeMoment({ seq: 1, type: EV.STRIKEOUT, payload: { playerId: 'p1' } }, {}, { personFor })
      .tone === 'good');
}

group('A strikeout never names the batter');
{
  // playerId on a strikeout is the batter. Celebrating the pitcher is fine;
  // putting a kid's name on the screen for striking out is not.
  let named = false;
  for (let seq = 1; seq <= 20; seq++) {
    const text = describeMoment({ seq, type: EV.STRIKEOUT, payload: { playerId: 'p1' } }, {},
      { personFor }).text;
    if (text.includes('JIMMY')) named = true;
  }
  ok('no strikeout phrase includes the batter', !named);
}

group('Ordinary events are still not moments');
{
  ok('a single gets no banner',
    describeMoment({ seq: 1, type: EV.SINGLE, payload: { playerId: 'p1' } }, {}, { personFor })
      === null);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

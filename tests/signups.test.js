/**
 * signups.test.js — Who's bringing the snacks.
 */

import {
  buildSlots, slotState, canRelease, signupSummary, groupSlots, scheduleLine,
  SLOT_STATE, MAX_SLOTS,
} from '../src/shared/signups.js';
import { slug } from '../src/shared/docIds.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

console.log('\nBuilding slots');
{
  const one = buildSlots({ label: 'Snacks' }, slug);
  ok('one slot by default', one.length === 1);
  ok('the id is readable', one[0].id === 'snacks-1');
  // "Snacks 1 of 1" is noise; the position only earns its place with siblings.
  ok('a lone slot has no position', one[0].position === null && one[0].of === null);

  const three = buildSlots({ label: 'Field setup', count: 3 }, slug);
  ok('three slots, numbered', three.map((s) => s.id).join(',')
    === 'field-setup-1,field-setup-2,field-setup-3');
  ok('each knows its place', three[1].position === 2 && three[1].of === 3);

  // Same sign-up created twice is the same slots, not a second set.
  ok('ids are derived, so re-creating is idempotent',
    buildSlots({ label: 'Snacks' }, slug)[0].id === one[0].id);

  ok('a name is required', throws(() => buildSlots({ label: '  ' }, slug)));
  ok('a name with no letters is refused', throws(() => buildSlots({ label: '!!!' }, slug)));
  ok('the count is capped', buildSlots({ label: 'x', count: 99 }, slug).length === MAX_SLOTS);
  ok('zero becomes one', buildSlots({ label: 'x', count: 0 }, slug).length === 1);
}

console.log('\nWho has what');
{
  const open = { id: 's1', label: 'Snacks' };
  const mine = { id: 's2', label: 'Snacks', claimedBy: 'me' };
  const theirs = { id: 's3', label: 'Snacks', claimedBy: 'them' };

  ok('unclaimed is open', slotState(open, 'me') === SLOT_STATE.OPEN);
  ok('mine is mine', slotState(mine, 'me') === SLOT_STATE.MINE);
  ok('someone else has it', slotState(theirs, 'me') === SLOT_STATE.TAKEN);

  ok('I can drop my own', canRelease(mine, 'me'));
  ok('I cannot drop someone else\'s', !canRelease(theirs, 'me'));
  // Someone drops out the morning of and tells the coach, not the app.
  ok('a coach can clear anyone', canRelease(theirs, 'me', true));
  ok('nothing to release on an open slot', !canRelease(open, 'me', true));
}

console.log('\nWhat it says at a glance');
{
  ok('a single unclaimed slot says so',
    signupSummary([{ id: 'a', label: 'Snacks' }]) === 'Unclaimed');
  ok('a single claimed slot says so',
    signupSummary([{ id: 'a', claimedBy: 'x' }]) === 'Claimed');
  ok('none of several', signupSummary([{ id: 'a' }, { id: 'b' }]) === 'Nobody yet');
  ok('some of several',
    signupSummary([{ id: 'a', claimedBy: 'x' }, { id: 'b' }]) === '1 of 2 filled');
  ok('all of several',
    signupSummary([{ id: 'a', claimedBy: 'x' }, { id: 'b', claimedBy: 'y' }]) === 'All filled');
  ok('no slots is nothing to say', signupSummary([]) === null);
}

console.log('\nGrouping and the schedule row');
{
  const slots = [
    { id: 'snacks-1', label: 'Snacks', position: 1, of: 2, claimedBy: 'x' },
    { id: 'snacks-2', label: 'Snacks', position: 2, of: 2 },
    { id: 'drinks-1', label: 'Drinks', claimedBy: 'y' },
  ];
  const groups = groupSlots(slots);
  ok('grouped by what they are for', groups.length === 2);
  ok('and summarised', groups[0].label === 'Snacks' && groups[0].summary === '1 of 2 filled');
  ok('each group is in slot order',
    groups[0].slots.map((s) => s.id).join() === 'snacks-1,snacks-2');

  // An open slot is the only actionable state, so it leads.
  ok('the schedule line leads with what still needs someone',
    scheduleLine(slots) === 'Snacks: 1 of 2 filled');
  ok('all filled still reports',
    scheduleLine([{ id: 'a', label: 'Snacks', claimedBy: 'x' }]) === 'Snacks: Claimed');
  ok('no sign-ups, no line', scheduleLine([]) === null && scheduleLine(null) === null);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

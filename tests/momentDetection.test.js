/**
 * momentDetection.test.js — When a celebration banner should fire.
 */

import { findNewMoment } from '../src/shared/momentDetection.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

const describeHR = (event) => (event.type === 'HOME_RUN' ? { text: 'HOME RUN!', tone: 'big' } : null);

group('First load never replays history');
{
  const events = [
    { seq: 1, type: 'SINGLE' },
    { seq: 2, type: 'HOME_RUN' },
    { seq: 3, type: 'STRIKEOUT' },
  ];
  const { moment, seq } = findNewMoment(events, null, describeHR);
  ok('no banner for a home run that already happened before this device opened the game',
    moment === null);
  ok('the watermark adopts the current end of the log', seq === 3);
}

group('A genuinely new event fires');
{
  const events = [{ seq: 1, type: 'SINGLE' }, { seq: 2, type: 'HOME_RUN' }];
  const { moment, seq } = findNewMoment(events, 1, describeHR);
  ok('the new home run is detected', moment?.text === 'HOME RUN!');
  ok('the watermark advances past it', seq === 2);
}

group('A new event that is not notable produces no banner, but still advances the watermark');
{
  const events = [{ seq: 1, type: 'HOME_RUN' }, { seq: 2, type: 'SINGLE' }];
  const { moment, seq } = findNewMoment(events, 1, describeHR);
  ok('a plain single is not a moment', moment === null);
  ok('the watermark still moves so this single is not re-checked next time', seq === 2);
}

group('Nothing new at all');
{
  const events = [{ seq: 1, type: 'HOME_RUN' }];
  const { moment, seq } = findNewMoment(events, 1, describeHR);
  ok('no banner when the watermark is already caught up', moment === null);
  ok('the watermark is unchanged', seq === 1);
}

group('Several events arrive between renders — the most recent notable one wins');
{
  const describeBoth = (e) => (e.type === 'HOME_RUN' ? { text: 'HOME RUN!' }
    : e.type === 'STRIKEOUT' ? { text: 'STRIKEOUT!' } : null);
  const events = [
    { seq: 1, type: 'SINGLE' },
    { seq: 2, type: 'HOME_RUN' },
    { seq: 3, type: 'SINGLE' },
    { seq: 4, type: 'STRIKEOUT' },
  ];
  const { moment } = findNewMoment(events, 1, describeBoth);
  ok('the LATER notable event wins, not the first',
    moment?.text === 'STRIKEOUT!');
}

group('A voided event is never celebrated');
{
  const events = [{ seq: 2, type: 'HOME_RUN', voided: true }];
  const { moment, seq } = findNewMoment(events, 1, describeHR);
  ok('a corrected-away home run does not fire a banner', moment === null);
  // The voided event still existed, so the watermark should still move past
  // its seq rather than getting stuck re-examining it forever.
  ok('the watermark still advances', seq === 1);
}

group('state and extras pass through untouched');
{
  const seen = [];
  const spy = (event, state, extras) => { seen.push({ event, state, extras }); return null; };
  const fakeState = { fouledOut: ['p1'] };
  const fakeExtras = { personFor: () => null };
  findNewMoment([{ seq: 1, type: 'X' }], 0, spy, fakeState, fakeExtras);
  ok('the callback receives the exact state object', seen[0]?.state === fakeState);
  ok('and the exact extras object', seen[0]?.extras === fakeExtras);
}

group('Edges');
ok('an empty event list on first load does not throw', findNewMoment([], null, describeHR).seq === 0);
ok('undefined events does not throw', findNewMoment(undefined, null, describeHR).seq === 0);
ok('no describeMoment function does not throw', findNewMoment([{ seq: 1, type: 'HOME_RUN' }], 0, undefined).moment === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

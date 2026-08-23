/**
 * accountSummary.test.js — What the Account panel says about you.
 */

import {
  signInMethods, memberSince, linkedPlayerCount, linkedPlayerLabel,
} from '../src/shared/accountSummary.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};

console.log('\nHow you sign in');
{
  ok('email and password is named for what you type',
    signInMethods({ providerData: [{ providerId: 'password' }] })[0] === 'Email & password');
  ok('providers are named, not idented',
    signInMethods({ providerData: [{ providerId: 'google.com' }] })[0] === 'Google');
  ok('two linked methods are both listed',
    signInMethods({ providerData: [{ providerId: 'password' }, { providerId: 'facebook.com' }] })
      .join(', ') === 'Email & password, Facebook');
  ok('the same method twice is one way in',
    signInMethods({ providerData: [{ providerId: 'google.com' }, { providerId: 'google.com' }] })
      .length === 1);
  ok('an unknown provider falls back to its id',
    signInMethods({ providerData: [{ providerId: 'github.com' }] })[0] === 'github.com');
  ok('no account is no methods', signInMethods(null).length === 0);
}

console.log('\nMember since');
{
  const march = new Date('2026-03-14T12:00:00Z');
  ok('a Firestore timestamp reads as a month and year',
    memberSince({ createdAt: { toDate: () => march } }, null) === 'March 2026');
  ok('the account document wins over the auth record',
    memberSince({ createdAt: { toDate: () => march } },
      { metadata: { creationTime: '2020-01-01' } }) === 'March 2026');
  ok('the auth record is the fallback',
    memberSince(null, { metadata: { creationTime: march.toISOString() } }) === 'March 2026');
  ok('nothing at all is null, not "Invalid Date"', memberSince(null, null) === null);
  ok('an unparseable date is null', memberSince({ createdAt: 'whenever' }, null) === null);
}

console.log('\nLinked players');
{
  // The same child on two teams is ONE child — that is what a player id is for.
  const byTeam = {
    spring: [{ playerId: 'p1', firstName: 'Jack' }],
    fall: [{ playerId: 'p1', firstName: 'Jack' }, { playerId: 'p2', firstName: 'Maya' }],
  };
  ok('counted by id, not by row', linkedPlayerCount(byTeam) === 2);
  ok('nothing linked is zero', linkedPlayerCount({}) === 0 && linkedPlayerCount(null) === 0);
  ok('a team with no linked players is skipped', linkedPlayerCount({ t: [] }) === 0);
  ok('one is singular', linkedPlayerLabel(1) === '1 player');
  ok('more is plural', linkedPlayerLabel(3) === '3 players');
  ok('none says so in words', linkedPlayerLabel(0) === 'No players linked yet');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

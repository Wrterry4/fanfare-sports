/**
 * teamInvites.test.js — Invitations addressed to a person.
 */

import {
  TEAM_INVITE_STATUS, teamInviteId, pendingTeamInvites, inviteWording,
} from '../src/shared/teamInvites.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};

console.log('\nOne invite per person per player per team');
{
  ok('the id is derived, not random',
    teamInviteId('t1', 'p1') === teamInviteId('t1', 'p1'));
  ok('different players are different invites',
    teamInviteId('t1', 'p1') !== teamInviteId('t1', 'p2'));
  ok('different teams are different invites',
    teamInviteId('t1', 'p1') !== teamInviteId('t2', 'p1'));
  ok('an invite with no player still has an id', !!teamInviteId('t1', null));
}

console.log('\nWhat the menu shows');
{
  const list = [
    { id: 'a', status: 'accepted', createdAt: '2026-08-01' },
    { id: 'b', status: 'pending', createdAt: '2026-08-01' },
    { id: 'c', status: 'declined', createdAt: '2026-08-03' },
    { id: 'd', status: 'pending', createdAt: '2026-08-05' },
    // Written before the field existed, or mid-write.
    { id: 'e', createdAt: '2026-07-01' },
  ];
  const out = pendingTeamInvites(list);
  ok('answered invites drop out', !out.some((i) => ['a', 'c'].includes(i.id)));
  ok('a missing status counts as pending', out.some((i) => i.id === 'e'));
  ok('newest first', out.map((i) => i.id).join(',') === 'd,b,e');
  ok('nothing is not a crash', pendingTeamInvites(null).length === 0);
  ok('the statuses are the ones the function writes',
    TEAM_INVITE_STATUS.PENDING === 'pending'
    && TEAM_INVITE_STATUS.ACCEPTED === 'accepted'
    && TEAM_INVITE_STATUS.DECLINED === 'declined');
}

console.log('\nThe wording, shared by the push and the menu row');
{
  const w = inviteWording({ teamName: 'Fall Reds', season: 'Fall 2026', playerFirstName: 'Jack' });
  ok('the push names the child and the team',
    w.body.includes('Jack') && w.body.includes('Fall Reds'));
  ok('the row leads with the team', w.rowTitle === 'Fall Reds');
  ok('the row explains why they got it', w.rowSub.includes('Jack'));

  // A guardian link with no readable first name still has to say something.
  const bare = inviteWording({});
  ok('a missing team degrades', bare.body.includes('a team'));
  ok('a missing child degrades', bare.body.startsWith('Your player'));
  ok('the title is constant', bare.title === 'Team invite' && w.title === 'Team invite');
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

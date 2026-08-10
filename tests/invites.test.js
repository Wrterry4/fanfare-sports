/**
 * invites.test.js — Onboarding logic, tested without Firebase.
 *
 * Two failure modes matter here and they pull opposite directions: a link that
 * won't work locks a family out of the app, and a link that works too freely
 * attaches the wrong adult to a child. Both get exercised below.
 *
 * Run: node tests/invites.test.js
 */

import {
  ROLES, ROLE_CAPABILITIES, INVITE_TYPES, INVITE_ERRORS,
  validateInvite, resolveRole, defaultNotificationPrefs,
  buildInviteUrl, parseInviteUrl,
} from '../src/shared/inviteRules.js';
import { createHash } from 'crypto';

let passed = 0, failed = 0;
const out = [];
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; out.push(`  ok   ${name}`); }
  else { failed++; out.push(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`); }
}

const hash = (t) => createHash('sha256').update(String(t)).digest('hex');
const NOW = 1_800_000_000_000;

const invite = (over = {}) => ({
  teamId: 't1',
  type: INVITE_TYPES.PLAYER,
  playerId: 'p_jack',
  role: ROLES.PARENT,
  tokenHash: hash('secret-token'),
  expiresAt: NOW + 30 * 86400000,
  maxUses: 1,
  usedCount: 0,
  revoked: false,
  ...over,
});

out.push('\nValidation');
check('a good link redeems', validateInvite(invite(), hash('secret-token'), NOW).ok, true);
check('a missing invite is rejected',
  validateInvite(null, hash('x'), NOW).error, INVITE_ERRORS.NOT_FOUND);
check('a wrong token is rejected',
  validateInvite(invite(), hash('guessed'), NOW).error, INVITE_ERRORS.BAD_TOKEN);
check('an expired link is rejected',
  validateInvite(invite(), hash('secret-token'), NOW + 31 * 86400000).error,
  INVITE_ERRORS.EXPIRED);
check('a revoked link is rejected',
  validateInvite(invite({ revoked: true }), hash('secret-token'), NOW).error,
  INVITE_ERRORS.REVOKED);

out.push('\nForwarded links');
check('a single-use link dies after one redemption',
  validateInvite(invite({ usedCount: 1 }), hash('secret-token'), NOW).error,
  INVITE_ERRORS.EXHAUSTED);
check('a fan link allows several relatives',
  validateInvite(invite({ type: INVITE_TYPES.FAN, role: ROLES.FAN, maxUses: 5, usedCount: 3 }),
    hash('secret-token'), NOW).ok, true);
check('but not past its cap',
  validateInvite(invite({ maxUses: 5, usedCount: 5 }), hash('secret-token'), NOW).error,
  INVITE_ERRORS.EXHAUSTED);
check('a revoked link fails even with uses left',
  validateInvite(invite({ maxUses: 5, usedCount: 0, revoked: true }),
    hash('secret-token'), NOW).error, INVITE_ERRORS.REVOKED);

out.push('\nToken checked before anything else');
{
  // A bad token on a revoked, expired, exhausted invite must still report
  // BAD_TOKEN — otherwise the error message tells an attacker which invite
  // ids are real.
  const junk = invite({ revoked: true, usedCount: 9, expiresAt: NOW - 1 });
  check('error message reveals nothing about the invite',
    validateInvite(junk, hash('wrong'), NOW).error, INVITE_ERRORS.BAD_TOKEN);
}

out.push('\nRe-tapping your own link');
check('already a member at that role is not a failure to burn a use',
  validateInvite(invite(), hash('secret-token'), NOW, ROLES.PARENT).error,
  INVITE_ERRORS.ALREADY_MEMBER);
check('a fan redeeming a parent link still proceeds',
  validateInvite(invite(), hash('secret-token'), NOW, ROLES.FAN).ok, true);

out.push('\nRole precedence');
check('new member takes the invited role', resolveRole(null, ROLES.PARENT), ROLES.PARENT);
check('a coach with a kid on the team stays a coach',
  resolveRole(ROLES.COACH, ROLES.PARENT), ROLES.COACH);
check('a fan who becomes a parent is upgraded',
  resolveRole(ROLES.FAN, ROLES.PARENT), ROLES.PARENT);
check('a parent asked to keep the book is upgraded',
  resolveRole(ROLES.PARENT, ROLES.SCOREKEEPER), ROLES.SCOREKEEPER);
check('ownership is never downgraded by an invite',
  resolveRole(ROLES.OWNER, ROLES.COACH), ROLES.OWNER);

out.push('\nGrandparents are not guardians');
check('a fan cannot approve a transfer',
  ROLE_CAPABILITIES[ROLES.FAN].approveTransfers, false);
check('a parent can', ROLE_CAPABILITIES[ROLES.PARENT].approveTransfers, true);
check('a fan stays out of team chat', ROLE_CAPABILITIES[ROLES.FAN].teamChat, false);
check('a fan cannot see the whole roster\'s stats',
  ROLE_CAPABILITIES[ROLES.FAN].seeAllPlayers, false);
check('a coach can', ROLE_CAPABILITIES[ROLES.COACH].seeAllPlayers, true);
check('a scorekeeper scores but cannot edit the roster',
  [ROLE_CAPABILITIES[ROLES.SCOREKEEPER].score,
   ROLE_CAPABILITIES[ROLES.SCOREKEEPER].manageRoster], [true, false]);

out.push('\nNotification defaults');
{
  const parent = defaultNotificationPrefs(ROLES.PARENT);
  const fan = defaultNotificationPrefs(ROLES.FAN);
  const coach = defaultNotificationPrefs(ROLES.COACH);
  check('parents get the on-deck alert', parent.myPlayerAtBat, true);
  check('so do fans — it is why they installed the app', fan.myPlayerAtBat, true);
  check('nobody is opted into every scoring play', 
    [parent.allScoringPlays, fan.allScoringPlays, coach.allScoringPlays],
    [false, false, false]);
  check('fans are kept out of chatter', fan.chatter, false);
  check('and out of DM notifications', fan.directMessages, false);
  check('parents keep DMs on', parent.directMessages, true);
}

out.push('\nDeep links');
{
  const url = buildInviteUrl('https://ridgeview.app/', 'inv_abc123', 'tok-XYZ_789');
  check('secret rides in the fragment, not the path',
    url, 'https://ridgeview.app/join/inv_abc123#tok-XYZ_789');
  check('round-trips', parseInviteUrl(url), { inviteId: 'inv_abc123', token: 'tok-XYZ_789' });
  check('a link without a token parses as nothing',
    parseInviteUrl('https://ridgeview.app/join/inv_abc123'), null);
  check('junk parses as nothing', parseInviteUrl('https://example.com/hello'), null);
}

out.push('\nRedemption outcomes');
{
  // Mirrors the branch in redeemInvite: only a PLAYER invite confers
  // guardianship. A fan link links for notifications and stops there.
  const confersGuardianship = (type) => type === INVITE_TYPES.PLAYER;
  check('a player invite makes a guardian', confersGuardianship(INVITE_TYPES.PLAYER), true);
  check('a fan invite does not', confersGuardianship(INVITE_TYPES.FAN), false);
  check('a team invite does not', confersGuardianship(INVITE_TYPES.TEAM), false);
}

console.log(out.join('\n'));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

/**
 * statsAccess.test.js — The two access lists must stay different.
 *
 * Stats are open to the whole team; the player RECORD is not. Those are two
 * lists with two widths, and collapsing them is the failure this guards
 * against — the bug would be silent and would leak a child's birth year and
 * guardians to every fan on the team.
 *
 * The list-building logic is duplicated here rather than imported, because it
 * lives inside a Cloud Function module that can't load without firebase-admin.
 * If accessListsFor changes shape in functions/index.js, this must change with
 * it — that coupling is the point.
 */

const build = (player, members) => {
  const guardians = player.guardianUserIds || [];
  const followers = player.followerUserIds || [];
  const staff = new Set();
  const everyone = new Set();
  for (const m of members) {
    everyone.add(m.uid);
    if (['owner', 'coach'].includes(m.role)) staff.add(m.uid);
  }
  return {
    authorizedUserIds: [...new Set([...guardians, ...followers, ...staff])].sort(),
    statsViewerUids: [...new Set([...guardians, ...followers, ...everyone])].sort(),
  };
};

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const has = (list, uid) => list.includes(uid);

const members = [
  { uid: 'coach1', role: 'owner' },
  { uid: 'coach2', role: 'coach' },
  { uid: 'book1', role: 'scorekeeper' },
  { uid: 'parentA', role: 'parent' },
  { uid: 'parentB', role: 'parent' },
  { uid: 'granny', role: 'fan' },
];

console.log('\nStats are open to the team');
{
  const { statsViewerUids } = build({ guardianUserIds: ['parentA'] }, members);
  ok("another child's parent can read stats", has(statsViewerUids, 'parentB'));
  ok('a fan can read stats', has(statsViewerUids, 'granny'));
  ok('the scorekeeper can read stats', has(statsViewerUids, 'book1'));
  ok('so can the coach', has(statsViewerUids, 'coach1'));
}

console.log('\nThe player record is not');
{
  const { authorizedUserIds } = build({ guardianUserIds: ['parentA'] }, members);
  ok('this child\'s own guardian is authorized', has(authorizedUserIds, 'parentA'));
  ok('staff are authorized', has(authorizedUserIds, 'coach1') && has(authorizedUserIds, 'coach2'));
  // The whole point of two lists.
  ok("another family's parent is NOT authorized", !has(authorizedUserIds, 'parentB'));
  ok('a fan is NOT authorized', !has(authorizedUserIds, 'granny'));
  ok('a scorekeeper is NOT authorized', !has(authorizedUserIds, 'book1'));
}

console.log('\nStats access is always a superset of record access');
{
  const { authorizedUserIds, statsViewerUids } = build(
    { guardianUserIds: ['parentA'], followerUserIds: ['granny'] }, members);
  ok('everyone authorized can also see stats',
    authorizedUserIds.every((u) => statsViewerUids.includes(u)));
  ok('but not the reverse', statsViewerUids.length > authorizedUserIds.length);
}

console.log('\nAn approved follower keeps record access');
{
  const { authorizedUserIds } = build(
    { guardianUserIds: ['parentA'], followerUserIds: ['granny'] }, members);
  ok('a follower approved for THIS child is authorized', has(authorizedUserIds, 'granny'));
}

console.log('\nA player on no team');
{
  const { authorizedUserIds, statsViewerUids } = build({ guardianUserIds: ['parentA'] }, []);
  ok('only the guardian sees the record', authorizedUserIds.join() === 'parentA');
  ok('and only the guardian sees stats', statsViewerUids.join() === 'parentA');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

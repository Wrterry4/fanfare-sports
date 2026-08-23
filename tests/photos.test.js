/**
 * photos.test.js — Posted in chat, collected in an album.
 */

import {
  photoStoragePath, extensionFor, groupPhotosByDay, photoCountLabel, canDeletePhoto,
} from '../src/shared/photos.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};

console.log('\nWhere the file goes');
{
  // teams/{id}/media is the path the storage rules already open to members.
  ok('under the team\'s media path',
    photoStoragePath('t1', 'photo-abc') === 'teams/t1/media/photo-abc.jpg');
  ok('the extension follows the type',
    photoStoragePath('t1', 'p', 'png').endsWith('.png'));
  ok('jpeg for photographs', extensionFor('image/jpeg') === 'jpg');
  ok('png keeps its transparency', extensionFor('image/png') === 'png');
  ok('a gif stays a gif', extensionFor('image/gif') === 'gif');
  ok('an unknown type falls back to jpg', extensionFor(null) === 'jpg');
}

console.log('\nThe album reads like a camera roll');
{
  const now = new Date(2026, 7, 22, 18, 0);
  const at = (d, h = 12) => new Date(2026, 7, d, h);
  const photos = [
    { id: 'a', createdAt: at(22, 9) },
    { id: 'b', createdAt: at(22, 17) },
    { id: 'c', createdAt: at(21) },
    { id: 'd', createdAt: at(18) },
    { id: 'e', createdAt: new Date(2026, 5, 1) },
  ];
  const groups = groupPhotosByDay(photos, now);
  ok('one group per day', groups.length === 4);
  ok('today is named, not dated', groups[0].label === 'Today');
  ok('newest photo first within the day', groups[0].photos[0].id === 'b');
  ok('yesterday is named too', groups[1].label === 'Yesterday');
  ok('this week is a weekday name', groups[2].label === 'Tuesday');
  ok('older is a real date', /June/.test(groups[3].label));
  ok('nothing is no groups', groupPhotosByDay(null, now).length === 0);
  ok('a photo with no date still lands somewhere',
    groupPhotosByDay([{ id: 'x' }], now)[0].label === 'Earlier');
}

console.log('\nCounts and deletion');
{
  ok('none says so in words', photoCountLabel(0) === 'No photos yet');
  ok('one is singular', photoCountLabel(1) === '1 photo');
  ok('more are plural', photoCountLabel(12) === '12 photos');

  const mine = { uploadedBy: 'me' };
  const theirs = { uploadedBy: 'them' };
  ok('I can delete my own', canDeletePhoto(mine, 'me'));
  ok("I cannot delete someone else's", !canDeletePhoto(theirs, 'me'));
  // The one thing a coach must be able to do without waiting for the poster.
  ok('a coach can take any photo down', canDeletePhoto(theirs, 'me', true));
  ok('signed out deletes nothing', !canDeletePhoto(mine, null, true));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

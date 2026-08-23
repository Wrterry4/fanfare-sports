/**
 * photos.js — Posted in chat, collected in an album.
 *
 * One photo is one document in teams/{teamId}/photos, and posting it in chat
 * writes a message that POINTS at that document. The album is the same
 * collection read directly.
 *
 * That's the whole design, and it's the reason the album needs no separate
 * upload flow: there is only one place a photo can come from, so there is only
 * one path to get wrong. A photo deleted from chat is gone from the album too,
 * because they were never two things.
 *
 * Storage costs real money past 5GB, so the client resizes before upload —
 * see services/photoService.web.js. Nothing here does image work; this is the
 * naming and grouping the two views share.
 */

/**
 * Where the file lives.
 *
 * Under teams/{teamId}/media/ because that is the path the storage rules
 * already open to team members and close to everyone else — a new path would
 * mean a new rule that has to be kept in step with this one.
 */
export const photoStoragePath = (teamId, photoId, ext = 'jpg') =>
  `teams/${teamId}/media/${photoId}.${ext}`;

/** jpeg for photographs, png only when something needs the transparency. */
export const extensionFor = (mime) => {
  if (!mime) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
};

const millis = (v) => {
  if (!v) return 0;
  if (typeof v.toDate === 'function') return v.toDate().getTime() || 0;
  if (typeof v.toMillis === 'function') return v.toMillis() || 0;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
};

/**
 * Newest first, then grouped by the day they were posted.
 *
 * By day rather than by game: tagging photos to a game is a real feature and
 * this isn't it. A date heading is honest about what the app actually knows.
 */
export function groupPhotosByDay(photos, now = new Date()) {
  const sorted = [...(photos || [])].sort((a, b) => millis(b.createdAt) - millis(a.createdAt));

  const groups = [];
  let current = null;

  for (const p of sorted) {
    const key = dayKey(p.createdAt);
    if (!current || current.key !== key) {
      current = { key, label: dayLabel(p.createdAt, now), photos: [] };
      groups.push(current);
    }
    current.photos.push(p);
  }
  return groups;
}

const dayKey = (v) => {
  const ms = millis(v);
  if (!ms) return 'unknown';
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** "Today", "Yesterday", then a real date — the way a person reads a camera roll. */
function dayLabel(v, now = new Date()) {
  const ms = millis(v);
  if (!ms) return 'Earlier';
  const d = new Date(ms);
  const days = Math.round(
    (startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined,
    sameYear ? { month: 'long', day: 'numeric' }
             : { month: 'long', day: 'numeric', year: 'numeric' });
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "24 photos" — the count on the button that opens the album. */
export const photoCountLabel = (n) =>
  n === 0 ? 'No photos yet' : `${n} photo${n === 1 ? '' : 's'}`;

/**
 * Only the person who posted it, or a coach.
 *
 * Team chat is not a moderated space and doesn't need to be, but a photo of
 * somebody's child is the one thing a coach has to be able to take down
 * without waiting for whoever posted it to wake up.
 */
export const canDeletePhoto = (photo, uid, isStaff = false) =>
  !!uid && (photo?.uploadedBy === uid || !!isStaff);

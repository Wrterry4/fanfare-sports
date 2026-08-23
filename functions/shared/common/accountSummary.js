/**
 * accountSummary.js — The facts about an account, in the words a person uses.
 *
 * Firebase describes an account in its own vocabulary: providerId strings like
 * "google.com", a creationTime that's an RFC-1123 string, an array of
 * providerData entries. None of that belongs in a menu, and none of it should
 * be formatted inline in a component where the next screen that needs it will
 * format it slightly differently.
 */

/**
 * How each sign-in method is named to the person using it.
 *
 * "Password" is what Firebase calls the email/password provider, which reads
 * as a security setting rather than a way in — so it's named for what the
 * person actually typed.
 */
const PROVIDER_LABELS = {
  'password': 'Email & password',
  'google.com': 'Google',
  'facebook.com': 'Facebook',
  'apple.com': 'Apple',
  'phone': 'Phone number',
};

export function signInMethods(user) {
  const ids = (user?.providerData || [])
    .map((p) => p?.providerId)
    .filter(Boolean);
  // Firebase lists a provider once per linked credential; the same method
  // twice is not two ways in.
  return [...new Set(ids)].map((id) => PROVIDER_LABELS[id] || id);
}

/**
 * "Member since March 2026".
 *
 * The month, not the day: it's a fact about the relationship, not a receipt,
 * and a full date invites the reader to check it against something.
 *
 * Takes the account document's createdAt first and the auth record's
 * creationTime second — the document is what the app wrote, and it's the one
 * that survives if the auth account is ever recreated.
 */
export function memberSince(userDoc, authUser) {
  const raw = userDoc?.createdAt ?? authUser?.metadata?.creationTime ?? null;
  const date = toDate(raw);
  if (!date) return null;
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') { const d = v.toDate(); return isNaN(d) ? null : d; }
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

/**
 * How many children this account is linked to, counted by player id.
 *
 * By id, because the same child on a spring team and a fall team is one child
 * — that is the entire point of a player having one id — and "2 players" for
 * one kid would be a lie the menu tells about the data model.
 */
export function linkedPlayerCount(byTeam) {
  const ids = new Set();
  for (const players of Object.values(byTeam || {})) {
    for (const p of players || []) if (p?.playerId) ids.add(p.playerId);
  }
  return ids.size;
}

/** "1 player" / "3 players" / "No players linked yet". */
export const linkedPlayerLabel = (count) =>
  count === 0 ? 'No players linked yet' : `${count} player${count === 1 ? '' : 's'}`;

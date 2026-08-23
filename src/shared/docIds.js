/**
 * docIds.js — Document ids you can read.
 *
 * Firestore's auto-id is 20 random characters, and it's random for a good
 * reason: ids generated on thousands of offline clients must never collide,
 * and sequential ids hot-spot a single storage range under load. Neither
 * concern applies to a youth sports team writing a game a week, and the cost
 * is real — every debugging session, every rules test, every support question
 * starts by pasting `k3Jd8sPqR2xN1vB7` into the console to find out what it is.
 *
 * So: readable ids where the name is naturally unique, auto-ids where it isn't.
 *
 * ── The rules ──────────────────────────────────────────────────────────────
 *
 *   DERIVED, when the document has one natural identity. A team's game on a
 *   date against an opponent is one game: `2026-08-22-vs-hurricanes`. Writing
 *   it twice is a duplicate, and a derived id makes that a no-op instead of a
 *   second document — which is a correctness win, not only a legibility one.
 *
 *   PREFIXED-RANDOM, when there is no natural key but you still want to know
 *   what you're looking at: `poll-4f2a91`. Six hex characters is 16 million
 *   per prefix per collection, which is far past what a team will ever write.
 *
 *   AUTO-ID, for high-volume append-only streams — chat messages, game events.
 *   Thousands of documents where the id is never spoken aloud, and where
 *   Firestore's own scatter is worth having.
 *
 * ── What an id may never contain ───────────────────────────────────────────
 *
 * A child's name. Ids appear in logs, in error messages, in a coach's browser
 * history and in any screenshot of the console — none of which are places a
 * roster belongs. Derive ids from dates, opponents and types; never from a
 * person. That's why the player collection keeps auto-ids.
 *
 * Firestore also forbids `/`, ids of `.` or `..`, anything matching
 * `__.*__`, and anything over 1500 bytes. slug() removes all of them by
 * construction.
 */

/**
 * Lowercase, hyphenated, ASCII-safe.
 *
 * Accents are stripped rather than dropped so "Peñasco" stays "penasco"
 * instead of "peasco" — an id that quietly loses letters is worse than one
 * that never had them.
 */
export function slug(input, { max = 40 } = {}) {
  const base = (input ?? '').toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // é → e
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, max).replace(/-+$/g, '');
}

/** `2026-08-22`, in LOCAL time — the date the coach would call it. */
export function dateKey(value) {
  const d = value?.toDate?.() ?? (value ? new Date(value) : new Date());
  if (isNaN(d)) return dateKey(new Date());
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Join parts into an id, dropping the empty ones.
 *
 * Empty parts are dropped rather than rendered as a gap, because
 * `2026-08-22--vs` reads like something went wrong, and something did.
 */
export function joinId(...parts) {
  const out = parts.map((p) => slug(p)).filter(Boolean).join('-');
  // Nothing usable to derive from is a caller error, not an id: falling back
  // to a random id here would hide it until someone wondered why one document
  // in ten looks different.
  return out || null;
}

/**
 * `2026-08-22-vs-hurricanes` / `2026-08-22-at-hurricanes`.
 *
 * Home and away are in the id because the same two teams play twice a season
 * and the venue is how a coach tells those games apart.
 */
export const gameId = ({ date, opponent, homeOrAway = 'home' }) =>
  joinId(dateKey(date), homeOrAway === 'away' ? 'at' : 'vs', opponent || 'tbd');

/** `2026-08-22-practice`, `2026-09-01-team-photos`. */
export const eventId = ({ date, type = 'event', title }) =>
  joinId(dateKey(date), title || type);

/**
 * `poll-4f2a91` — a prefix so the id says what it is, and enough randomness
 * that two coaches posting at once can't collide.
 */
export function prefixedId(prefix, random = Math.random) {
  const hex = Math.floor(random() * 0xffffff).toString(16).padStart(6, '0');
  return `${slug(prefix) || 'doc'}-${hex}`;
}

/**
 * Two games really can share a natural id — a doubleheader against the same
 * opponent on the same day. The caller passes a `taken` test and gets
 * `...-2`, `...-3` rather than a silent overwrite.
 */
export async function uniqueId(base, taken) {
  if (!base) return null;
  if (!(await taken(base))) return base;
  for (let n = 2; n <= 20; n++) {
    const candidate = `${base}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  // Twenty games against one opponent on one day is not a doubleheader, it's
  // a bug — but returning null so the caller can fall back to an auto-id is
  // better than looping.
  return null;
}

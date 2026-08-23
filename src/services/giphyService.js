/**
 * giphyService.js — GIF search.
 *
 * ── A GIF is not a photo ───────────────────────────────────────────────────
 *
 * The album is where a parent scrolls for pictures of their kid. Reaction GIFs
 * are a different thing that happens to arrive through the same button, so
 * they are stored as a URL on the message and NOWHERE else: no Storage upload,
 * no photos document, no album tile. Giphy hosts the file; the app keeps a
 * link.
 *
 * That also makes them free. A GIF is often larger than the photos this app
 * carefully shrinks — uploading them would undo that work for content nobody
 * revisits.
 *
 * ── The rating ─────────────────────────────────────────────────────────────
 *
 * Pinned to `g`, not configurable. This is an app for youth sports teams where
 * the audience includes grandparents and, over any long enough period,
 * somebody's ten-year-old holding a parent's phone. Anything looser is a
 * decision nobody wants to have made.
 *
 * ── The key ────────────────────────────────────────────────────────────────
 *
 * Giphy's key is a client key by design and is bundled like every other
 * EXPO_PUBLIC_ value. Without one, isGiphyEnabled() is false and the button
 * never renders — the feature is absent rather than broken.
 */

const KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
const BASE = 'https://api.giphy.com/v1/gifs';
const LIMIT = 24;
const RATING = 'g';

export const isGiphyEnabled = () => !!KEY;

/**
 * Search, or the trending list when the box is empty — an empty grid teaches
 * nobody what to type.
 */
export async function searchGifs(term, { signal } = {}) {
  if (!KEY) return [];

  const q = (term || '').trim();
  const url = q
    ? `${BASE}/search?api_key=${KEY}&q=${encodeURIComponent(q)}&limit=${LIMIT}&rating=${RATING}&bundle=messaging_non_clips`
    : `${BASE}/trending?api_key=${KEY}&limit=${LIMIT}&rating=${RATING}&bundle=messaging_non_clips`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Could not reach Giphy.');
  const body = await res.json();

  return (body?.data || []).map(normalize).filter(Boolean);
}

/**
 * Two sizes, deliberately.
 *
 * `preview` is the downsized loop the grid shows — a wall of full-size GIFs
 * animating at once is what makes a picker janky on a phone. `url` is the one
 * that goes in the message.
 */
function normalize(g) {
  const full = g?.images?.downsized_medium || g?.images?.original;
  const preview = g?.images?.fixed_width_downsampled || g?.images?.preview_gif || full;
  if (!full?.url) return null;

  return {
    id: g.id,
    url: full.url,
    previewUrl: preview?.url || full.url,
    width: Number(full.width) || null,
    height: Number(full.height) || null,
    // Shown under the grid. Giphy's terms require attribution wherever their
    // results appear, and the picker is that place.
    title: g.title || '',
  };
}

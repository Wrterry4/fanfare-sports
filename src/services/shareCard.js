/**
 * shareCard.js — NATIVE. Share the result as text.
 *
 * The web build draws a real image on a canvas. Doing the same on native
 * needs react-native-view-shot plus a file-system round trip, which is a
 * dependency and a permissions surface for a feature the PWA is currently the
 * only shipping target for.
 *
 * The native share sheet handles text well, so this shares the same caption
 * the image carries. When native ships for real, this file gets the view-shot
 * implementation and nothing that calls it changes — same reason
 * audioStore/audioStore.web and firebase/firebase.web are split this way.
 */

import { Share } from 'react-native';

import { shareCaption } from '../shared/shareCaption.js';

/** @returns 'shared' | 'failed' */
export async function shareCard({ outcome, teamName, opponent }) {
  const { full } = shareCaption(outcome, teamName, opponent);
  try {
    await Share.share({ message: full });
    return 'shared';
  } catch { return 'failed'; }
}

export const shareCardSupported = () => true;

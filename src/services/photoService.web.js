/**
 * photoService.web.js — WEB. Picking, shrinking and uploading a photo.
 *
 * ── The resize is not an optimization ──────────────────────────────────────
 *
 * A modern phone camera produces 3–6MB per shot. Firebase's free Storage tier
 * is 5GB total and 1GB/day of egress — so one enthusiastic parent posting a
 * game's worth of photos costs more than a season of everything else the app
 * does, and every teammate pays for it again in download. Shrinking to 1600px
 * on the long edge at quality 0.82 lands around 250KB, which is
 * indistinguishable on a phone screen and roughly twenty times cheaper.
 *
 * Done on the client because the alternative is a Cloud Function that
 * downloads, resizes and re-uploads — three transfers to avoid one.
 *
 * GIFs are passed through untouched: re-encoding one through a canvas keeps
 * the first frame and throws away the animation, which is the entire point of
 * a GIF.
 */

import { storage, ref, uploadBytes, getDownloadURL } from './firebase';
import { photoStoragePath, extensionFor } from '../shared/photos.js';
import { prefixedId } from '../shared/docIds.js';
import { writePhotoDoc } from './photoShared.js';

export { subscribePhotos, deletePhoto, postPhotoMessage } from './photoShared.js';

export const photoPickingSupported = () =>
  typeof document !== 'undefined' && typeof FileReader !== 'undefined';

const MAX_EDGE = 1600;
const QUALITY = 0.82;
/** Before resizing. A 30MB raw file is a mistake, not a photo of a t-ball game. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/**
 * Opens the OS picker and resolves with the chosen File, or null if the person
 * backed out.
 *
 * The input is created, clicked and discarded rather than rendered: a hidden
 * <input type="file"> inside a React tree has to be kept in sync with which
 * button was pressed, and there are three of them.
 */
export function pickPhoto({ accept = 'image/*' } = {}) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    input.onchange = () => {
      const file = input.files?.[0] || null;
      input.remove();
      if (!file) { resolve(null); return; }
      if (file.size > MAX_INPUT_BYTES) {
        reject(new Error('That image is too large. Try one under 25MB.'));
        return;
      }
      resolve(file);
    };
    // Cancelling fires no event in most browsers, so nothing resolves and the
    // promise is simply dropped. The caller's `busy` flag is cleared by the
    // window regaining focus, which is the only signal a cancel gives.
    document.body.appendChild(input);
    input.click();
  });
}

/** Longest edge to MAX_EDGE, aspect preserved. Returns { blob, width, height }. */
async function shrink(file) {
  if (file.type?.includes('gif')) {
    const size = await imageSize(file).catch(() => ({ width: null, height: null }));
    return { blob: file, ...size };
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // PNG keeps its transparency; everything else becomes a jpeg, because a
  // photograph stored as PNG is several times the size for no visible gain.
  const type = file.type?.includes('png') ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((res) => canvas.toBlob(res, type, QUALITY));
  return { blob: blob || file, width, height, type };
}

function imageSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not an image.')); };
    img.src = url;
  });
}

/**
 * File in, photo document out.
 *
 * The Storage upload happens first and the document second, deliberately: a
 * document pointing at a file that failed to upload is a broken tile in the
 * album, while a file with no document is invisible and costs a few hundred
 * kilobytes.
 */
export async function uploadPhoto({ teamId, user, file }) {
  const { blob, width, height, type } = await shrink(file);
  const photoId = prefixedId('photo');
  const ext = extensionFor(type || file.type);
  const path = photoStoragePath(teamId, photoId, ext);

  await uploadBytes(ref(storage, path), blob, {
    contentType: type || file.type || 'image/jpeg',
    // Photos never change once uploaded, so a long cache is free speed for
    // every teammate who opens the album twice.
    cacheControl: 'public, max-age=31536000, immutable',
  });

  const url = await getDownloadURL(ref(storage, path));

  const data = {
    url,
    storagePath: path,
    width: width ?? null,
    height: height ?? null,
    bytes: blob.size ?? null,
    uploadedBy: user.uid,
    uploadedByName: user.displayName || null,
    messageId: null,
    channel: null,
  };
  await writePhotoDoc({ teamId, photoId, data });

  return { id: photoId, ...data };
}

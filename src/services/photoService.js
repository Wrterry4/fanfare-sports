/**
 * photoService.js — NATIVE. Picking and uploading a photo.
 *
 * Not available here yet, for the same reason as social sign-in: a photo
 * picker is a native module. expo-image-picker (or react-native-image-picker)
 * needs to be installed and configured with the photo-library permission
 * strings in the iOS and Android projects, and it isn't.
 *
 * Reading the album works everywhere — that's just Firestore — so this file
 * only stubs the parts that need a camera roll. The chat's attach button hides
 * itself when picking isn't supported rather than failing on tap.
 */

export const photoPickingSupported = () => false;

export async function pickPhoto() {
  throw new Error('Adding photos is available on the web app for now.');
}

export async function uploadPhoto() {
  throw new Error('Adding photos is available on the web app for now.');
}

export {
  subscribePhotos, deletePhoto, postPhotoMessage, postGifMessage,
} from './photoShared.js';

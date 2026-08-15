/**
 * audioStore.js — NATIVE stub.
 *
 * The web build uses audioStore.web.js (IndexedDB + HTML Audio). On native
 * this becomes expo-av plus expo-file-system, which isn't wired up yet — the
 * PWA is the target for now. Exporting no-ops keeps the shared screens
 * compiling for a native build without pretending the feature works.
 */

export const audioSupported = () => false;
export const saveClip = async () => {};
export const deleteClip = async () => {};
export const getClip = async () => null;
export const listClipIds = async () => [];
export const hasClip = async () => false;
export const playClip = async () => false;
export const stopClip = () => {};
export const isPlaying = () => false;
export const probeDuration = async () => 0;
export const storageUsed = async () => 0;

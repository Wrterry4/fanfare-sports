/**
 * useBottomInset.js — NATIVE.
 *
 * The OS reports this correctly and immediately, so there's nothing to do but
 * pass it through. See useBottomInset.web.js for why the browser needs more.
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useBottomInset() {
  return useSafeAreaInsets().bottom;
}

/**
 * useBottomInset.web.js — WEB.
 *
 * ── Why not just use useSafeAreaInsets() ────────────────────────────────────
 *
 * On an installed iOS PWA it reports 0 on the first paint and only settles to
 * the real value (34 on a device with a home indicator) some frames later. A
 * tab bar sized from that first value has its labels under the indicator, so
 * the previous code floored it at a hard-coded 20 — which is wrong in both
 * directions: too little on an iPhone with an indicator, and 20px of dead
 * space on hardware that has no inset at all.
 *
 * `env(safe-area-inset-bottom)` is correct as soon as CSS resolves, but a
 * React Native style object takes numbers, not CSS expressions. So
 * finalize-web.mjs publishes it as `--safe-bottom` on :root, and this reads it
 * back as a real pixel value.
 *
 * Re-measured on resize and orientation change, because the inset differs
 * between portrait and landscape and the bar has to follow.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function readSafeBottom() {
  if (typeof window === 'undefined' || !window.getComputedStyle) return null;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--safe-bottom');
  if (!raw) return null;
  const px = parseFloat(raw);
  return Number.isFinite(px) ? px : null;
}

export function useBottomInset() {
  // Kept as the fallback for anything serving the app without the injected
  // stylesheet — `expo start --web` in a plain browser tab, mainly.
  const contextInset = useSafeAreaInsets().bottom;
  const [measured, setMeasured] = useState(readSafeBottom);

  useEffect(() => {
    const update = () => setMeasured(readSafeBottom());

    // The value can be 0 on the very first frame even in CSS. One more read
    // after paint catches the settled number without a polling loop.
    const raf = requestAnimationFrame(update);

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // A measured 0 is meaningful — plenty of devices genuinely have no bottom
  // inset — so only fall through when the property is absent entirely.
  return measured === null ? contextInset : measured;
}

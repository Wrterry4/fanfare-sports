/**
 * haptics.web.js — Browser fallback.
 *
 * The Vibration API works on Android Chrome. iOS Safari does NOT implement it
 * and never has — so iPhone users get no tactile confirmation on a tap, and
 * there's no workaround.
 *
 * That's a real, if small, loss for scorekeeping: the point of haptics was
 * confirming a tap registered without looking down. The visual press state on
 * the buttons has to carry that job alone on iOS.
 */

const canVibrate = () =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export const tapLight  = () => { if (canVibrate()) navigator.vibrate(8); };
export const tapMedium = () => { if (canVibrate()) navigator.vibrate(14); };
export const hapticsAvailable = () => canVibrate();

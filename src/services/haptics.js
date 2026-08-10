/** haptics.js — NATIVE. Real Taptic Engine feedback. */
import * as Haptics from 'expo-haptics';

export const tapLight  = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
export const tapMedium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
export const hapticsAvailable = () => true;

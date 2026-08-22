/**
 * stadiumSounds.js — NATIVE stub.
 *
 * The web build synthesizes built-in sounds with the Web Audio API and plays
 * custom clips back via audioStore.web.js. Neither exists natively yet — see
 * audioStore.js for the same gap on walk-up songs. Exporting no-ops keeps the
 * soundboard sheet compiling on a native build without pretending it works.
 */

export const soundboardSupported = () => false;
export const playSound = async () => false;

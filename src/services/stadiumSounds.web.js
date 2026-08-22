/**
 * stadiumSounds.web.js — The soundboard's playback engine.
 *
 * ── Two sources, one function ────────────────────────────────────────────
 *
 * playSound(id) is the only thing a caller needs. It looks the id up in the
 * catalog (soundboardCatalog.js) and either synthesizes a built-in effect
 * with the Web Audio API, or plays back a coach's own recording from
 * IndexedDB — reusing the exact blob-playback path audioStore.web.js already
 * proved out for walk-up songs, not a second copy of it.
 *
 * One AudioContext, created lazily on first use — browsers refuse to start
 * one before a user gesture, and creating it eagerly at module load would
 * throw or sit suspended. Reused after that; contexts are not cheap to spin
 * up per sound, and this is meant to fire rapidly between plays.
 */

import {
  BUILT_IN_SOUNDS, isBuiltIn, isCustomSlot, soundStorageKey,
} from '../shared/soundboardCatalog.js';
import { getClip } from './audioStore.web.js';

let ctx = null;
const getCtx = () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

/** A short envelope so nothing here clicks or pops at the edges. */
function envelope(gainNode, at, attack, hold, release, peak = 0.9) {
  const g = gainNode.gain;
  g.cancelScheduledValues(at);
  g.setValueAtTime(0, at);
  g.linearRampToValueAtTime(peak, at + attack);
  g.setValueAtTime(peak, at + attack + hold);
  g.linearRampToValueAtTime(0, at + attack + hold + release);
}

/** Filtered white noise — the raw material for cheer, applause, and the
    drum roll's snare-like rasp. Built once per call; noise isn't reusable
    the way a tone is, since it's already random. */
function noiseBuffer(audioCtx, seconds) {
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * seconds, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

const SYNTH = {
  /** Two square-wave tones a few Hz apart — the "beat" that makes a buzzer
      read as electronic rather than a plain tone. */
  buzzer(audioCtx, at) {
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    envelope(gain, at, 0.02, 0.9, 0.15, 0.7);
    for (const freq of [196, 199]) {
      const osc = audioCtx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + 1.1);
    }
  },

  /** Two sawtooth tones a musical third apart, the classic air-horn dyad,
      with a quick pitch-up at the very start for the "honk" attack. */
  airhorn(audioCtx, at) {
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    envelope(gain, at, 0.05, 1.1, 0.25, 0.8);
    for (const freq of [349, 440]) {
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * 0.85, at);
      osc.frequency.linearRampToValueAtTime(freq, at + 0.08);
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + 1.4);
    }
  },

  /** A sine sweeping up then back down — a referee's whistle is a pitch
      bend, not a steady tone. */
  whistle(audioCtx, at) {
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    envelope(gain, at, 0.015, 0.5, 0.1, 0.6);
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, at);
    osc.frequency.linearRampToValueAtTime(3100, at + 0.15);
    osc.frequency.linearRampToValueAtTime(2400, at + 0.5);
    osc.connect(gain);
    osc.start(at);
    osc.stop(at + 0.65);
  },

  /** Filtered noise pulsing faster and faster, ending on a low "hit" — the
      shape of a drum roll even without an actual drum sample. */
  drumroll(audioCtx, at) {
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.connect(audioCtx.destination);

    const hits = 22;
    for (let i = 0; i < hits; i++) {
      const t = at + (i / hits) ** 1.6 * 1.3;
      const src = audioCtx.createBufferSource();
      src.buffer = noiseBuffer(audioCtx, 0.06);
      const gain = audioCtx.createGain();
      envelope(gain, t, 0.002, 0.02, 0.03, 0.5);
      src.connect(gain);
      gain.connect(filter);
      src.start(t);
    }

    const hit = audioCtx.createOscillator();
    const hitGain = audioCtx.createGain();
    hit.type = 'sine';
    hit.frequency.value = 90;
    envelope(hitGain, at + 1.3, 0.005, 0.05, 0.3, 0.9);
    hit.connect(hitGain);
    hitGain.connect(audioCtx.destination);
    hit.start(at + 1.3);
    hit.stop(at + 1.7);
  },

  /** Band-passed noise with a slow swell — broadband noise shaped away from
      both rumble and hiss reads as a crowd, the same trick foley uses. */
  cheer(audioCtx, at) {
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer(audioCtx, 2.6);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.6;
    const gain = audioCtx.createGain();
    envelope(gain, at, 0.4, 1.2, 1.0, 0.5);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(at);
    src.stop(at + 2.6);
  },

  /** Short, irregular noise blips rather than one sustained swell — the
      texture that separates clapping from the cheer's continuous roar. */
  applause(audioCtx, at) {
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;
    filter.connect(audioCtx.destination);

    const claps = 40;
    for (let i = 0; i < claps; i++) {
      const t = at + Math.random() * 1.6;
      const src = audioCtx.createBufferSource();
      src.buffer = noiseBuffer(audioCtx, 0.03);
      const gain = audioCtx.createGain();
      envelope(gain, t, 0.001, 0.01, 0.03, 0.35 + Math.random() * 0.25);
      src.connect(gain);
      gain.connect(filter);
      src.start(t);
    }
  },
};

/** True once the browser will actually let audio start. */
export const soundboardSupported = () =>
  typeof window !== 'undefined'
  && !!(window.AudioContext || window.webkitAudioContext);

/**
 * Play one sound by id — built-in (synthesized) or a coach's own recording
 * (played back from IndexedDB). Returns whether it actually started, the
 * same convention audioStore.web.js's playClip already uses, so the sheet
 * can show "nothing recorded for this slot yet" without a separate check.
 */
export async function playSound(id) {
  if (isBuiltIn(id)) {
    const entry = BUILT_IN_SOUNDS.find((s) => s.id === id);
    const routine = SYNTH[entry?.synth];
    if (!routine) return false;
    try {
      const audioCtx = getCtx();
      routine(audioCtx, audioCtx.currentTime);
      return true;
    } catch {
      return false;
    }
  }

  if (isCustomSlot(id)) {
    const blob = await getClip(soundStorageKey(id)).catch(() => null);
    if (!blob) return false;
    try {
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

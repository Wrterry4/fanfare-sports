/**
 * audioProbe.test.js — Whether a picked audio file gets accepted.
 *
 * This is the actual bug report: "I can't add sounds or music to the app at
 * all." The cause was resolvePlayability's predecessor treating "duration
 * unknown" the same as "won't play" — and a real, everyday file format,
 * VBR-encoded MP3, reports duration:Infinity until the browser scans toward
 * the end of the file. Every VBR MP3 — which is most of what a phone's voice
 * memo app or a random web download produces — was being rejected outright.
 */

import { resolvePlayability } from '../src/services/audioStore.web.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

group('A normal file with a clean duration');
{
  const r = resolvePlayability({ duration: 214.5, errored: false, sawAnySignal: true });
  ok('is playable', r.playable);
  ok('keeps the real duration', r.duration === 214.5);
}

group('The bug: VBR MP3s and similar report Infinity, not broken');
{
  // In the real flow this is caught before resolvePlayability even runs —
  // probeAudio seeks forward and re-resolves the real duration. This case is
  // what happens if that trick still comes back without a usable number.
  const r = resolvePlayability({ duration: Infinity, errored: false, sawAnySignal: true });
  ok('is still accepted as playable', r.playable);
  ok('duration is reported as unknown rather than rejecting the file', r.duration === 0);
}

group('Loaded, but no duration was ever resolvable in this browser');
{
  const r = resolvePlayability({ duration: NaN, errored: false, sawAnySignal: true });
  ok('still accepted — it loaded, the length just is not known', r.playable);
  ok('duration reported as unknown', r.duration === 0);
}
{
  const r = resolvePlayability({ duration: 0, errored: false, sawAnySignal: true });
  ok('a literal zero duration is treated the same way', r.playable);
}

group('A genuine decode failure is the only thing that rejects a file');
{
  const r = resolvePlayability({ duration: 0, errored: true, sawAnySignal: false });
  ok('rejected', !r.playable);
}
{
  // Even if something odd happened with the duration reading, an explicit
  // decode error always wins.
  const r = resolvePlayability({ duration: 42, errored: true, sawAnySignal: true });
  ok('an explicit error is rejected regardless of what duration looked like', !r.playable);
}

group('Nothing loaded at all before the timeout — genuinely unresponsive');
{
  const r = resolvePlayability({ duration: 0, errored: false, sawAnySignal: false });
  ok('rejected — there was no signal this file is real audio', !r.playable);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

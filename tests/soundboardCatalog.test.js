/**
 * soundboardCatalog.test.js — What's in the soundboard, and how it's keyed.
 */

import {
  BUILT_IN_SOUNDS, CUSTOM_SLOT_COUNT, customSlotId, customSlotEntries,
  fullCatalog, isBuiltIn, isCustomSlot, soundStorageKey, builtInsFor,
} from '../src/shared/soundboardCatalog.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

group('Built-in sounds');
{
  ok('at least a handful exist', BUILT_IN_SOUNDS.length >= 5);
  ok('every one has a unique id',
    new Set(BUILT_IN_SOUNDS.map((s) => s.id)).size === BUILT_IN_SOUNDS.length);
  ok('every one names a synth routine',
    BUILT_IN_SOUNDS.every((s) => typeof s.synth === 'string' && s.synth.length > 0));
  ok('every one has a label', BUILT_IN_SOUNDS.every((s) => s.label));
}

group('Custom slots');
{
  const entries = customSlotEntries();
  ok('matches the declared count', entries.length === CUSTOM_SLOT_COUNT);
  ok('default-named when nothing is set', entries[0].label === 'Custom 1');
  ok('a custom slot has no synth routine — it plays a stored clip instead',
    entries.every((e) => e.synth === null));

  const named = customSlotEntries({ [customSlotId(1)]: 'Charge!' });
  ok('a coach-given name is used when present', named[0].label === 'Charge!');
  ok('unnamed slots still fall back', named[1].label === 'Custom 2');
}

group('The combined catalog');
{
  const all = fullCatalog();
  ok('built-ins come first', all[0].id === BUILT_IN_SOUNDS[0].id);
  ok('custom slots follow', all[all.length - 1].id === customSlotId(CUSTOM_SLOT_COUNT));
  ok('total length is built-ins plus custom slots',
    all.length === BUILT_IN_SOUNDS.length + CUSTOM_SLOT_COUNT);
  ok('no id collides between the two groups',
    new Set(all.map((s) => s.id)).size === all.length);
}

group('Telling a built-in from a custom slot');
{
  ok('a real built-in id is recognized', isBuiltIn('buzzer'));
  ok('a custom slot id is not a built-in', !isBuiltIn('custom1'));
  ok('a custom slot id is recognized', isCustomSlot('custom1'));
  ok('the last valid slot is recognized', isCustomSlot(customSlotId(CUSTOM_SLOT_COUNT)));
  ok('one past the declared count is not', !isCustomSlot(customSlotId(CUSTOM_SLOT_COUNT + 1)));
  ok('garbage is neither', !isBuiltIn('nonsense') && !isCustomSlot('nonsense'));
}

group('Storage keys never collide with a walk-up song\'s player id');
{
  const key = soundStorageKey('custom1');
  ok('the key is namespaced, not the bare slot id', key !== 'custom1');
  ok('a real Firestore-style player id could never produce this key',
    !key.match(/^[a-zA-Z0-9]{20}$/));
  ok('two different slots get two different keys',
    soundStorageKey('custom1') !== soundStorageKey('custom2'));
}

group('Sport-specific catalogs');
{
  const baseball = { SOUNDBOARD_BUILTIN_IDS: ['airhorn', 'drumroll', 'cheer', 'applause'] };
  const basketball = { SOUNDBOARD_BUILTIN_IDS: ['buzzer', 'whistle', 'airhorn', 'drumroll', 'cheer', 'applause'] };

  ok('baseball excludes buzzer', !builtInsFor(baseball).some((s) => s.id === 'buzzer'));
  ok('baseball excludes whistle', !builtInsFor(baseball).some((s) => s.id === 'whistle'));
  ok('basketball includes both', builtInsFor(basketball).some((s) => s.id === 'buzzer')
    && builtInsFor(basketball).some((s) => s.id === 'whistle'));
  ok('a sport with no declared list falls back to everything, not an empty board',
    builtInsFor(null).length === BUILT_IN_SOUNDS.length);
  ok('the fallback preserves the full catalog\'s ids',
    builtInsFor(undefined).every((s) => BUILT_IN_SOUNDS.some((b) => b.id === s.id)));
}

group('Custom slot suggestions');
{
  const withSuggestions = customSlotEntries({}, ['Crack of the Bat', 'Organ Charge']);
  ok('an unnamed slot shows the sport\'s suggestion', withSuggestions[0].label === 'Crack of the Bat');
  ok('marked as a suggestion, not a real saved name', withSuggestions[0].suggested === true);
  ok('a slot with no suggestion falls back to the generic label',
    withSuggestions[3].label === 'Custom 4' && withSuggestions[3].suggested === false);

  const named = customSlotEntries({ [customSlotId(1)]: 'My Real Sound' }, ['Crack of the Bat']);
  ok('a coach\'s own name always wins over the suggestion', named[0].label === 'My Real Sound');
  ok('and is not flagged as a suggestion', named[0].suggested === false);
}

group('fullCatalog with a sport applies both the built-in filter and suggestions');
{
  const baseball = {
    SOUNDBOARD_BUILTIN_IDS: ['airhorn', 'cheer'],
    SOUNDBOARD_CUSTOM_SUGGESTIONS: ['Crack of the Bat'],
  };
  const catalog = fullCatalog({}, baseball);
  ok('only the sport\'s chosen built-ins appear',
    catalog.filter((s) => s.synth).length === 2);
  ok('the first custom slot carries the sport\'s suggestion',
    catalog.find((s) => s.id === customSlotId(1)).label === 'Crack of the Bat');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

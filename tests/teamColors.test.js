/**
 * teamColors.test.js — Every team color stays readable.
 *
 * This is the file that makes the curated palette a guarantee rather than an
 * intention. brand.js measures its pairs by hand in a comment; the moment
 * users pick colors, a comment isn't enough, so the math runs here instead.
 *
 * A failure means text on that color is genuinely hard to read in sunlight.
 * The fix is a deeper shade of the same hue — never a lower threshold.
 */

import {
  parseHex, luminance, contrastRatio, onColor, meetsAA, MIN_AA,
} from '../src/shared/contrast.js';
import {
  TEAM_COLORS, DEFAULT_TEAM_COLOR, resolveTeamColor, isTeamColorId,
} from '../src/shared/teamColors.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

group('The WCAG math itself');
{
  ok('black on white is the 21:1 maximum', Math.round(contrastRatio('#000000', '#FFFFFF')) === 21);
  ok('a color against itself is 1:1', Math.round(contrastRatio('#2563EB', '#2563EB')) === 1);
  ok('order does not matter', contrastRatio('#000', '#FFF') === contrastRatio('#FFF', '#000'));
  ok('white has luminance 1', Math.round(luminance('#FFFFFF')) === 1);
  ok('black has luminance 0', luminance('#000000') === 0);

  // Reproduces two of the measurements brand.js states in its header. If the
  // math here drifts, those documented numbers silently stop being true.
  ok('white on navy matches the documented 17.85:1',
    Math.abs(contrastRatio('#FFFFFF', '#0F172A') - 17.85) < 0.1);
  ok('stadium gold on white matches the documented 2.15:1 failure',
    Math.abs(contrastRatio('#F59E0B', '#FFFFFF') - 2.15) < 0.1);
}

group('Hex parsing survives real input');
{
  ok('three-digit shorthand expands', parseHex('#abc').r === 0xaa);
  ok('a missing hash still parses', parseHex('2563EB') !== null);
  ok('lowercase parses', parseHex('#2563eb') !== null);
  ok('whitespace is tolerated', parseHex('  #2563EB  ') !== null);
  ok('garbage is null, not a crash', parseHex('not-a-color') === null);
  ok('a non-string is null, not a crash', parseHex(undefined) === null);
  ok('the wrong length is null', parseHex('#12345') === null);
}

group('Every preset is readable — the whole point of curating them');
{
  for (const c of TEAM_COLORS) {
    const ratio = contrastRatio(c.onFill, c.fill);
    ok(`${c.label} (${c.fill}) — ${ratio.toFixed(2)}:1 on its own text color`,
      ratio >= MIN_AA);
  }
  ok('the default color is readable too',
    meetsAA(DEFAULT_TEAM_COLOR.onFill, DEFAULT_TEAM_COLOR.fill));
}

group('Presets are well-formed');
{
  const ids = TEAM_COLORS.map((c) => c.id);
  ok('every id is unique', new Set(ids).size === ids.length);
  ok('every entry parses as a real color', TEAM_COLORS.every((c) => parseHex(c.fill)));
  ok('every entry has a label to show', TEAM_COLORS.every((c) => !!c.label));
  ok('isTeamColorId recognizes a real one', isTeamColorId('crimson'));
  ok('isTeamColorId rejects an unknown one', !isTeamColorId('chartreuse'));
}

group('onColor always picks the readable side');
{
  ok('white text on a dark fill', onColor('#0F172A') === '#FFFFFF');
  ok('dark text on a light fill', onColor('#F8FAFC') === '#0F172A');
  ok('safety yellow gets dark text, not white', onColor('#FFFF00') === '#0F172A');

  // The guarantee that matters: whatever it returns must be legible.
  const samples = ['#FFFF00', '#00FF00', '#FF00FF', '#808080', '#7F7F7F',
    '#123456', '#FEDCBA', '#B5451B', '#E2701E'];
  ok('its choice always clears AA-large at minimum',
    samples.every((bg) => contrastRatio(onColor(bg), bg) >= 3));
  ok('unparseable input still returns a usable color', !!onColor('nonsense'));
}

group('resolveTeamColor tolerates every document it will actually meet');
{
  ok('a team with no color set gets the default',
    resolveTeamColor({ name: 'Wildcats' }).fill === DEFAULT_TEAM_COLOR.fill);
  ok('no team at all gets the default',
    resolveTeamColor(null).fill === DEFAULT_TEAM_COLOR.fill);
  ok('a known id resolves to its preset',
    resolveTeamColor({ colorId: 'crimson' }).fill === '#B91C1C');
  ok('an id from a newer version falls back rather than breaking',
    resolveTeamColor({ colorId: 'neon-chartreuse' }).fill === DEFAULT_TEAM_COLOR.fill);

  // A hand-written hex was never validated on the way in, so its text color is
  // computed rather than trusted.
  const custom = resolveTeamColor({ colorId: '#FFFF00' });
  ok('a raw hex is honored', custom.fill === '#FFFF00');
  ok('and gets a computed, readable text color',
    contrastRatio(custom.onFill, custom.fill) >= 3);

  ok('a legacy `color` field still works',
    resolveTeamColor({ color: 'forest' }).fill === '#166534');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

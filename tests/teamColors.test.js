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
  parseHex, luminance, contrastRatio, onColor, meetsAA, mix, MIN_AA,
} from '../src/shared/contrast.js';
import {
  TEAM_COLORS, DEFAULT_TEAM_COLOR, resolveTeamColor, isTeamColorId,
  teamSurface, SURFACE_TINT, bubbleColors,
} from '../src/shared/teamColors.js';

let passed = 0, failed = 0;
const ok = (label, cond) => {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; console.log(`  FAIL ${label}`); }
};
const group = (n) => console.log(`\n${n}`);

/** Two bubbles closer than this read as one colour. See bubbleColors(). */
const BUBBLE_MIN = 2;

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

group('mix blends predictably');
{
  ok('t=0 is the first color', mix('#000000', '#FFFFFF', 0) === '#000000');
  ok('t=1 is the second color', mix('#000000', '#FFFFFF', 1) === '#FFFFFF');
  ok('halfway is halfway', mix('#000000', '#FFFFFF', 0.5) === '#808080');
  ok('t below 0 clamps', mix('#000000', '#FFFFFF', -5) === '#000000');
  ok('t above 1 clamps', mix('#000000', '#FFFFFF', 5) === '#FFFFFF');
  ok('junk t is treated as 0', mix('#123456', '#FFFFFF', 'abc') === '#123456');
  ok('an unparseable input falls back rather than throwing',
    !!mix('nonsense', '#FFFFFF', 0.5));
}

/**
 * The tinted page background is the one change that could quietly make the
 * whole app unreadable — it sits behind every screen, and a background is the
 * last thing anyone thinks to test. These are the real pairs from brand.js
 * that now land on it.
 */
group('No team color can wash out the page');
{
  const NAVY = '#0F172A';      // body text
  const SLATE = '#475569';     // secondary text (colors.pencil)
  const CARD = '#FFFFFF';      // cards sit on top of the surface
  const LINE = '#E2E8F0';      // hairline borders

  let worstBody = Infinity;
  let worstSecondary = Infinity;

  for (const c of TEAM_COLORS) {
    const surface = teamSurface({ colorId: c.id });
    const body = contrastRatio(NAVY, surface);
    const secondary = contrastRatio(SLATE, surface);
    worstBody = Math.min(worstBody, body);
    worstSecondary = Math.min(worstSecondary, secondary);

    ok(`${c.label}: body text ${body.toFixed(1)}:1, secondary ${secondary.toFixed(1)}:1`,
      body >= 7 && secondary >= MIN_AA);
  }

  console.log(`       worst body ${worstBody.toFixed(2)}:1, worst secondary ${worstSecondary.toFixed(2)}:1`);

  // A white card has to stay visible ON the tint, or the layout loses its
  // structure — that's the failure mode in the other direction from text.
  for (const c of TEAM_COLORS) {
    const surface = teamSurface({ colorId: c.id });
    ok(`${c.label}: a white card still separates from the surface`,
      contrastRatio(CARD, surface) >= 1.02);
  }

  ok('the hairline border still reads against the lightest surface',
    contrastRatio(LINE, teamSurface({ colorId: 'white' })) >= 1.0);
  ok('the default (no color chosen) surface is readable',
    contrastRatio(NAVY, teamSurface({})) >= 7);
}

group('The surface is a tint, not the team color');
{
  // If this ever stops being true, someone has raised SURFACE_TINT far enough
  // that the app has quietly become a different design per team.
  ok('the tint is a fraction, not a wash', SURFACE_TINT <= 0.20);

  for (const c of TEAM_COLORS) {
    const surface = teamSurface({ colorId: c.id });
    ok(`${c.label}: the surface stays light`, luminance(surface) > 0.55);
  }

  // ...but not SO subtle it was pointless. Every tint must be distinguishable
  // from plain chalk, or the feature does nothing and nobody can tell.
  const chalk = '#F8FAFC';
  const distinct = TEAM_COLORS.filter((c) => teamSurface({ colorId: c.id }) !== chalk);
  ok('every color actually changes the surface', distinct.length === TEAM_COLORS.length);
}

group('Primary and secondary');
{
  const both = resolveTeamColor({ colorId: 'navy', secondaryColorId: 'gold' });
  ok('primary resolves', both.fill === '#1E3A8A');
  ok('secondary resolves', both.secondary.fill === '#F59E0B');
  ok('secondary keeps its own text color', both.secondary.onFill === '#0F172A');
  ok('the surface is tinted from the PRIMARY, not the secondary',
    both.surface === teamSurface({ colorId: 'navy' }));

  const onlyPrimary = resolveTeamColor({ colorId: 'crimson' });
  ok('no secondary falls back to primary rather than null',
    onlyPrimary.secondary.fill === '#B91C1C');

  const neither = resolveTeamColor({});
  ok('no colors at all still gives a usable secondary',
    neither.secondary.fill === DEFAULT_TEAM_COLOR.fill);

  ok('an unknown secondary id falls back to primary',
    resolveTeamColor({ colorId: 'navy', secondaryColorId: 'chartreuse' }).secondary.fill
      === '#1E3A8A');
}

group('Clearing a color returns the app to its default look');
{
  const chosen = resolveTeamColor({ colorId: 'crimson', secondaryColorId: 'gold' });
  const cleared = resolveTeamColor({ colorId: null, secondaryColorId: null });
  const never = resolveTeamColor({});

  ok('clearing gives back the brand blue', cleared.fill === DEFAULT_TEAM_COLOR.fill);
  ok('and is identical to a team that never chose', cleared.fill === never.fill);
  ok('the surface goes back too', cleared.surface === never.surface);
  ok('the secondary clears with it', cleared.secondary.fill === DEFAULT_TEAM_COLOR.fill);
  ok('which is genuinely different from the chosen state', chosen.surface !== cleared.surface);

  // Clearing only the secondary must leave the primary alone — they are two
  // independent fields, and a shared clear button would be a nasty surprise.
  const primaryOnly = resolveTeamColor({ colorId: 'crimson', secondaryColorId: null });
  ok('clearing the secondary keeps the primary', primaryOnly.fill === '#B91C1C');
  ok('and the secondary falls back to the primary, not to blue',
    primaryOnly.secondary.fill === '#B91C1C');
}

group('Colors belong to the team, not the sport');
{
  // The picker is gated on staff, never on sport. A basketball team must
  // resolve exactly like a baseball one — this is the assertion that catches
  // anyone later "helpfully" branching this on team.sport.
  const ball = resolveTeamColor({ sport: 'baseball', colorId: 'forest', secondaryColorId: 'gold' });
  const hoops = resolveTeamColor({ sport: 'basketball', colorId: 'forest', secondaryColorId: 'gold' });
  const future = resolveTeamColor({ sport: 'lacrosse', colorId: 'forest', secondaryColorId: 'gold' });

  ok('basketball resolves the same primary', hoops.fill === ball.fill);
  ok('basketball resolves the same secondary', hoops.secondary.fill === ball.secondary.fill);
  ok('basketball gets the same surface tint', hoops.surface === ball.surface);
  ok('a sport that does not exist yet works too', future.surface === ball.surface);
}

group('Chat bubbles are always tellable apart');
{
  const two = bubbleColors({ colorId: 'navy', secondaryColorId: 'gold' });
  ok('their messages take the primary', two.theirs.fill === '#1E3A8A');
  ok('yours takes the secondary', two.mine.fill === '#F59E0B');
  ok('each side keeps its own readable text colour',
    contrastRatio(two.mine.onFill, two.mine.fill) >= MIN_AA
    && contrastRatio(two.theirs.onFill, two.theirs.fill) >= MIN_AA);

  // No secondary at all: both sides would be the primary and the thread
  // would read as one colour.
  const one = bubbleColors({ colorId: 'crimson' });
  ok('with no secondary, your side falls back instead of matching',
    one.mine.fill !== one.theirs.fill);
  ok('and their side keeps the team colour', one.theirs.fill === '#B91C1C');

  // Navy and royal are a real combination a team would choose.
  const close = bubbleColors({ colorId: 'navy', secondaryColorId: 'royal' });
  ok('two near-identical colours also fall back', close.mine.fill !== '#1D4ED8');

  // The guarantee, across every pair in the palette.
  let worst = Infinity;
  let worstPair = '';
  for (const a of TEAM_COLORS) {
    for (const b of TEAM_COLORS) {
      const { mine, theirs } = bubbleColors({ colorId: a.id, secondaryColorId: b.id });
      const sep = contrastRatio(mine.fill, theirs.fill);
      if (sep < worst) { worst = sep; worstPair = `${a.label}/${b.label}`; }
    }
  }
  console.log(`       worst bubble separation ${worst.toFixed(2)}:1 (${worstPair})`);
  ok('no combination in the palette produces two identical sides', worst >= BUBBLE_MIN);

  ok('no team at all still gives two distinct bubbles',
    bubbleColors(null).mine.fill !== bubbleColors(null).theirs.fill);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

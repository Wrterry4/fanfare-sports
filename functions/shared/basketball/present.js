/**
 * present.js — Basketball, described for the shared screens.
 *
 * This is the file that proves the refactor worked. Every function here has
 * the same signature as its baseball counterpart and returns the same shapes,
 * and GameDayScreen, Scoreboard and LineScore render it without a single
 * conditional on sport.
 *
 * Where the two sports genuinely differ, the shapes absorb it:
 *
 *   describePeriod returns direction: null, so no half-inning arrow is drawn.
 *   describeCounters returns team fouls and the bonus, not balls and strikes.
 *   describePeriodScores returns one total column, not R and E.
 *   describeParticipants returns five players, not two.
 *   describeUpNext returns the bench instead of an on-deck order.
 */

import { EV } from './events.js';
import { inBonus, hasFouledOut } from './rules.js';
import { pickPhrase } from '../pickPhrase.js';

const PERIOD_NAMES = { 4: ['1st', '2nd', '3rd', '4th'], 2: ['1st Half', '2nd Half'] };

function periodLabel(period, rules) {
  const names = PERIOD_NAMES[rules?.periods] || PERIOD_NAMES[4];
  if (period <= names.length) return names[period - 1];
  const ot = period - names.length;
  return ot === 1 ? 'OT' : `${ot}OT`;
}

export function describePeriod(state, rules) {
  if (state.status === 'final') {
    return {
      final: true,
      label: state.endReason === 'mercy' ? 'FINAL · MERCY' : 'FINAL',
      direction: null,
      index: state.period,
    };
  }
  return {
    final: false,
    label: periodLabel(state.period, rules),
    // Basketball periods aren't divided into halves, so the shared Scoreboard
    // draws no arrow. The shape allows it; this sport declines it.
    direction: null,
    index: state.period,
  };
}

/**
 * Team fouls and the bonus, in the slot where baseball shows balls and strikes.
 *
 * This is the counter that changes how the last two minutes are played, so it
 * earns the permanent spot. A league with no bonus rule gets no counter rather
 * than an empty row of dots.
 */
export function describeCounters(state, rules) {
  if (state.status === 'final') return [];

  const limit = rules?.teamFoulsForBonus || 0;
  if (!limit) return [];

  const teamFouls = state.teamFouls || { home: [], away: [] };
  const idx = (state.period || 1) - 1;
  const ours = teamFouls[state.homeOrAway]?.[idx] || 0;
  const bonus = inBonus(ours, rules);

  return [{
    key: 'teamFouls',
    label: 'F',
    filled: Math.min(ours, limit),
    total: limit,
    danger: bonus,
  }];
}

export function describePeriodScores(state, rules) {
  const scheduled = rules?.periods ?? 4;
  // Defense-in-depth against the same class of mismatch baseball guards
  // against — see the note in baseball/present.js. The real fix is in
  // useGame.js; this just keeps a leftover-snapshot race from crashing the
  // screen if one ever slips through some other path.
  const periodScores = state.periodScores || { away: [], home: [] };
  const columns = Math.max(
    scheduled,
    periodScores.away.length,
    periodScores.home.length,
    state.period
  );

  const cellFor = (side, i) => {
    const played = periodScores[side]?.[i];
    if (played != null) return String(played);
    // Basketball has no half-periods, so a period is either reached or not.
    return state.period > i + 1 ? '0' : (state.period === i + 1 ? '0' : '');
  };

  const headers = Array.from({ length: columns }, (_, i) =>
    i < scheduled ? String(i + 1) : (i === scheduled ? 'OT' : `${i - scheduled + 1}OT`));

  return {
    columns,
    headers,
    activeColumn: state.status === 'final' ? null : state.period - 1,
    // One total. Baseball's R and E don't generalize, which is why the shared
    // component reads this list instead of assuming two columns.
    totalColumns: ['T'],
    rows: ['away', 'home'].map((side) => ({
      side,
      // Nobody "bats" in basketball; the acting row is whoever we are.
      active: state.status !== 'final' && side === state.homeOrAway,
      cells: Array.from({ length: columns }, (_, i) => cellFor(side, i)),
      totals: [String(state.score?.[side] ?? 0)],
    })),
  };
}

/**
 * The five on the floor.
 *
 * Baseball returns two participants; this returns however many the rules say
 * are on court. The shared screen maps over the list, so nothing changes.
 *
 * Every slot is substitutable, because basketball substitutes constantly —
 * which is exactly the case the generalized SubstitutionSheet was built for.
 */
export function describeParticipants(state, rules, { personFor, canScore }) {
  /**
   * Defaulted once, here, rather than guarded field-by-field below — see the
   * matching note in baseball/present.js. `state.onCourt.slice` with no
   * fallback was the exact line that crashed: a baseball-shaped state has no
   * onCourt at all, and calling .slice() on undefined throws immediately,
   * before any `?.` later in the expression could have helped.
   */
  const onCourt = state.onCourt || [];
  const box = state.box || {};
  const fouls = state.fouls || {};

  const size = rules?.playersOnCourt || 5;
  const slots = onCourt.slice(0, size);

  return slots.map((playerId, i) => {
    const person = personFor(playerId);
    const line = box[playerId];
    const playerFouls = fouls[playerId] || 0;
    const nearLimit = rules?.foulsToFoulOut
      ? playerFouls >= rules.foulsToFoulOut - 1
      : false;

    return {
      key: `court${i}`,
      label: 'On court',
      playerId,
      person,
      fouls: playerFouls,
      detail: line
        ? `${line.pts} pts${playerFouls ? ` · ${playerFouls} PF` : ''}`
        : (playerFouls ? `${playerFouls} PF` : '0 pts'),
      accent: 'primary',
      // One foul from disqualification is the thing a coach must not miss.
      warn: nearLimit,
      /**
       * Trusts the caller's `canScore` completely rather than re-checking
       * state.status here too.
       *
       * This used to also require state.status === 'live' directly, which
       * silently overrode whatever the caller had already decided. For a
       * game whose event log is missing its GAME_START event — one started
       * before that was fixed to actually get recorded — state.status is
       * stuck at 'pending' forever, and this redundant check meant NO
       * caller-side fix could ever make cards selectable for that specific
       * game again, no matter how permissive canScore was made upstream.
       * Whether scoring is currently possible is the caller's decision to
       * make, once, not something this function re-litigates.
       */
      substitutable: !!canScore,
      /**
       * The card itself is the player picker now — tapping arms them as the
       * target for the next scoring action, replacing a separate strip of
       * small number chips. Baseball leaves this unset: its cards open stats
       * on tap, because the engine already knows who's batting without
       * anyone picking them first. This is what tells the shared screen
       * which behavior a given sport's cards want, without a sport check.
       */
      selectableForScoring: !!canScore,
    };
  });
}

/**
 * The bench, in the strip baseball uses for on deck and in the hole.
 *
 * Capped at four so the strip stays one line on a phone. A coach scanning it
 * wants to see who's rested, not the whole roster.
 */
export function describeUpNext(state, { personFor }) {
  const fouledOut = state.fouledOut || [];
  const bench = (state.bench || []).filter((id) => !fouledOut.includes(id));
  if (!bench.length) return [];

  return bench.slice(0, 4).map((playerId, i) => ({
    key: `bench${i}`,
    label: i === 0 ? 'BENCH' : ' ',
    person: personFor(playerId),
  }));
}

/**
 * Substituting. The whole bench is eligible, minus anyone who has fouled out.
 */
export function describeSubstitution(state, rules, slotKey, { personFor }) {
  const onCourt = state.onCourt || [];
  const fouledOut = state.fouledOut || [];
  const box = state.box || {};
  const fouls = state.fouls || {};

  const index = Number(String(slotKey).replace('court', ''));
  const outId = onCourt[index];
  if (outId === undefined) return null;

  const outPerson = personFor(outId);
  const available = (state.bench || []).filter((id) => !fouledOut.includes(id));

  return {
    title: outPerson ? `Sub for ${outPerson.firstName}` : 'Substitution',
    subtitle: 'Their clock stops and the incoming player\'s starts. '
      + 'Minutes only count for periods where subs were logged.',
    event: EV.SUBSTITUTION,
    currentId: outId,
    // The shared sheet records { playerId }; the engine needs both sides, so
    // the outgoing player rides along in the spec.
    extraPayload: { outId },
    options: available.map((playerId) => {
      const person = personFor(playerId);
      if (!person) return null;
      const playerFouls = fouls[playerId] || 0;
      const line = box[playerId];
      return {
        playerId,
        person,
        detail: `${line?.pts || 0} pts${playerFouls ? ` · ${playerFouls} PF` : ''}`,
        warn: hasFouledOut(playerFouls, rules),
        warnLabel: 'fouled out',
      };
    }).filter(Boolean),
    emptyText: 'Nobody available on the bench.',
  };
}

export function describeFeedEntry(entry) {
  return {
    marker: entry.kind === 'GAME_START' || entry.kind === 'GAME_END'
      ? '' : `P${entry.period}`,
    text: entry.text,
  };
}

/** Points and fouls, where baseball shows a batting line. */
export function describeStatLine(slotKey, line) {
  if (!line) return '0 pts';
  return `${line.pts} pts${line.reb ? ` · ${line.reb} reb` : ''}`;
}

export const EMPTY_FEED_TEXT = 'Waiting for the opening tip.';

/**
 * The stat card. Same shape as baseball's, entirely different contents.
 *
 * Minutes carry their provenance into the label rather than being printed as a
 * bare number: "est." when derived from wall time, and a note when periods
 * went untracked. A parent checking equal playing time deserves to know how
 * solid the figure is.
 */
export function describeStatCard({ season, career }) {
  const s = season?.players ? Object.values(season.players)[0] : season;
  // Career is stored per sport now — players/{id}/career/totals is
  // { baseball: {...}, basketball: {...} } — so a two-sport athlete's
  // baseball seasons never bleed into their shooting percentage. See
  // recomputeCareers in functions/index.js.
  const c = career?.basketball;
  const sections = [];
  const pct = (n) => `${Math.round((n || 0) * 100)}%`;

  if (s && (s.games || s.pts !== undefined)) {
    const minsLabel = s.minutesEstimated ? 'MIN (est.)' : 'MIN';
    sections.push({
      key: 'scoring',
      label: 'SCORING',
      headline: [
        { value: s.pts ?? 0, label: 'PTS' },
        { value: pct(s.fgPct), label: 'FG%' },
        { value: s.minutes ?? 0, label: minsLabel },
      ],
      grid: [
        ['FG', `${s.fgm || 0}/${s.fga || 0}`],
        ['3PT', `${s.fg3m || 0}/${s.fg3a || 0}`],
        ['FT', `${s.ftm || 0}/${s.fta || 0}`],
        ['REB', s.reb], ['AST', s.ast], ['STL', s.stl],
        ['BLK', s.blk], ['TO', s.to], ['PF', s.pf],
      ],
      // Stated rather than implied — see engine.js on why minutes can be
      // partial.
      note: s.minutesComplete === false
        ? 'Minutes cover only the periods where substitutions were logged.'
        : null,
    });
  }

  if (c?.scoring && (c.scoring.games || 0) > 0) {
    const cs = c.scoring;
    sections.push({
      key: 'career',
      label: `CAREER · ${cs.games} game${cs.games === 1 ? '' : 's'}`,
      grid: [
        ['PTS', cs.pts], ['REB', cs.reb], ['AST', cs.ast],
        ['FG%', pct(cs.fgPct)], ['MIN', cs.minutes],
      ],
    });
  }

  return sections;
}

export function describeTodayLine(live) {
  if (!live) return null;
  return [
    { value: live.pts ?? 0, label: 'POINTS' },
    { value: live.reb ?? 0, label: 'REB' },
    { value: live.ast ?? 0, label: 'AST' },
  ];
}

/**
 * What the banners can say. Same shape and rules as the baseball pack —
 * see the pool comment there — including a no-name form for every entry,
 * since `firstName` is regularly missing.
 *
 * Nothing here describes HOW the shot went in ("nothing but net", "off the
 * glass", "pull-up"). The event records that a three was made and nothing
 * more, so a phrase claiming any of that is wrong about as often as it's
 * right. Same standard the strikeout pool is held to.
 */
const MADE_3_PHRASES = [
  { named: (n) => `${n} FROM DEEP!`, plain: 'THREE POINTER!' },
  { named: (n) => `${n} FOR THREE!`, plain: 'FOR THREE!' },
  { named: (n) => `${n} BURIES IT!`, plain: 'BURIED IT!' },
  { named: (n) => `${n} DRAINS IT!`, plain: 'DRAINED IT!' },
  { named: (n) => `${n} FROM DOWNTOWN!`, plain: 'DOWNTOWN!' },
  { named: (n) => `SPLASH! ${n}!`, plain: 'SPLASH!' },
];

/**
 * Unlike a strikeout, the playerId on a block is the player who MADE it —
 * stats credit `blk` to exactly this id — so naming them celebrates the kid
 * who did something good rather than spotlighting one who didn't.
 */
const BLOCK_PHRASES = [
  { named: (n) => `${n} REJECTS IT!`, plain: 'REJECTED!' },
  { named: (n) => `${n} WITH THE BLOCK!`, plain: 'BLOCKED!' },
  { named: (n) => `${n} SAYS NO!`, plain: 'DENIED!' },
  { named: (n) => `${n} SENDS IT BACK!`, plain: 'SENT IT BACK!' },
  { named: (n) => `${n} SWATS IT!`, plain: 'SWATTED!' },
];

/** Pick one phrase and render it with or without the name. */
function say(pool, seq, first) {
  const phrase = pickPhrase(pool, seq);
  if (!phrase) return '';
  return first && phrase.named ? phrase.named(first) : phrase.plain;
}

/**
 * A moment worth a brief animated banner for everyone watching. See the
 * matching function in baseball/present.js for how this gets triggered —
 * client-side, off the same events feed every viewer already subscribes to.
 *
 * Kept narrow on purpose: a made three is a real highlight at youth levels
 * without happening so often it turns into wallpaper. Foul-out needs the
 * state AFTER this event was applied, not just the event itself — a personal
 * foul only becomes a moment when it's the one that actually disqualifies
 * the player, and `state.fouledOut` only reflects that once the engine has
 * processed it.
 */
export function describeMoment(event, state, { personFor } = {}) {
  const playerId = event.payload?.playerId;
  const person = playerId ? personFor?.(playerId) : null;
  const first = person?.firstName;

  const upper = first?.toUpperCase();

  switch (event.type) {
    case EV.MADE_3:
      return { text: say(MADE_3_PHRASES, event.seq, upper), tone: 'good' };
    case EV.BLOCK:
      return { text: say(BLOCK_PHRASES, event.seq, upper), tone: 'good' };
    case EV.FOUL_PERSONAL:
      if (playerId && state?.fouledOut?.includes(playerId)) {
        // Deliberately NOT rotated. The other pools exist because repetition
        // makes a celebration feel canned; this is a kid being disqualified
        // in front of a crowd, and cycling through livelier ways to announce
        // it would read as enjoying it. One plain statement of fact is right.
        return { text: upper ? `${upper} FOULS OUT` : 'FOULED OUT', tone: 'bad' };
      }
      return null;
    default:
      return null;
  }
}

/**
 * Basketball has no runner advancement — nothing in the sport has this shape.
 * Present, and returning null, because the shared screen calls it on every
 * play and a missing function would mean the screen checking which sport it
 * is holding.
 */
export const describeAdvancePrompt = () => null;

/** Basketball has no walk-up song slot — the ball never stops for one. */
export const walkUpSlot = null;

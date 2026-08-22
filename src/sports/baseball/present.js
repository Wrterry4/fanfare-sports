/**
 * present.js — Baseball, described in terms the shared screens can render.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * The sport pack was supposed to be swappable, but the shared layer had been
 * reading the baseball state shape directly: GameDayScreen destructured
 * `state.isTop`, `state.bases`, `state.battingIndex` and `state.pitchers`;
 * Scoreboard rendered an inning ordinal and a balls/strikes/outs pip set;
 * LineScore assumed runs-by-inning with an R and E column. None of those exist
 * in basketball, so "add a folder and one registry entry" was true of the
 * engine and false of the UI.
 *
 * Everything here converts baseball state into shapes that describe a game
 * generally: a period, some counters, a per-period score grid, the people
 * currently involved. The shared components render those shapes and no longer
 * know what an inning is. Basketball supplies the same functions and gets the
 * same screens.
 *
 * The rule for anything added here: return DATA, not JSX. A presenter that
 * returns components has just moved the coupling somewhere harder to test.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { EV } from './events.js';
import { weArePitching } from './scoringModes.js';

/** Private here rather than imported — engine.js keeps its copy unexported. */
const fieldingSide = (s) => (s.isTop ? 'home' : 'away');

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Where we are in the game.
 *
 * `direction` is what the shared Scoreboard turns into an arrow. Baseball has
 * two halves per period so it sends 'up' or 'down'; a sport with undivided
 * periods sends null and no arrow is drawn.
 */
// `rules` is unused by baseball but part of the shared signature — basketball
// needs it to name periods and halves. One signature beats two.
export function describePeriod(state, rules) {
  if (state.status === 'final') {
    return {
      final: true,
      label: state.endReason === 'mercy' ? 'FINAL · MERCY' : 'FINAL',
      direction: null,
      index: state.inning,
    };
  }
  return {
    final: false,
    label: ordinal(state.inning),
    direction: state.isTop ? 'up' : 'down',
    index: state.inning,
  };
}

/**
 * The little dot counters beside the period.
 *
 * Totals are one less than the number that resolves the at-bat: a fourth ball
 * and a third strike end it, so they're never on screen. Basketball would
 * return team fouls here, or nothing.
 */
export function describeCounters(state, rules) {
  if (state.status === 'final') return [];
  return [
    { key: 'balls', label: 'B', filled: state.balls, total: 3 },
    { key: 'strikes', label: 'S', filled: state.strikes, total: 2 },
    { key: 'outs', label: 'O', filled: state.outs, total: 2, danger: true },
  ];
}

/**
 * The score grid: one column per period, plus totals.
 *
 * Baseball adds an E column for errors. Basketball would have no equivalent
 * and simply return one total, so the component reads the totals list rather
 * than hard-coding R and E.
 */
export function describePeriodScores(state, rules) {
  const scheduled = rules?.inningsPerGame ?? 6;
  // Optional chaining here is defense-in-depth, not the primary fix — the
  // real bug was useGame briefly rendering a different sport's leftover
  // snapshot through this presenter during a game switch (fixed in
  // useGame.js). This just means that if a mismatch like that ever happens
  // again for some other reason, the screen shows a blank line score for one
  // frame instead of crashing outright.
  const lineScore = state.lineScore || { away: [], home: [] };
  const columns = Math.max(
    scheduled,
    lineScore.away.length,
    lineScore.home.length,
    state.inning
  );

  const cellFor = (side, i) => {
    const played = lineScore[side]?.[i];
    if (played != null) return String(played);
    // A half not yet reached is blank; one in progress shows 0.
    const reached = state.inning > i + 1
      || (state.inning === i + 1 && (side === 'away' || !state.isTop));
    return reached ? '0' : '';
  };

  return {
    columns,
    headers: Array.from({ length: columns }, (_, i) => String(i + 1)),
    activeColumn: state.status === 'final' ? null : state.inning - 1,
    totalColumns: ['R', 'E'],
    rows: ['away', 'home'].map((side) => ({
      side,
      // Which row is "acting" — batting in baseball, in possession elsewhere.
      active: state.status !== 'final' && (side === 'away') === state.isTop,
      cells: Array.from({ length: columns }, (_, i) => cellFor(side, i)),
      totals: [String(state.score?.[side] ?? 0), String(state.errors?.[side] ?? 0)],
    })),
  };
}

/**
 * The people on screen right now.
 *
 * Baseball returns two: whoever is batting and whoever is pitching. Basketball
 * would return the five on the floor. The shared screen renders whatever it
 * gets rather than asking for a batter by name.
 *
 * `substitutable` marks a slot the scorekeeper is allowed to change, which is
 * how the pitcher-change sheet is offered without GameDayScreen knowing that
 * pitchers are a thing.
 */
export function describeParticipants(state, rules, { personFor, homeOrAway, canScore }) {
  /**
   * Defaulted once, here, rather than guarded field-by-field below.
   *
   * useGame clears its snapshot the instant a game's identity changes (see
   * useGame.js), which is the real fix for a wrong-sport state reaching this
   * function at all. This is the second layer: if one ever slips through
   * some other path, every field this function touches has already been
   * given a safe empty value, so nothing here can throw — it just describes
   * an empty game for one frame instead of crashing the screen. Scattering
   * `?.` through each line below was tried first and missed several spots,
   * which is exactly the bug this rewrite exists to stop happening again.
   */
  const lineups = state.lineups || { home: [], away: [] };
  const battingIndex = state.battingIndex || { home: 0, away: 0 };
  const pitchers = state.pitchers || {};
  const pitchCounts = state.pitchCounts || {};

  const battingSide = state.isTop ? 'away' : 'home';
  const batterId = lineups[battingSide]?.[battingIndex[battingSide]]?.playerId;
  const batter = personFor(batterId);

  const pitcherId = pitchers[fieldingSide(state)];
  const pitcher = personFor(pitcherId);
  const pitchCount = pitchCounts[pitcherId] ?? 0;
  const atLimit = !!rules?.maxPitchesPerOuting
    && pitchCount >= rules.maxPitchesPerOuting;

  /**
   * Trusts the caller's `canScore` completely rather than re-checking
   * state.status here too. See the matching note in basketball/present.js —
   * this redundant internal check meant a game missing its GAME_START event
   * could never have a selectable pitcher card again, no matter how the
   * caller's canScore was fixed upstream.
   */
  const ourPitcher = canScore
    && weArePitching(state.isTop, homeOrAway);

  return [
    {
      key: 'batting',
      label: 'At bat',
      playerId: batterId,
      person: batter,
      detail: batter
        ? `Batting ${ordinal((battingIndex[battingSide] ?? 0) + 1)}`
        : null,
      accent: 'primary',
      substitutable: false,
    },
    {
      key: 'pitching',
      label: 'Pitching',
      playerId: pitcherId,
      person: pitcher,
      detail: pitcher
        ? `${pitchCount} pitches`
        : ourPitcher ? 'Tap to set a pitcher' : null,
      accent: 'gold',
      warn: atLimit,
      // Only our own half. The other team's arm isn't ours to name, and the
      // pitch limit that makes this matter only applies to our players.
      substitutable: ourPitcher,
    },
  ];
}

/**
 * Who's coming up, and what to call them.
 *
 * A scorekeeper is usually also the person shouting "Jack, you're up next", so
 * this is on screen permanently. Baseball returns two slots with the names the
 * sport uses; a sport with no fixed order returns an empty list and the strip
 * disappears on its own.
 */
export function describeUpNext(state, { personFor, battingSide }) {
  const lineups = state.lineups || { home: [], away: [] };
  const battingIndexes = state.battingIndex || { home: 0, away: 0 };

  const side = battingSide || (state.isTop ? 'away' : 'home');
  const lineup = lineups[side];
  if (!lineup?.length) return [];

  const idx = battingIndexes[side] ?? 0;
  const at = (offset) => personFor(lineup[(idx + offset) % lineup.length]?.playerId);

  return [
    { key: 'onDeck', label: 'ON DECK', person: at(1) },
    { key: 'inHole', label: 'IN THE HOLE', person: at(2) },
  ];
}

/**
 * What a substitution sheet should offer for a given slot.
 *
 * Returning the event name rather than performing the change keeps the write
 * path in one place — the shared screen still calls record().
 */
export function describeSubstitution(state, rules, slotKey, { personFor, homeOrAway }) {
  if (slotKey !== 'pitching') return null;
  const lineups = state.lineups || { home: [], away: [] };
  const pitchers = state.pitchers || {};
  const pitchCounts = state.pitchCounts || {};
  return {
    title: "Who's pitching?",
    subtitle: 'Pitches from here on are charged to whoever you pick. '
      + 'Everything already thrown stays with the current pitcher.',
    event: EV.PITCHER_CHANGE,
    currentId: pitchers[fieldingSide(state)],
    options: (lineups[homeOrAway] || [])
      .map((slot) => {
        const person = personFor(slot.playerId);
        if (!person) return null;
        const count = pitchCounts[slot.playerId] ?? 0;
        const max = rules?.maxPitchesPerOuting || 0;
        return {
          playerId: slot.playerId,
          person,
          detail: count > 0
            ? `${count} pitches today${max ? ` of ${max}` : ''}`
            : 'Has not pitched today',
          warn: max > 0 && count >= max,
          warnLabel: 'at the limit',
        };
      })
      .filter(Boolean),
    emptyText: 'No lineup set for this game. Add one from the Schedule tab.',
  };
}

/**
 * One line of plain English for an event, used by the play feed and — more
 * importantly — by the notification functions, which previously imported the
 * baseball engine directly and would have had to grow a sport switch.
 */
export function describeEventLabel(event, state) {
  const period = state?.inning
    ? `${event.isTop ?? state.isTop ? 'T' : 'B'}${event.inning ?? state.inning}`
    : '';
  return { period, kind: event.type };
}

/**
 * One play-feed row: the period marker and the text.
 *
 * The shared viewer used to build "T3"/"B3" from p.isTop and p.inning, which
 * renders blank for a sport whose feed carries a period instead of a half.
 */
export function describeFeedEntry(entry) {
  return {
    marker: entry.kind === 'lifecycle' ? '' : `${entry.isTop ? 'T' : 'B'}${entry.inning}`,
    text: entry.text,
  };
}

/** The line under a participant's name. Baseball's is a batting line. */
export function describeStatLine(slotKey, line) {
  if (slotKey !== 'batting') return null;
  if (!line) return '0-for-0';
  return `${line.H}-for-${line.AB}${line.RBI ? `, ${line.RBI} RBI` : ''}`;
}

/** What the feed says before anything has happened. */
export const EMPTY_FEED_TEXT = 'Waiting for the first pitch.';

/**
 * The stat card, described as sections.
 *
 * PlayerCardScreen was written entirely around baseball — AVG/OBP/SLG, innings
 * pitched, rest days — so a basketball player's card rendered empty. The
 * screen now renders whatever sections it's handed.
 *
 * Returns [] when there's nothing to show, which is how the screen knows to
 * print "no stats yet" rather than a page of zeroes.
 */
export function describeStatCard({ season, career }) {
  const batting = season?.batting || {};
  const pitching = season?.pitching || {};
  const fielding = season?.fielding || {};
  // Career now stores one section per sport a player has been on
  // (players/{id}/career/totals is { baseball: {...}, basketball: {...} }),
  // so a two-sport athlete's basketball seasons never get merged into their
  // batting average. See recomputeCareers in functions/index.js.
  const bb = career?.baseball || {};
  const cb = bb.batting || {};
  const cp = bb.pitching || {};
  const sections = [];

  const avg = (n) => {
    if (n === undefined || n === null) return '.000';
    const s = Number(n).toFixed(3);
    return s.startsWith('0') ? s.slice(1) : s;
  };
  const two = (n) => (n == null ? '0.00' : Number(n).toFixed(2));

  if ((batting.PA || 0) > 0) {
    sections.push({
      key: 'batting',
      label: 'BATTING',
      headline: [
        { value: avg(batting.AVG), label: 'AVG' },
        { value: avg(batting.OBP), label: 'OBP' },
        { value: avg(batting.OPS), label: 'OPS' },
      ],
      grid: [
        ['PA', batting.PA], ['AB', batting.AB], ['H', batting.H],
        ['2B', batting.doubles], ['3B', batting.triples], ['HR', batting.HR],
        ['RBI', batting.RBI], ['R', batting.R], ['BB', batting.BB],
        ['K', batting.K], ['SLG', avg(batting.SLG)],
      ],
    });
  }

  if ((pitching.outs || 0) > 0 || (pitching.pitches || 0) > 0) {
    sections.push({
      key: 'pitching',
      label: 'PITCHING',
      headline: [
        { value: pitching.IP ?? '0.0', label: 'IP' },
        { value: two(pitching.ERA), label: 'ERA' },
        { value: two(pitching.WHIP), label: 'WHIP' },
      ],
      grid: [
        ['K', pitching.K], ['BB', pitching.BB], ['H', pitching.H],
        ['ER', pitching.ER], ['HR', pitching.HR], ['BF', pitching.BF],
        ['Pitches', pitching.pitches],
      ],
    });
  }

  if (fielding.PO || fielding.A || fielding.E) {
    sections.push({
      key: 'fielding', label: 'FIELDING',
      grid: [['PO', fielding.PO], ['A', fielding.A], ['E', fielding.E]],
    });
  }

  if (cb.PA > 0 || cp.outs > 0) {
    sections.push({
      key: 'career',
      label: `CAREER · ${bb.seasonCount || 1} season${(bb.seasonCount || 1) === 1 ? '' : 's'}`,
      grid: [
        ...(cb.PA > 0 ? [['AVG', avg(cb.AVG)], ['OPS', avg(cb.OPS)],
                          ['H', cb.H], ['HR', cb.HR], ['RBI', cb.RBI], ['R', cb.R]] : []),
        ...(cp.outs > 0 ? [['IP', cp.IP], ['ERA', two(cp.ERA)],
                           ['K', cp.K], ['BB', cp.BB]] : []),
      ],
    });
  }

  return sections;
}

/** Today's line, shown above the season when a game is in progress. */
export function describeTodayLine(live) {
  if (!live) return null;
  return [
    { value: `${live.H ?? 0}-for-${live.AB ?? 0}`, label: 'AT THE PLATE' },
    { value: live.RBI ?? 0, label: 'RBI' },
    { value: live.R ?? 0, label: 'RUNS' },
  ];
}

/**
 * A moment worth a brief animated banner for everyone watching.
 *
 * This is deliberately client-side and reuses data every viewer already has:
 * each connected device subscribes to the same events feed, so every viewer
 * independently detects the same new event arriving and shows its own local
 * banner — no server broadcast needed, and nothing new to write to Firestore.
 *
 * Kept narrow on purpose. A home run happens a handful of times a game and
 * deserves the screen; a single happens constantly and would turn the
 * banner into wallpaper nobody reads anymore. Strikeout is included because
 * it's dramatic for both sides of the game, the same reason real broadcasts
 * flash a K for either team's pitcher.
 *
 * @param event the raw event as it was recorded (has .type, .payload)
 * @param personFor looks up a player's name for the text
 * @returns null, or { text, tone } — tone drives the banner's color
 */
export function describeMoment(event, state, { personFor } = {}) {
  const person = event.payload?.playerId ? personFor?.(event.payload.playerId) : null;
  const first = person?.firstName;

  switch (event.type) {
    case EV.HOME_RUN:
      return { text: first ? `${first.toUpperCase()} HOMERS!` : 'HOME RUN!', tone: 'big' };
    case EV.TRIPLE:
      return { text: first ? `${first.toUpperCase()} TRIPLES!` : 'TRIPLE!', tone: 'good' };
    case EV.STRIKEOUT:
      return { text: 'STRIKEOUT!', tone: 'good' };
    default:
      return null;
  }
}

/** Which participants a sport considers "on the clock" for auto-play audio. */
export const walkUpSlot = 'batting';

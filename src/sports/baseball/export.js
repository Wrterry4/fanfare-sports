/**
 * export.js — Season and career export.
 *
 * CSV for coaches who want it in a spreadsheet, JSON for portability.
 * The JSON shape is the one that matters long-term: a parent should be able
 * to walk away with their kid's complete history in a file that another
 * system could read.
 */

const BATTING_COLUMNS = [
  ['player', 'Player'], ['PA', 'PA'], ['AB', 'AB'], ['H', 'H'],
  ['singles', '1B'], ['doubles', '2B'], ['triples', '3B'], ['HR', 'HR'],
  ['R', 'R'], ['RBI', 'RBI'], ['BB', 'BB'], ['K', 'K'], ['HBP', 'HBP'],
  ['SB', 'SB'], ['CS', 'CS'], ['TB', 'TB'],
  ['AVG', 'AVG'], ['OBP', 'OBP'], ['SLG', 'SLG'], ['OPS', 'OPS'],
];

const PITCHING_COLUMNS = [
  ['player', 'Player'], ['IP', 'IP'], ['BF', 'BF'], ['H', 'H'], ['R', 'R'],
  ['ER', 'ER'], ['BB', 'BB'], ['K', 'K'], ['HBP', 'HBP'], ['HR', 'HR'],
  ['pitches', 'Pitches'], ['strikes', 'Strikes'], ['strikePct', 'Strike%'],
  ['ERA', 'ERA'], ['WHIP', 'WHIP'],
];

const FIELDING_COLUMNS = [
  ['player', 'Player'], ['PO', 'PO'], ['A', 'A'], ['E', 'E'],
  ['TC', 'TC'], ['FPCT', 'FPCT'],
];

/** RFC 4180 escaping — names with commas or quotes are common enough to matter. */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, columns) {
  const header = columns.map(([, label]) => csvCell(label)).join(',');
  const body = rows.map((row) =>
    columns.map(([key]) => csvCell(row[key])).join(',')
  );
  return [header, ...body].join('\n');
}

function toRows(statsGroup, nameFor) {
  return Object.entries(statsGroup || {})
    .map(([playerId, s]) => ({ player: nameFor(playerId), playerId, ...s }))
    .sort((a, b) => String(a.player).localeCompare(String(b.player)));
}

/**
 * One CSV per stat group. Returns a map of filename -> contents so the caller
 * can hand it to a share sheet or zip it.
 */
export function exportCsv(stats, { nameFor = (id) => id, label = 'season' } = {}) {
  return {
    [`${label}-batting.csv`]:  toCsv(toRows(stats.batting, nameFor), BATTING_COLUMNS),
    [`${label}-pitching.csv`]: toCsv(toRows(stats.pitching, nameFor), PITCHING_COLUMNS),
    [`${label}-fielding.csv`]: toCsv(toRows(stats.fielding, nameFor), FIELDING_COLUMNS),
  };
}

/** A single flat CSV for one player across seasons — the career view. */
export function exportPlayerCareerCsv(seasons, group = 'batting') {
  const columns = group === 'pitching' ? PITCHING_COLUMNS
    : group === 'fielding' ? FIELDING_COLUMNS
    : BATTING_COLUMNS;
  const withSeason = [['season', 'Season'], ['team', 'Team'], ...columns.slice(1)];
  const rows = seasons.map((s) => ({
    season: s.season,
    team: s.teamName || s.teamId,
    ...(s.stats?.[group] || {}),
  }));
  return toCsv(rows, withSeason);
}

/**
 * Portable career export. Versioned, so a future import path has something
 * to branch on.
 */
export function exportCareerJson(player, seasons, careerTotals) {
  return JSON.stringify({
    format: 'youth-baseball-career',
    version: 1,
    exportedAt: new Date().toISOString(),
    player: {
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      birthYear: player.birthYear,
    },
    seasons: seasons.map((s) => ({
      season: s.season,
      teamId: s.teamId,
      teamName: s.teamName || null,
      orgName: s.orgName || null,
      division: s.division || null,
      jerseyNumber: s.jerseyNumber ?? null,
      stats: s.stats,
    })),
    career: careerTotals,
  }, null, 2);
}

/** Full game record — event log included, so a game can be re-derived exactly. */
export function exportGameJson(game, events, stats, nameFor = (id) => id) {
  return JSON.stringify({
    format: 'youth-baseball-game',
    version: 1,
    exportedAt: new Date().toISOString(),
    game: {
      id: game.id,
      date: game.date,
      opponent: game.opponent,
      homeOrAway: game.homeOrAway,
      finalScore: game.score,
      status: game.status,
      rules: game.rulesSnapshot,
    },
    roster: Object.keys(stats.batting || {}).map((id) => ({ id, name: nameFor(id) })),
    events: events.filter((e) => !e.voided).map((e) => ({
      seq: e.seq, type: e.type, payload: e.payload,
    })),
    stats,
  }, null, 2);
}

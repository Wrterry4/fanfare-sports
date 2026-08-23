/**
 * rosterImport.js — Bringing last season's roster onto a new team.
 *
 * A coach who runs a spring team and a fall team usually has most of the same
 * kids. Typing fourteen names in again is the longest piece of manual entry in
 * the app, and it's entry they've already done once.
 *
 * ── Import pulls IDENTITY, not a copy ──────────────────────────────────────
 *
 * The imported player keeps their playerId. That id is the whole point of
 * having one: it's what career totals accumulate against across seasons, and
 * what a parent is linked to. Creating a second record for the same child
 * would silently fork both — a new player with no history whose parents can't
 * see them, which looks like the import worked and is worse than not importing.
 *
 * So the roster entry is the only thing created; the player record is joined
 * to the new team, not duplicated.
 *
 * ── What does NOT come over ────────────────────────────────────────────────
 *
 * The jersey number. It belongs to a season on a team, not to the child —
 * numbers are reassigned every spring and two teams have no reason to agree.
 * Carrying one over would quietly seed collisions on the new roster, and a
 * wrong number is worse than a blank one because nobody thinks to check it.
 * Position comes over as a starting point, since it describes the player.
 *
 * ── Who may be imported ────────────────────────────────────────────────────
 *
 * Only from teams you're STAFF on. The roster of a team you follow as a parent
 * is other people's children, and pulling it onto a team you coach is not a
 * convenience.
 *
 * ── More than one source team ──────────────────────────────────────────────
 *
 * A coach merging two teams into one picks from each in turn, and the choices
 * accumulate until they import. Because identity is the playerId, the same
 * child appearing on both source teams is ONE row to import — already picked
 * from the first team, and shown greyed on the second rather than silently
 * ignored, so nobody wonders why they can't tick it.
 */

import { hasLeft } from './rosterStatus.js';

const STAFF_ROLES = ['owner', 'coach'];

const clean = (s) => (s ?? '').toString().trim();

const millis = (v) => {
  if (!v) return 0;
  if (typeof v.toDate === 'function') return v.toDate().getTime() || 0;
  if (typeof v.toMillis === 'function') return v.toMillis() || 0;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
};

/**
 * The teams offered in the picker: every OTHER team you coach.
 *
 * @param teams          every team you're on, from useTeams()
 * @param roleByTeam     { [teamId]: role } from useMyTeamPlayers()
 * @param currentTeamId  the team being imported INTO, always excluded
 * @returns teams, newest first — last season is the one being copied
 */
export function importSourceTeams(teams, roleByTeam = {}, currentTeamId = null) {
  return (teams || [])
    .filter((t) => t?.id && t.id !== currentTeamId)
    .filter((t) => STAFF_ROLES.includes(roleByTeam[t.id]))
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt)
                 || clean(a.name).localeCompare(clean(b.name)));
}

/**
 * One row per player on the source team, annotated against the destination.
 *
 * Already-on-roster is decided by playerId, not by name: same identity, same
 * id, exactly. Two different kids called Jack Miller stay two rows.
 *
 * @param sourceRoster  roster rows of the team being imported FROM
 * @param targetRoster  roster rows of the team being imported INTO
 * @returns [{ playerId, firstName, lastName, formerJersey, primaryPosition,
 *             alreadyOnRoster, leftSourceTeam, selected }]
 */
export function buildImportRows(sourceRoster, targetRoster = []) {
  const onTarget = new Set((targetRoster || []).map((p) => p?.playerId).filter(Boolean));

  return (sourceRoster || [])
    .filter((p) => p?.playerId)
    .map((p) => {
      const alreadyOnRoster = onTarget.has(p.playerId);
      // Someone who left the old team is still importable — a kid who left in
      // May may well be on the fall roster — but the row says so, because
      // otherwise it looks like the old team still has them.
      const leftSourceTeam = hasLeft(p);
      return {
        playerId: p.playerId,
        firstName: clean(p.firstName),
        lastName: clean(p.lastName),
        leftSourceTeam,
        // Shown only so the coach recognizes the row. It is NOT imported —
        // see the header.
        formerJersey: p.jerseyNumber == null ? null : Number(p.jerseyNumber),
        primaryPosition: p.primaryPosition ?? null,
        alreadyOnRoster,
        selected: !alreadyOnRoster && !leftSourceTeam,
      };
    })
    .sort((a, b) => (a.formerJersey ?? 999) - (b.formerJersey ?? 999)
                 || a.firstName.localeCompare(b.firstName));
}

/** The ids checked when the list first opens — everyone not already here. */
export const defaultSelection = (rows) =>
  (rows || []).filter((r) => r.selected).map((r) => r.playerId);

/**
 * What actually gets sent, in list order.
 *
 * Identity only. Names travel because the roster entry denormalizes them for
 * the whole team to read; the number is deliberately absent.
 */
export function importSelection(rows, selectedIds) {
  const chosen = new Set(selectedIds || []);
  return (rows || [])
    .filter((r) => chosen.has(r.playerId))
    // Someone already on this roster has nothing to import — re-sending them
    // would only overwrite the number they were just given here.
    .filter((r) => !r.alreadyOnRoster)
    .map((r) => ({
      playerId: r.playerId,
      firstName: r.firstName,
      lastName: r.lastName,
      primaryPosition: r.primaryPosition ?? null,
    }));
}

/**
 * How a row should render, given everything picked so far.
 *
 *   ALREADY_HERE     on the destination roster — nothing to import
 *   PICKED_ELSEWHERE the same child, already picked from another source team
 *   ON / OFF         ticked or not
 *
 * @param picked  { [playerId]: sourceTeamId } — every pick across every team
 */
export const ROW_STATE = {
  ON: 'on',
  OFF: 'off',
  ALREADY_HERE: 'already-here',
  PICKED_ELSEWHERE: 'picked-elsewhere',
};

export function rowState(row, picked = {}, sourceTeamId = null) {
  if (!row) return ROW_STATE.OFF;
  if (row.alreadyOnRoster) return ROW_STATE.ALREADY_HERE;
  const from = picked[row.playerId];
  if (from && from !== sourceTeamId) return ROW_STATE.PICKED_ELSEWHERE;
  return from ? ROW_STATE.ON : ROW_STATE.OFF;
}

/** Greyed out and untickable — the two states that aren't a choice. */
export const rowIsLocked = (state) =>
  state === ROW_STATE.ALREADY_HERE || state === ROW_STATE.PICKED_ELSEWHERE;

/**
 * Everything picked, grouped into one import per source team.
 *
 * @param picked      { [playerId]: sourceTeamId }
 * @param rowsBySource { [sourceTeamId]: rows } — as loaded by the sheet
 * @returns [{ fromTeamId, players: [{ playerId, firstName, ... }] }]
 */
export function importsBySource(picked = {}, rowsBySource = {}) {
  const bySource = new Map();
  for (const [playerId, from] of Object.entries(picked)) {
    if (!from) continue;
    if (!bySource.has(from)) bySource.set(from, []);
    bySource.get(from).push(playerId);
  }

  return [...bySource.entries()]
    .map(([fromTeamId, ids]) => ({
      fromTeamId,
      players: importSelection(rowsBySource[fromTeamId], ids),
    }))
    .filter((batch) => batch.players.length);
}

/**
 * "3 players added · 2 families invited" — plain enough to put in a toast.
 *
 * The invite count is worth saying out loud: the coach didn't ask for it, and
 * it's the difference between a roster that works and one whose parents are
 * quietly missing.
 */
export function importSummary({ added = 0, failed = 0, invited = 0 } = {}) {
  const parts = [`${added} player${added === 1 ? '' : 's'} added`];
  if (invited) parts.push(`${invited} famil${invited === 1 ? 'y' : 'ies'} invited`);
  if (failed) parts.push(`${failed} couldn't be added`);
  return parts.join(' · ');
}

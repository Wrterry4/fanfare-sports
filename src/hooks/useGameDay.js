/**
 * useGameDay.js — Everything the Game Day screen needs, loaded rather than passed.
 *
 * GameDayScreen originally destructured teamId, gameId, team, roster, rules and
 * config out of route.params. That was a placeholder from before there was any
 * real data flow, and it breaks the moment the screen is a TAB — tabs receive
 * no params.
 *
 * So the screen resolves its own context: active team, the game in progress (or
 * the next scheduled one), the roster, and the engine config derived from them.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  db, doc, collection, query, where, orderBy, limit, onSnapshot, getDoc, setDoc,
} from '../services/firebase';
import { useActiveTeam } from './ActiveTeam.jsx';
import { sportForTeam } from '../sports/registry.js';
import { ensureStatsAccess } from '../services/statsService.js';
import { isGame } from '../shared/eventTypes.js';
import { splitRoster } from '../shared/rosterStatus.js';

export function useGameDay() {
  // Selected in the account menu; persists across launches.
  const { team, loading: teamsLoading } = useActiveTeam();

  const [game, setGame] = useState(null);
  const [allGames, setAllGames] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [gameLoading, setGameLoading] = useState(true);
  // Everyone the team has ever rostered, current and former. Split below:
  // `roster` is who's on the team NOW, which is what every game-facing screen
  // means by the word.
  const [allRoster, setAllRoster] = useState([]);
  const [error, setError] = useState(null);

  // ---- the game in progress, or the next one up ---------------------------
  useEffect(() => {
    if (!team?.id) { setGameLoading(false); return undefined; }
    setGameLoading(true);

    // Deliberately NOT `where('status','in',[...]) + orderBy('date')`.
    //
    // That combination needs a composite index, and until the index finishes
    // building the query fails — silently, from the user's point of view,
    // because an onSnapshot error just leaves the screen empty. A single-field
    // orderBy uses an automatic index and always works. Filtering three or
    // four games client-side costs nothing.
    const q = query(collection(db, 'teams', team.id, 'games'), orderBy('date', 'asc'));

    return onSnapshot(q,
      (snap) => {
        const everything = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Practices and team events share this collection but are never
        // scored, so Game Day and the lineup picker only ever see games.
        const all = everything.filter(isGame);
        // A live game always wins. Otherwise the next scheduled one, so the
        // screen shows what's coming rather than something from March.
        const now = Date.now();
        const dateOf = (g) => g.date?.toDate?.()?.getTime?.() ?? new Date(g.date ?? 0).getTime();
        const active = all.find((g) => g.status === 'live')
                    ?? all.filter((g) => g.status === 'scheduled')
                           .sort((a, b) => Math.abs(dateOf(a) - now) - Math.abs(dateOf(b) - now))[0]
                    ?? all.filter((g) => g.status === 'final' || g.status === 'amended')
                           .sort((a, b) => dateOf(b) - dateOf(a))[0]
                    ?? null;
        setGame(active);
        setAllGames(all);
        setAllEvents(everything);
        setGameLoading(false);
      },
      (e) => { setError(e); setGameLoading(false); });
  }, [team?.id]);

  // ---- roster, joined to the root player documents ------------------------
  useEffect(() => {
    if (!team?.id) return undefined;

    return onSnapshot(collection(db, 'teams', team.id, 'roster'), async (snap) => {
      try {
        // The roster document is the source for identity — name, number,
        // position — and every member can read it.
        //
        // It used to join to /players for names, which a parent can only read
        // for their OWN child. Every other row came back null and was dropped,
        // so the roster was nearly empty and the scoreboard fell back to raw
        // document ids. That was the "jumbled characters".
        const rows = snap.docs.map((r) => ({ playerId: r.id, ...r.data() }));

        // Older rosters predate the denormalized name. Anyone who can read
        // /players fills the gap in, which repairs the data in place rather
        // than needing a migration.
        await Promise.all(rows.map(async (row) => {
          if (row.firstName) return;
          const p = await getDoc(doc(db, 'players', row.playerId)).catch(() => null);
          if (!p?.exists?.()) return;
          row.firstName = p.data().firstName;
          row.lastName = p.data().lastName;
          setDoc(doc(db, 'teams', team.id, 'roster', row.playerId), {
            firstName: p.data().firstName ?? null,
            lastName: p.data().lastName ?? null,
          }, { merge: true }).catch(() => {});
        }));

        setAllRoster(rows);
      } catch (e) { setError(e); }
    }, (e) => setError(e));
  }, [team?.id]);

  /**
   * Current squad and former players, from the one subscription.
   *
   * A player who has left keeps their roster entry — it's the only place the
   * whole team can read their name, and every box score they appear in needs
   * it. They're just not on the team any more, so they're out of `roster`.
   */
  const { active: roster, left: formerPlayers } = useMemo(
    () => splitRoster(allRoster), [allRoster]);

  /**
   * Silent one-time repair for teams whose access lists predate the triggers
   * that maintain them. Runs at most once per team — see ensureStatsAccess.
   * Placed here rather than in a screen so it covers every way into a team.
   */
  useEffect(() => {
    if (!team?.id) return;
    // The function itself re-checks staff server-side; this only avoids a
    // guaranteed permission-denied round trip for everyone else.
    ensureStatsAccess(team, true);
  }, [team?.id, team?.statsAccessVersion]);

  // ---- engine inputs ------------------------------------------------------
  /**
   * The team's sport, not baseball's.
   *
   * This hook used to import buildGameConfig and RULE_PRESETS straight from
   * the baseball pack, which meant a basketball team was handed a baseball
   * config — no periodScores, no onCourt — and the first screen that read
   * state.periodScores.away crashed on undefined.
   */
  const sport = useMemo(() => sportForTeam(team), [team?.sport]);

  const rules = useMemo(() => {
    if (game?.rulesSnapshot) return game.rulesSnapshot;   // frozen at creation
    if (team?.rules) return team.rules;
    // Each pack names its own fallback; there is no cross-sport default.
    return sport.DEFAULT_RULES;
  }, [game?.rulesSnapshot, team?.rules, sport]);

  // Lineup falls back to the full roster in jersey order, which is what
  // continuous batting order means anyway — and it lets a game be scored
  // before anyone has set a lineup.
  const config = useMemo(() => {
    if (!game) return null;
    const lineup = game.lineup?.length
      ? game.lineup
      : roster.map((p, i) => ({ playerId: p.playerId, battingOrder: i + 1,
                                position: p.primaryPosition }));
    return sport.buildGameConfig({ ...game, lineup });
  }, [game, roster, sport]);

  const names = useMemo(() => {
    // Built from the FULL roster, not the current squad: a finished game's
    // box score names whoever played in it, including players who have since
    // left the team.
    const map = Object.fromEntries(
      allRoster.map((p) => [p.playerId, `${p.firstName} ${p.lastName}`.trim()])
    );
    // The other dugout is anonymous slots, but they still appear as the batter,
    // on deck, and in the hole. Numbering them 1-9 beats showing a raw
    // placeholder id.
    for (let i = 1; i <= 12; i++) map[`opp_${i}`] = `Batter ${i}`;
    map.opp_p = 'Opponent';
    return map;
  }, [allRoster]);

  return {
    team,
    game,
    allGames,
    allEvents,
    roster,          // on the team now
    formerPlayers,   // left, but still named in the record
    allRoster,
    rules,
    config,
    names,
    loading: teamsLoading || gameLoading,
    error,
  };
}

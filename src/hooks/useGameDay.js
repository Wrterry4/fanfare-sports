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
import { buildGameConfig } from '../sports/baseball/config.js';
import { isGame } from '../shared/eventTypes.js';
import { RULE_PRESETS, DEFAULT_RULES } from '../sports/baseball/rules.js';

export function useGameDay() {
  // Selected in the account menu; persists across launches.
  const { team, loading: teamsLoading } = useActiveTeam();

  const [game, setGame] = useState(null);
  const [allGames, setAllGames] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [gameLoading, setGameLoading] = useState(true);
  const [roster, setRoster] = useState([]);
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

        setRoster(rows.sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999)));
      } catch (e) { setError(e); }
    }, (e) => setError(e));
  }, [team?.id]);

  // ---- engine inputs ------------------------------------------------------
  const rules = useMemo(() => {
    if (game?.rulesSnapshot) return game.rulesSnapshot;   // frozen at creation
    if (team?.rules) return team.rules;
    return RULE_PRESETS.kidPitch10U ?? DEFAULT_RULES;
  }, [game?.rulesSnapshot, team?.rules]);

  // Lineup falls back to the full roster in jersey order, which is what
  // continuous batting order means anyway — and it lets a game be scored
  // before anyone has set a lineup.
  const config = useMemo(() => {
    if (!game) return null;
    const lineup = game.lineup?.length
      ? game.lineup
      : roster.map((p, i) => ({ playerId: p.playerId, battingOrder: i + 1,
                                position: p.primaryPosition }));
    return buildGameConfig({ ...game, lineup });
  }, [game, roster]);

  const names = useMemo(() => {
    const map = Object.fromEntries(
      roster.map((p) => [p.playerId, `${p.firstName} ${p.lastName}`.trim()])
    );
    // The other dugout is anonymous slots, but they still appear as the batter,
    // on deck, and in the hole. Numbering them 1-9 beats showing a raw
    // placeholder id.
    for (let i = 1; i <= 12; i++) map[`opp_${i}`] = `Batter ${i}`;
    map.opp_p = 'Opponent';
    return map;
  }, [roster]);

  return {
    team,
    game,
    allGames,
    allEvents,
    roster,
    rules,
    config,
    names,
    loading: teamsLoading || gameLoading,
    error,
  };
}

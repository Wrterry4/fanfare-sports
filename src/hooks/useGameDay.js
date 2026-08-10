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
  db, doc, collection, query, where, orderBy, limit, onSnapshot, getDoc,
} from '../services/firebase';
import { useTeams } from './useTeams.js';
import { buildGameConfig } from '../sports/baseball/config.js';
import { RULE_PRESETS, DEFAULT_RULES } from '../sports/baseball/rules.js';

export function useGameDay() {
  const { teams, loading: teamsLoading } = useTeams();
  const team = teams?.[0] ?? null;        // multi-team switching comes later

  const [game, setGame] = useState(null);
  const [allGames, setAllGames] = useState([]);
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
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
        setGameLoading(false);
      },
      (e) => { setError(e); setGameLoading(false); });
  }, [team?.id]);

  // ---- roster, joined to the root player documents ------------------------
  useEffect(() => {
    if (!team?.id) return undefined;

    return onSnapshot(collection(db, 'teams', team.id, 'roster'), async (snap) => {
      try {
        const rows = await Promise.all(snap.docs.map(async (r) => {
          const p = await getDoc(doc(db, 'players', r.id)).catch(() => null);
          if (!p?.exists?.()) return null;
          return {
            playerId: r.id,
            ...p.data(),
            ...r.data(),       // roster fields (jersey, position) win
          };
        }));
        setRoster(rows.filter(Boolean).sort(
          (a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999)
        ));
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

  const names = useMemo(() => Object.fromEntries(
    roster.map((p) => [p.playerId, `${p.firstName} ${p.lastName}`.trim()])
  ), [roster]);

  return {
    team,
    game,
    allGames,
    roster,
    rules,
    config,
    names,
    loading: teamsLoading || gameLoading,
    error,
  };
}

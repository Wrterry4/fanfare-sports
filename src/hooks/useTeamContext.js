/**
 * useTeamContext.js — Everything Game Day needs, resolved on its own.
 *
 * GameDayScreen originally took team, roster, game and config as navigation
 * params. That works when a schedule screen pushes it; it does not work as a
 * bottom tab, which mounts with no params at all. The screen has to resolve
 * its own context.
 *
 * Note on queries: a subcollection query like teams/{id}/games IS allowed,
 * because the rule depends only on team membership, not on document fields —
 * Firestore can prove every result is readable. A query across a top-level
 * collection whose rule varies per document cannot be proven safe and is
 * rejected outright.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  db, doc, collection, query, orderBy, limit, onSnapshot, getDoc, getDocs,
} from '../services/firebase';
import { useTeams } from './useTeams.js';
import { buildGameConfig } from '../sports/baseball/config.js';
import { resolveRules } from '../sports/baseball/rules.js';

export function useTeamContext() {
  const { teams, loading: teamsLoading } = useTeams();
  const team = teams?.[0] ?? null;          // multi-team switcher comes later

  const [roster, setRoster] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);

  // ---- roster: team roster entries joined to root player documents --------
  useEffect(() => {
    if (!team?.id) { setRoster(null); return undefined; }
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDocs(collection(db, 'teams', team.id, 'roster'));
        const rows = await Promise.all(snap.docs.map(async (d) => {
          // Jersey and position live on the roster entry; names live on the
          // root player document, because players outlive teams.
          const playerSnap = await getDoc(doc(db, 'players', d.id)).catch(() => null);
          const p = playerSnap?.data?.() ?? {};
          return {
            playerId: d.id,
            jerseyNumber: d.data().jerseyNumber ?? null,
            primaryPosition: d.data().primaryPosition ?? null,
            active: d.data().active !== false,
            firstName: p.firstName ?? 'Player',
            lastName: p.lastName ?? '',
          };
        }));
        if (!cancelled) {
          setRoster(rows
            .filter((r) => r.active)
            .sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999)));
        }
      } catch (e) { if (!cancelled) { setError(e); setRoster([]); } }
    })();

    return () => { cancelled = true; };
  }, [team?.id]);

  // ---- the game to show: live if there is one, else the most recent -------
  useEffect(() => {
    if (!team?.id) { setGame(null); return undefined; }
    const q = query(
      collection(db, 'teams', team.id, 'games'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    return onSnapshot(q, (snap) => {
      const games = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setGame(games.find((g) => g.status === 'live')
           ?? games.find((g) => g.status === 'scheduled')
           ?? games[0]
           ?? null);
    }, (e) => { setError(e); setGame(null); });
  }, [team?.id]);

  // ---- engine inputs -----------------------------------------------------
  const rules = useMemo(
    () => resolveRules(game?.rulesSnapshot ?? team?.rules ?? {}),
    [game?.rulesSnapshot, team?.rules]
  );

  // The lineup defaults to the full roster in jersey order. Continuous batting
  // order is the norm in youth ball, so this is usually right as-is.
  const config = useMemo(() => {
    if (!game || !roster) return null;
    const lineup = (game.lineup?.length ? game.lineup : roster.map((r, i) => ({
      playerId: r.playerId, battingOrder: i + 1, position: r.primaryPosition,
    })));
    return buildGameConfig({ ...game, lineup });
  }, [game, roster]);

  const names = useMemo(() => Object.fromEntries(
    (roster ?? []).map((r) => [r.playerId, `${r.firstName} ${r.lastName}`.trim()])
  ), [roster]);

  return {
    team,
    roster,
    game,
    rules,
    config,
    names,
    error,
    loading: teamsLoading || (!!team && (roster === null || game === undefined)),
    hasTeam: !!team,
    hasGame: !!game,
  };
}

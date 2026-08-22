/**
 * useRsvps.js — One event's attendance.
 *
 * Lives here rather than inside RsvpRow because three things now need the same
 * data: the count on the collapsed schedule card, the sheet listing everyone,
 * and the answer buttons themselves. Subscribing separately in each would mean
 * three listeners per event and three chances for them to disagree mid-render.
 *
 * NOTE ON LISTENER COUNT: the schedule mounts one of these per row, so a
 * twenty-game season holds twenty listeners open. That's fine at this size and
 * it's what makes the counts live without a tap. If a season ever runs long
 * enough to feel it, the move is a denormalized `rsvpCounts` map on the event
 * document, maintained by a Cloud Function — not a lazier listener here, which
 * would just trade the cost for a blank bar until you expand the row.
 */

import { useState, useEffect, useMemo } from 'react';

import { subscribeRsvps } from '../services/eventService.js';
import { tallyRsvps, rosterAttendance } from '../shared/eventTypes.js';

export function useRsvps(teamId, eventId, roster, { enabled = true } = {}) {
  const [rsvps, setRsvps] = useState([]);

  useEffect(() => {
    if (!enabled || !teamId || !eventId) { setRsvps([]); return undefined; }
    return subscribeRsvps(teamId, eventId, setRsvps);
  }, [teamId, eventId, enabled]);

  const counts = useMemo(() => tallyRsvps(rsvps), [rsvps]);

  const attendance = useMemo(
    () => rosterAttendance(roster, rsvps), [roster, rsvps]);

  const byId = useMemo(
    () => Object.fromEntries(rsvps.map((r) => [r.id, r])), [rsvps]);

  return { rsvps, counts, attendance, byId };
}

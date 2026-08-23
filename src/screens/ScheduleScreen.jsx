/**
 * ScheduleScreen.jsx — Games.
 *
 * Same two gestures as Roster: ADD in the header toggles a persistent form;
 * tapping a game expands it in place for details and editing.
 *
 * Only the opponent is required. A coach entering a season from a league PDF
 * often has half the details and shouldn't be blocked on the rest.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';

import { db, collection, query, orderBy, onSnapshot } from '../services/firebase';
import { useGameDay } from '../hooks/useGameDay.js';
import { createEvent, updateEvent, deleteEvent, setRsvp } from '../services/eventService.js';
import RsvpRow from '../components/RsvpRow.jsx';
import AttendanceSheet, { AttendanceBar } from '../components/AttendanceSheet.jsx';
import { useRsvps } from '../hooks/useRsvps.js';
import { useMyRole } from '../hooks/useMyRole.js';
import { sportForTeam } from '../sports/registry.js';
import { splitUpcomingPast, groupEventsByDate, dateKey } from '../shared/scheduleFilters.js';
import MonthCalendar from '../components/MonthCalendar.jsx';
import {
  EVENT_TYPES, EVENT_ORDER, typeOf, isGame, eventTitle, fieldsFor, venueOf,
} from '../shared/eventTypes.js';
import { confirm, notify } from '../utils/confirm.js';
import { DateField, TimeField, combineDateTime, splitDateTime } from '../components/DateField';
import AppHeader, { HeaderButton } from '../components/AppHeader.jsx';
import FinalLineScore from '../components/FinalLineScore.jsx';
import AccountSheet from '../components/AccountSheet.jsx';
import ScreenRoot from '../components/ScreenRoot.jsx';
import Centered from '../components/Centered.jsx';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';
import { useTeamSurface } from '../theme/useSportTheme.js';
import { inputStyle, multilineStyle } from '../theme/inputs.js';

const emptyForm = () => ({
  type: EVENT_TYPES.GAME,
  title: '', opponent: '', homeOrAway: 'home',
  dateStr: splitDateTime(new Date()).dateStr, timeStr: '17:30',
  location: '', field: '', notes: '',
});

export default function ScheduleScreen() {
  const { team, rules, roster, loading } = useGameDay();
  const surface = useTeamSurface();
  const [games, setGames] = useState([]);
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [menu, setMenu] = useState(false);
  /**
   * Defaults to 'calendar' — it's the primary control now (see
   * ScheduleViewSwitch), and a coach opening Schedule most often wants "what
   * does this month look like," not a flat list. Upcoming and Past are one
   * tap away for the narrower question.
   */
  const [view, setView] = useState('calendar');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    if (!team?.id) return undefined;
    const q = query(collection(db, 'teams', team.id, 'games'), orderBy('date', 'asc'));
    return onSnapshot(q, (snap) =>
      setGames(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setGames([]));
  }, [team?.id]);

  const { upcoming, past } = useMemo(() => splitUpcomingPast(games), [games]);
  const eventsByDate = useMemo(() => groupEventsByDate(games), [games]);
  const eventDateKeys = useMemo(() => new Set(Object.keys(eventsByDate)), [eventsByDate]);
  const selectedDateEvents = selectedDate ? (eventsByDate[dateKey(selectedDate)] || []) : [];

  const remove = useCallback(async (g) => {
    const ok = await confirm({
      title: `Delete ${eventTitle(g, team?.name)}?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete', destructive: true,
    });
    if (!ok) return;
    try { await deleteEvent(team.id, g.id); setExpandedId(null); }
    catch (e) { notify('Could not delete', e.message); }
  }, [team?.id]);

  const setStatus = useCallback(async (g, status) => {
    const patch = { status };
    if (status === 'live' && !g.actualStartAt) patch.actualStartAt = new Date();
    try { await updateEvent(team.id, g.id, patch); }
    catch (e) { notify('Could not update', e.message); }
  }, [team?.id]);

  if (loading) return <Centered><ActivityIndicator color={colors.primary} /></Centered>;
  if (!team) return <Centered><Text style={styles.msg}>No team yet.</Text></Centered>;

  return (
    <ScreenRoot style={[styles.root, { backgroundColor: surface }]}>
      <AppHeader
        team={team}
        onMenu={() => setMenu(true)}
        right={<HeaderButton label={adding ? 'DONE' : '+ EVENT'} active={adding}
                 onPress={() => setAdding((a) => !a)} />}
      />
      <AccountSheet visible={menu} onClose={() => setMenu(false)} />

      <ScheduleViewSwitch value={view} onChange={setView} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {adding && <AddGameForm team={team} rules={rules} onDone={() => setAdding(false)} />}

          {games.length === 0 && !adding && (
            <Text style={styles.empty}>
              Nothing scheduled yet. Tap + EVENT to add a game, practice, or
              anything else on the calendar.
            </Text>
          )}

          {games.length > 0 && view === 'calendar' && (
            <>
              <MonthCalendar
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                eventDates={eventDateKeys}
              />
              <View style={styles.calendarDivider} />
              {!selectedDate ? (
                <Text style={styles.empty}>
                  Tap a date with a dot to see what's scheduled.
                </Text>
              ) : selectedDateEvents.length === 0 ? (
                <Text style={styles.empty}>Nothing scheduled this day.</Text>
              ) : (
                selectedDateEvents.map((g) => (
                  <GameRow
                    key={g.id}
                    game={g}
                    team={team}
                    roster={roster}
                    expanded={expandedId === g.id}
                    onToggle={() => setExpandedId(expandedId === g.id ? null : g.id)}
                    onRemove={() => remove(g)}
                    onStatus={(s) => setStatus(g, s)}
                  />
                ))
              )}
            </>
          )}

          {games.length > 0 && view !== 'calendar' && (
            <>
              {(view === 'upcoming' ? upcoming : past).length === 0 && (
                <Text style={styles.empty}>
                  {view === 'upcoming'
                    ? "Nothing coming up. Tap + EVENT to add the next one."
                    : 'No past events yet.'}
                </Text>
              )}
              {(view === 'upcoming' ? upcoming : past).map((g) => (
                <GameRow
                  key={g.id}
                  game={g}
                  team={team}
                  roster={roster}
                  expanded={expandedId === g.id}
                  onToggle={() => setExpandedId(expandedId === g.id ? null : g.id)}
                  onRemove={() => remove(g)}
                  onStatus={(s) => setStatus(g, s)}
                />
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenRoot>
  );
}

function AddGameForm({ team, rules, onDone }) {
  const sport = sportForTeam(team);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);
  const opponentRef = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useCallback(async () => {
    if (form.type === EVENT_TYPES.GAME && !form.opponent.trim()) {
      notify('Who are you playing?'); return;
    }
    if (form.type !== EVENT_TYPES.GAME && !form.title.trim()
        && form.type === EVENT_TYPES.MISC) {
      notify('Give the event a title.'); return;
    }
    setBusy(true);
    try {
      await createEvent(team.id, {
        type: form.type,
        title: form.title,
        opponent: form.opponent,
        homeOrAway: form.homeOrAway,
        date: combineDateTime(form.dateStr, form.timeStr),
        location: form.location,
        field: form.field,
        notes: form.notes,
      }, rules);
      // Keep type, date, location and home/away — a season at the same venue means
      // usually only the opponent or title changes.
      setForm((f) => ({ ...f, opponent: '', title: '', notes: '' }));
      setAdded((n) => n + 1);
      setTimeout(() => opponentRef.current?.focus(), 60);
    } catch (e) { notify('Could not save', e.message); }
    setBusy(false);
  }, [form, team.id, rules]);

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>
        Add to schedule{added > 0 ? ` · ${added} added` : ''}
      </Text>

      <View style={styles.typeRow}>
        {EVENT_ORDER.map(([k, l]) => (
          <Pressable key={k} onPress={() => set('type', k)}
            style={[styles.typeChip, form.type === k && styles.typeChipOn]}>
            <Text style={[styles.typeText, form.type === k && styles.typeTextOn]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <GameFields form={form} set={set} opponentRef={opponentRef} sport={sport} />
      <View style={styles.formBtns}>
        <Pressable onPress={onDone} style={[styles.cta, styles.ctaGhost]}>
          <Text style={[styles.ctaText, { color: colors.pencil }]}>DONE</Text>
        </Pressable>
        <Pressable onPress={save} disabled={busy} style={[styles.cta, styles.flex]}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>ADD & NEXT</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function GameRow({ game, team, roster, expanded, onToggle, onRemove, onStatus }) {
  // Labels differ by sport: a basketball game is at a Court, not a Field.
  const sport = sportForTeam(team);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [sheet, setSheet] = useState(false);
  const [busyPlayer, setBusyPlayer] = useState(null);

  // Fans don't see attendance at all, so there's no listener to open for them.
  const { isFan, isStaff } = useMyRole();
  const { counts, attendance } =
    useRsvps(team.id, game.id, roster, { enabled: !isFan });

  /**
   * Staff answering on a child's behalf. The rules already permit it; this is
   * the first control that does. Without it attendance can only be filled in
   * by parents who have been linked to their child, so a coach whose roster
   * isn't fully linked sees zeroes no matter how many people replied.
   */
  const setFor = useCallback(async (person, status) => {
    setBusyPlayer(person.playerId);
    try {
      await setRsvp({
        teamId: team.id, eventId: game.id,
        playerId: person.playerId, status, name: person.name,
      });
    } catch (e) { notify('Could not save', e.message); }
    setBusyPlayer(null);
  }, [team.id, game.id]);

  useEffect(() => {
    if (!expanded) { setEditing(false); return; }
    const d = game.date?.toDate?.() ?? (game.date ? new Date(game.date) : null);
    const { dateStr, timeStr } = splitDateTime(d);
    setForm({
      type: typeOf(game),
      title: game.title || '',
      opponent: game.opponent || '', homeOrAway: game.homeOrAway || 'home',
      dateStr, timeStr,
      location: venueOf(game) || '', field: game.field || '', notes: game.notes || '',
    });
  }, [expanded, game.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await updateEvent(team.id, game.id, {
        type: form.type,
        title: form.title.trim() || null,
        opponent: form.type === EVENT_TYPES.GAME ? (form.opponent.trim() || null) : null,
        homeOrAway: form.type === EVENT_TYPES.GAME ? form.homeOrAway : null,
        date: combineDateTime(form.dateStr, form.timeStr),
        location: form.location.trim() || null,
        field: form.field.trim() || null,
        notes: form.notes.trim() || null,
      });
      setEditing(false);
    } catch (e) { notify('Could not save', e.message); }
    setBusy(false);
  };

  const isFinal = isGame(game) && (game.status === 'final' || game.status === 'amended');

  return (
    <View style={[styles.card, game.status === 'live' && styles.cardLive,
                  expanded && styles.cardExpanded]}>
      <Pressable onPress={onToggle} style={styles.cardHead}>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            {!isGame(game) && (
              <View style={styles.typeTag}>
                <Text style={styles.typeTagText}>
                  {typeOf(game) === EVENT_TYPES.PRACTICE ? 'PRACTICE' : 'EVENT'}
                </Text>
              </View>
            )}
            <Text style={styles.opponent} numberOfLines={1}>
              {eventTitle(game, team.name)}
            </Text>
          </View>
          <Text style={styles.meta}>
            {[formatDate(game.date), formatTimeOf(game.date), venueOf(game),
              game.field ? `${sport.FIELD_WORD || 'Field'} ${game.field}` : null]
              .filter(Boolean).join(' · ')
              || 'No details yet'}
          </Text>
          {/* Attendance on the main bar. A coach scanning the schedule wants
              the headcount without opening each row, and tapping it opens the
              full list rather than expanding the card. */}
          {!isFan && (
            <AttendanceBar
              counts={counts}
              compact
              onPress={() => setSheet(true)}
            />
          )}
        </View>
        {isGame(game) ? <StatusPill game={game} /> : null}
        <Text style={styles.chev}>{expanded ? '⌃' : '⌄'}</Text>
      </Pressable>

      <AttendanceSheet
        visible={sheet}
        eventLabel={eventTitle(game, team.name)}
        attendance={attendance}
        isStaff={isStaff}
        busyId={busyPlayer}
        onSet={setFor}
        onClose={() => setSheet(false)}
      />

      {expanded && (
        <View style={styles.cardBody}>
          {editing ? (
            <>
              <GameFields form={form} set={set} sport={sport} />
              <View style={styles.formBtns}>
                <Pressable onPress={() => setEditing(false)} style={[styles.cta, styles.ctaGhost]}>
                  <Text style={[styles.ctaText, { color: colors.pencil }]}>CANCEL</Text>
                </Pressable>
                <Pressable onPress={save} disabled={busy} style={[styles.cta, styles.flex]}>
                  {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>SAVE</Text>}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              {isFinal && isGame(game) && (
                <View style={styles.finalBox}>
                  <FinalLineScore
                    game={game}
                    ourName={team.name}
                  />
                  {game.actualStartAt && (
                    <Text style={styles.finalMeta}>
                      First pitch {formatTimeOf(game.actualStartAt)}
                    </Text>
                  )}
                </View>
              )}
              {game.notes ? <Text style={styles.notes}>{game.notes}</Text> : null}

              <RsvpRow teamId={team.id} eventId={game.id} roster={roster} />

              <View style={[styles.cardBtns, { marginTop: spacing.md }]}>
                {isGame(game) && game.status === 'scheduled' && (
                  <Pressable onPress={() => onStatus('live')} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>START GAME</Text>
                  </Pressable>
                )}
                {isGame(game) && game.status === 'live' && (
                  <Pressable onPress={() => onStatus('final')} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>END GAME</Text>
                  </Pressable>
                )}
                {/* A finished game's details are part of its record — editing
                    the date or opponent after the fact would rewrite history. */}
                {!isFinal && (
                  <Pressable onPress={() => setEditing(true)} style={[styles.smallBtn, styles.smallGhost]}>
                    <Text style={[styles.smallBtnText, { color: colors.pencil }]}>EDIT</Text>
                  </Pressable>
                )}
                <Pressable onPress={onRemove} style={[styles.smallBtn, styles.smallGhost]}>
                  <Text style={[styles.smallBtnText, { color: colors.out }]}>DELETE</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function GameFields({ form, set, opponentRef, sport }) {
  const show = fieldsFor(form.type);
  return (
    <>
      {show.title && (
        <>
          <Text style={styles.label}>
            {form.type === EVENT_TYPES.PRACTICE ? 'Title' : 'Title *'}
          </Text>
          <TextInput value={form.title} onChangeText={(v) => set('title', v)}
            style={inputStyle}
            placeholder={form.type === EVENT_TYPES.PRACTICE ? 'Batting practice' : 'Team photos'}
            placeholderTextColor="#A0A8B8" autoCapitalize="sentences" />
          <View style={{ height: spacing.md }} />
        </>
      )}

      {show.opponent && (
        <>
          <Text style={styles.label}>Opponent *</Text>
          <TextInput ref={opponentRef} value={form.opponent}
            onChangeText={(v) => set('opponent', v)}
            style={inputStyle} placeholder="Northgate" placeholderTextColor="#A0A8B8"
            autoCapitalize="words" />
        </>
      )}

      {show.homeAway && (
        <View style={[styles.chips, { marginTop: spacing.md }]}>
          {[['home', 'Home'], ['away', 'Away']].map(([k, l]) => (
            <Pressable key={k} onPress={() => set('homeOrAway', k)}
              style={[styles.chip, form.homeOrAway === k && styles.chipOn]}>
              <Text style={[styles.chipText, form.homeOrAway === k && styles.chipTextOn]}>{l}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.row}>
        <DateField label="Date" value={form.dateStr} onChange={(v) => set('dateStr', v)} />
        <TimeField label="Time" value={form.timeStr} onChange={(v) => set('timeStr', v)} />
      </View>

      <View style={[styles.row, { marginTop: spacing.md }]}>
        <View style={styles.flex}>
          <Text style={styles.label}>
            Location
          </Text>
          <TextInput value={form.location} onChangeText={(v) => set('location', v)}
            style={inputStyle} placeholder={sport.VENUE_PLACEHOLDER || 'Venue'}
            placeholderTextColor="#A0A8B8"
            autoCapitalize="words" />
        </View>
        {show.field && (
          <View style={{ width: 88 }}>
            <Text style={styles.label}>{sport.FIELD_WORD || 'Field'}</Text>
            <TextInput value={form.field} onChangeText={(v) => set('field', v)}
              style={inputStyle} placeholder="4" placeholderTextColor="#A0A8B8" />
          </View>
        )}
      </View>

      <Text style={[styles.label, { marginTop: spacing.md }]}>Notes</Text>
      <TextInput value={form.notes} onChangeText={(v) => set('notes', v)}
        style={multilineStyle} multiline
        placeholder="Arrive 45 min early · snack duty: Miller"
        placeholderTextColor="#A0A8B8" />
    </>
  );
}

/**
 * A bare "3–8" doesn't say who won. The result is what a parent is scanning
 * for, so it leads.
 */
export function gameResult(game) {
  if (game.status !== 'final' && game.status !== 'amended') return null;
  const home = game.score?.home ?? 0;
  const away = game.score?.away ?? 0;
  const ours = game.homeOrAway === 'home' ? home : away;
  const theirs = game.homeOrAway === 'home' ? away : home;
  return {
    outcome: ours > theirs ? 'W' : ours < theirs ? 'L' : 'T',
    ours, theirs,
  };
}

function StatusPill({ game }) {
  if (game.status === 'live') {
    return <View style={[styles.pill, styles.pillLive]}><Text style={styles.pillTextLive}>LIVE</Text></View>;
  }
  const result = gameResult(game);
  if (result) {
    return (
      <View style={[styles.pill,
                    result.outcome === 'W' && styles.pillWin,
                    result.outcome === 'L' && styles.pillLoss]}>
        <Text style={[styles.pillText,
                      result.outcome === 'W' && styles.pillTextWin,
                      result.outcome === 'L' && styles.pillTextLoss]}>
          {result.outcome} {result.ours}–{result.theirs}
        </Text>
      </View>
    );
  }
  return <View style={styles.pill}><Text style={styles.pillText}>SCHEDULED</Text></View>;
}

const toDate = (d) => d?.toDate?.() ?? (d ? new Date(d) : null);
function formatDate(d) {
  const date = toDate(d);
  if (!date || isNaN(date)) return null;
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatTimeOf(d) {
  const date = toDate(d);
  if (!date || isNaN(date)) return null;
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * The three-way switch above the list: a calendar icon, Upcoming, Past.
 *
 * Not built on the shared SegmentedTabs — that component is text-only, and
 * mixing an icon segment into it would complicate something several other
 * screens rely on staying simple. This is Schedule's own, styled to match.
 */
/**
 * The switch above the list: Calendar dominant on the left, Upcoming/Past as
 * small stacked pills on the right.
 *
 * Calendar used to be a bare 44px icon square squeezed between two flex:1
 * text buttons — the emoji rendered small enough to look like a rendering
 * bug rather than a button. It's the default view now, so it gets to look
 * like the primary control it is; Upcoming and Past are secondary filters,
 * not equal siblings, so they read that way — smaller, stacked, out of the
 * way of the thing most people open this screen to see.
 */
function ScheduleViewSwitch({ value, onChange }) {
  return (
    <View style={styles.viewSwitch}>
      <Pressable
        onPress={() => onChange('calendar')}
        accessibilityRole="button" accessibilityLabel="Calendar view"
        style={[styles.viewSwitchCal, value === 'calendar' && styles.viewSwitchCalOn]}
      >
        <Text style={styles.viewSwitchCalIcon}>📅</Text>
        <Text style={[styles.viewSwitchCalText, value === 'calendar' && styles.viewSwitchTextOn]}>
          CALENDAR
        </Text>
      </Pressable>

      <View style={styles.viewSwitchStack}>
        <Pressable
          onPress={() => onChange('upcoming')}
          style={[styles.viewSwitchSmall, value === 'upcoming' && styles.viewSwitchItemOn]}
        >
          <Text style={[styles.viewSwitchSmallText, value === 'upcoming' && styles.viewSwitchTextOn]}>
            UPCOMING
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onChange('past')}
          style={[styles.viewSwitchSmall, value === 'past' && styles.viewSwitchItemOn]}
        >
          <Text style={[styles.viewSwitchSmallText, value === 'past' && styles.viewSwitchTextOn]}>
            PAST
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A function declaration, not a const — hoisted, so it's safe to use in the
    lazy useState initializer above regardless of where it's defined in the
    file. */
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  flex: { flex: 1 },
  viewSwitch: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 2,
    backgroundColor: colors.chalk,
  },
  // The primary control: wide, tall, and unmistakably a button — the bare
  // 44px icon square this replaced rendered small enough on some phones to
  // look like a layout bug rather than a tap target.
  viewSwitchCal: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 44, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
  },
  viewSwitchCalOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  viewSwitchCalIcon: { fontSize: 17 },
  viewSwitchCalText: { ...text.buttonSecondary, fontSize: 11.5, color: colors.pencil, letterSpacing: 0.6 },
  // Secondary filters, stacked rather than side by side, so their combined
  // height matches the calendar button's without competing with it for width.
  viewSwitchStack: { gap: 4 },
  viewSwitchSmall: {
    width: 80, height: 20, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
  },
  viewSwitchItemOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  viewSwitchSmallText: { ...text.label, fontSize: 8, color: colors.pencil, letterSpacing: 0.4 },
  viewSwitchTextOn: { color: '#FFF' },
  calendarDivider: {
    height: 1, backgroundColor: colors.line,
    marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md,
  },
  header: { backgroundColor: colors.navy, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h1: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 18, color: '#FFF' },
  h2: { ...text.body, fontSize: 12, color: '#A8B0C6', marginTop: 2 },
  headerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.14)' },
  headerBtnOn: { backgroundColor: colors.gold },
  headerBtnText: { ...text.buttonSecondary, fontSize: 11, color: '#FFF', letterSpacing: 0.8 },
  headerBtnTextOn: { color: colors.navy },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  form: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.card },
  formTitle: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 15, color: colors.navy, marginBottom: spacing.md },
  label: { ...text.label, color: colors.pencil, marginBottom: 5 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  chips: { flexDirection: 'row', gap: 7 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FDFDFC' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { ...text.bodyStrong, fontSize: 12.5, color: colors.pencil },
  chipTextOn: { color: '#FFF' },
  formBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cta: { height: 46, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, marginBottom: spacing.sm, ...shadow.card },
  cardLive: { borderColor: colors.out, borderWidth: 1.5 },
  cardExpanded: { borderColor: colors.primary },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  cardBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md },
  cardBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  opponent: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 15, color: colors.navy, flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeTag: {
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
    backgroundColor: '#E9EDF3',
  },
  typeTagText: { ...text.label, fontSize: 7.5, color: colors.pencil },
  typeRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  typeChip: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center',
    borderWidth: 1, borderColor: colors.line, backgroundColor: '#FDFDFC',
  },
  typeChipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  typeText: { ...text.bodyStrong, fontSize: 12.5, color: colors.pencil },
  typeTextOn: { color: '#FFF' },
  meta: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 3, lineHeight: 16 },
  notes: { ...text.body, fontSize: 13, color: colors.navy, marginBottom: spacing.md, lineHeight: 18 },
  finalBox: { borderRadius: radius.md, marginBottom: spacing.md, overflow: 'hidden' },
  finalMeta: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 3 },
  pill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: '#EEF1F6' },
  pillLive: { backgroundColor: '#FDECEC' },
  pillText: { ...text.buttonSecondary, fontSize: 9.5, color: colors.pencil, letterSpacing: 0.6 },
  pillWin: { backgroundColor: '#E4F0E7' },
  pillLoss: { backgroundColor: '#F3E5E5' },
  pillTextWin: { color: colors.grass },
  pillTextLoss: { color: colors.out },
  pillTextLive: { ...text.buttonSecondary, fontSize: 9.5, color: colors.out, letterSpacing: 0.6 },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.sm, backgroundColor: colors.navy },
  smallGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  smallBtnText: { ...text.buttonSecondary, fontSize: 10, color: '#FFF', letterSpacing: 0.6 },
  chev: { fontSize: 16, color: colors.pencil, paddingHorizontal: 2 },
  empty: { ...text.body, color: colors.pencil, textAlign: 'center', paddingVertical: 30 },
  msg: { ...text.body, color: colors.pencil, textAlign: 'center' },
});

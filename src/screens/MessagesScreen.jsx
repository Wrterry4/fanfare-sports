/**
 * MessagesScreen.jsx — Team chat and direct messages.
 *
 * Two selectors, both team-scoped. Direct opens on a list of everyone on the
 * roster rather than an empty inbox, because the first message is the hard one
 * and nobody wants to search for a name to start it.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';

import {
  db, collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, serverTimestamp,
} from '../services/firebase';
import { useGameDay } from '../hooks/useGameDay.js';
import { useAuth } from '../hooks/AuthProvider.jsx';
import {
  subscribeMembers, ensureConversation, conversationId, ROLE_LABELS,
} from '../services/membership.js';
import AppHeader, { HeaderButton, SegmentedTabs } from '../components/AppHeader.jsx';
import AccountSheet from '../components/AccountSheet.jsx';
import PollComposerSheet from '../components/PollComposerSheet.jsx';
import PollBubble from '../components/PollBubble.jsx';
import PhotoAlbumSheet from '../components/PhotoAlbumSheet.jsx';
import { postPoll } from '../services/pollService.js';
import {
  pickPhoto, uploadPhoto, photoPickingSupported, postPhotoMessage,
} from '../services/photoService.js';
import { useMyRole } from '../hooks/useMyRole.js';
import { notify } from '../utils/confirm.js';
import ScreenRoot from '../components/ScreenRoot.jsx';
import Centered from '../components/Centered.jsx';
import { colors, radius, spacing, text, shadow } from '../theme/tokens.js';
import { useTeamSurface, useTeamColor } from '../theme/useSportTheme.js';
import { bubbleColors } from '../shared/teamColors.js';
import { multilineStyle } from '../theme/inputs.js';

export default function MessagesScreen() {
  const { team, loading } = useGameDay();
  const surface = useTeamSurface();
  const { user } = useAuth();
  const [tab, setTab] = useState('team');
  const [members, setMembers] = useState([]);
  const [openDm, setOpenDm] = useState(null);
  const [menu, setMenu] = useState(false);
  const [album, setAlbum] = useState(false);
  const { isStaff } = useMyRole();

  useEffect(() => {
    if (!team?.id) return undefined;
    return subscribeMembers(team.id, setMembers);
  }, [team?.id]);

  if (loading) return <Centered><ActivityIndicator color={colors.primary} /></Centered>;
  if (!team) return <Centered><Text style={styles.msg}>No team yet.</Text></Centered>;

  return (
    <ScreenRoot style={[styles.root, { backgroundColor: surface }]}>
      {openDm ? (
        // In a thread the other person's name is centred on the back row,
        // which is where a messaging app puts it.
        <AppHeader
          team={team}
          onBack={() => setOpenDm(null)}
          centerTitle={openDm.displayName || 'Direct message'}
        />
      ) : (
        <>
          <AppHeader
            team={team}
            onMenu={() => setMenu(true)}
            right={
              /* Every photo the team has posted, one tap from where they were
                 posted. The album is the same collection the thread reads —
                 see components/PhotoAlbumSheet.jsx. */
              <HeaderButton label="◫ PHOTOS" onPress={() => setAlbum(true)} />
            }
          />
          <SegmentedTabs
            options={[['team', 'Team chat'], ['direct', 'Direct']]}
            value={tab} onChange={setTab}
          />
        </>
      )}
      <AccountSheet visible={menu} onClose={() => setMenu(false)} />
      <PhotoAlbumSheet
        visible={album}
        teamId={team.id}
        user={user}
        isStaff={isStaff}
        onClose={() => setAlbum(false)}
      />

      {openDm
        ? <Thread teamId={team.id} user={user} other={openDm} />
        : tab === 'team'
          ? <ChannelThread teamId={team.id} user={user} channel="chatter" />
          : <DirectList members={members} user={user} onOpen={setOpenDm} />}
    </ScreenRoot>
  );
}

/** Visible to everyone on the team. */
function ChannelThread({ teamId, user, channel }) {
  const [messages, setMessages] = useState([]);
  const path = useMemo(
    () => collection(db, 'teams', teamId, 'channels', channel, 'messages'), [teamId, channel]);

  useEffect(() => onSnapshot(query(path, orderBy('createdAt', 'asc')),
    (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => setMessages([])), [path]);

  const send = useCallback((body) => addDoc(path, {
    senderId: user.uid,
    senderName: user.displayName || 'Coach',
    text: body,
    createdAt: serverTimestamp(),
    deleted: false,
  }), [path, user]);

  return <MessageList messages={messages} user={user} onSend={send}
                      teamId={teamId} channel={channel}
                      placeholder="Message the team" />;
}

/** One thread per pair, per team. */
function Thread({ teamId, user, other }) {
  const [messages, setMessages] = useState([]);
  const cid = conversationId(teamId, user.uid, other.uid);

  useEffect(() => {
    ensureConversation(teamId, other.uid).catch(() => {});
    const path = collection(db, 'conversations', cid, 'messages');
    return onSnapshot(query(path, orderBy('createdAt', 'asc')),
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setMessages([]));
  }, [cid, teamId, other.uid]);

  const send = useCallback(async (body) => {
    await ensureConversation(teamId, other.uid);
    await addDoc(collection(db, 'conversations', cid, 'messages'), {
      senderId: user.uid,
      senderName: user.displayName || 'Me',
      text: body,
      createdAt: serverTimestamp(),
      deleted: false,
    });
    // Powers the list preview without reading every thread's messages.
    await updateDoc(doc(db, 'conversations', cid), {
      lastMessage: { text: body, senderId: user.uid, createdAt: new Date() },
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }, [cid, teamId, other.uid, user]);

  return <MessageList messages={messages} user={user} onSend={send}
                      placeholder={`Message ${other.displayName || 'them'}`} />;
}

function DirectList({ members, user, onOpen }) {
  // Fans are excluded from chat by the rules, so listing them here would only
  // offer threads that can't be opened.
  const others = members.filter((m) => m.uid !== user?.uid && m.role !== 'fan');
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {others.length === 0 && (
        <Text style={styles.empty}>
          You're the only person on this team so far. Share the join code from
          Settings and anyone who joins will appear here.
        </Text>
      )}
      {others.map((m) => (
        <Pressable key={m.uid} onPress={() => onOpen(m)} style={styles.person}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(m.displayName || ROLE_LABELS[m.role] || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.personName}>
              {m.displayName || ROLE_LABELS[m.role] || 'Team member'}
            </Text>
            <Text style={styles.personRole}>{ROLE_LABELS[m.role] || m.role}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/**
 * @param teamId/channel  present only in a team channel. Polls and photos are
 *                        a team thing: a poll of one other person is a
 *                        question, and a DM photo album nobody asked for is a
 *                        surprise. Their absence is what hides the + button in
 *                        a direct message.
 */
function MessageList({ messages, user, onSend, placeholder, teamId, channel }) {
  // Read from the active team here rather than threaded down through
  // ChannelThread and Thread, neither of which otherwise needs a team colour.
  const bubbles = bubbleColors(useTeamColor());
  const surface = useTeamSurface();
  const { isStaff } = useMyRole();
  const [draft, setDraft] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [composingPoll, setComposingPoll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scroller = React.useRef(null);
  const inChannel = !!teamId && !!channel;

  const sendPoll = useCallback(async (draftPoll) => {
    await postPoll({ teamId, channel, user, draft: draftPoll });
  }, [teamId, channel, user]);

  /**
   * Upload first, then post the message pointing at it. The other order would
   * put a broken bubble in the thread for however long the upload takes.
   */
  const attachPhoto = useCallback(async () => {
    setAttaching(false);
    try {
      const file = await pickPhoto();
      if (!file) return;
      setUploading(true);
      const photo = await uploadPhoto({ teamId, user, file });
      await postPhotoMessage({ teamId, channel, user, photo });
    } catch (e) {
      notify('Could not add photo', e.message);
    }
    setUploading(false);
  }, [teamId, channel, user]);

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try { await onSend(body); } catch { setDraft(body); }   // restore, don't lose it
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                          keyboardVerticalOffset={90} style={styles.flex}>
      <ScrollView ref={scroller} contentContainerStyle={styles.scroll}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
        {messages.length === 0 && <Text style={styles.empty}>No messages yet.</Text>}
        {messages.map((m) => {
          const mine = m.senderId === user?.uid;

          // A poll draws its own card rather than a bubble: it's a form, and
          // a form inside a chat bubble that's 80% of the width and tinted the
          // team colour is unreadable.
          if (m.kind === 'poll' && inChannel) {
            return (
              <PollBubble key={m.id} message={m} teamId={teamId} channel={channel}
                user={user} canManage={mine || isStaff} />
            );
          }

          if (m.kind === 'photo') {
            return (
              <View key={m.id} style={[styles.photoWrap, mine && styles.mineAlign]}>
                {!mine && <Text style={styles.photoSender}>{m.senderName}</Text>}
                <Image source={{ uri: m.photoUrl }}
                  style={[styles.photo, {
                    aspectRatio: m.width && m.height ? m.width / m.height : 4 / 3,
                  }]}
                  resizeMode="cover" />
              </View>
            );
          }

          // Their messages in the team primary, yours in the secondary. See
          // bubbleColors() for what happens when a team picks two colours too
          // close to tell apart.
          const skin = mine ? bubbles.mine : bubbles.theirs;
          return (
            <View key={m.id} style={[
              styles.bubble,
              mine && styles.mineAlign,
              { backgroundColor: skin.fill, borderColor: skin.fill },
            ]}>
              {!mine && (
                <Text style={[styles.sender, { color: skin.onFill, opacity: 0.75 }]}>
                  {m.senderName}
                </Text>
              )}
              <Text style={[styles.body, { color: skin.onFill }]}>{m.text}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* The attach menu, above the composer so it doesn't cover the draft
          someone has already typed. */}
      {attaching && (
        <View style={[styles.attachMenu, { backgroundColor: surface }]}>
          {photoPickingSupported() && (
            <Pressable onPress={attachPhoto} style={styles.attachItem}>
              <Text style={styles.attachIcon}>◫</Text>
              <View style={styles.flex}>
                <Text style={styles.attachTitle}>Photo</Text>
                <Text style={styles.attachSub}>Also lands in the team album</Text>
              </View>
            </Pressable>
          )}
          {isStaff && (
            <Pressable onPress={() => { setAttaching(false); setComposingPoll(true); }}
              style={styles.attachItem}>
              <Text style={styles.attachIcon}>▤</Text>
              <View style={styles.flex}>
                <Text style={styles.attachTitle}>Poll</Text>
                <Text style={styles.attachSub}>Ask the team a question</Text>
              </View>
            </Pressable>
          )}
        </View>
      )}

      {/* The composer is part of the page, not a card floating on it — a
          fixed white bar under a themed thread read as an unstyled strip. */}
      <View style={[styles.composer, { backgroundColor: surface }]}>
        {inChannel && (
          <Pressable onPress={() => setAttaching((a) => !a)} disabled={uploading}
            style={[styles.plus, attaching && styles.plusOn]}
            accessibilityRole="button" accessibilityLabel="Add a photo or a poll">
            {uploading
              ? <ActivityIndicator color={colors.primary} />
              : <Text style={[styles.plusText, attaching && styles.plusTextOn]}>+</Text>}
          </Pressable>
        )}
        <TextInput value={draft} onChangeText={setDraft} style={[multilineStyle, styles.flex]}
          placeholder={placeholder} placeholderTextColor="#A0A8B8" multiline />
        <Pressable onPress={submit} style={styles.send}>
          <Text style={styles.sendText}>SEND</Text>
        </Pressable>
      </View>

      <PollComposerSheet
        visible={composingPoll}
        onClose={() => setComposingPoll(false)}
        onPost={sendPoll}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  flex: { flex: 1 },
  header: { backgroundColor: colors.navy, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  h1: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 18, color: '#FFF', marginBottom: spacing.sm },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.10)' },
  tabOn: { backgroundColor: '#FFF' },
  tabText: { ...text.bodyStrong, fontSize: 12.5, color: '#A8B0C6' },
  tabTextOn: { color: colors.navy },
  back: { alignSelf: 'flex-start' },
  backText: { ...text.buttonSecondary, fontSize: 11, color: '#A8B0C6', letterSpacing: 0.6 },
  scroll: { padding: spacing.md, paddingBottom: spacing.lg },
  empty: { ...text.body, color: colors.pencil, textAlign: 'center', paddingVertical: 40, lineHeight: 19 },
  person: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadow.card,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Archivo', fontWeight: '900', fontSize: 15, color: '#FFF' },
  personName: { fontFamily: 'Archivo', fontWeight: '700', fontSize: 15, color: colors.navy },
  personRole: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 2 },
  chev: { fontSize: 22, color: colors.pencil, paddingHorizontal: 4 },
  bubble: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    alignSelf: 'flex-start', maxWidth: '86%',
  },
  mineAlign: { alignSelf: 'flex-end' },
  // Colour comes from the bubble skin at the call site — both sides are now
  // team colours, so a fixed navy or pencil here would fight them.
  sender: { ...text.label, marginBottom: 3 },
  body: { ...text.body, fontSize: 15, lineHeight: 20 },
  composer: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
  send: { paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  plus: {
    width: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  plusOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  plusText: { fontSize: 24, lineHeight: 28, color: colors.pencil },
  plusTextOn: { color: '#FFF' },
  attachMenu: {
    borderTopWidth: 1, borderTopColor: colors.line,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
  },
  attachItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  attachIcon: { fontSize: 18, color: colors.primary, width: 22, textAlign: 'center' },
  attachTitle: { ...text.bodyStrong, fontSize: 14, color: colors.navy },
  attachSub: { ...text.body, fontSize: 11.5, color: colors.pencil, marginTop: 1 },
  photoWrap: { maxWidth: '76%', alignSelf: 'flex-start', marginBottom: spacing.sm },
  photoSender: { ...text.label, fontSize: 9.5, color: colors.pencil, marginBottom: 3 },
  photo: { width: '100%', borderRadius: radius.md, backgroundColor: colors.line },
  sendText: { ...text.buttonSecondary, fontSize: 11, color: '#FFF', letterSpacing: 0.8 },
  msg: { ...text.body, color: colors.pencil, textAlign: 'center' },
});

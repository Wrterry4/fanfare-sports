/**
 * firestore.rules.test.js — Security rules, against the emulator.
 *
 * NOT RUN in the environment these files were written in: the emulator jar
 * downloads from storage.googleapis.com, which was outside the network
 * allowlist there. Everything in tests/*.test.js is verified; this file is
 * the piece that is not. Run it before trusting the rules in production.
 *
 *   npm i -D @firebase/rules-unit-testing firebase-tools vitest
 *   npx firebase emulators:exec --only firestore "npx vitest run tests/rules"
 *
 * These assertions are written against the specific things that would be
 * quietly catastrophic: a parent reading another family's child, a spectator
 * writing to the event log, a fan gaining guardian authority.
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { beforeAll, afterAll, beforeEach, describe, test } from 'vitest';
import {
  doc, setDoc, getDoc, updateDoc, addDoc, collection, deleteDoc,
} from 'firebase/firestore';

let testEnv;

const TEAM = 'team_reds';
const GAME = 'game_1';
const JACK = 'p_jack';
const WU = 'p_wu';

const COACH = 'u_coach';
const SCORER = 'u_scorer';
const JACK_DAD = 'u_jackdad';
const WU_MOM = 'u_wumom';
const GRANDMA = 'u_grandma';      // fan, linked to Jack
const OUTSIDER = 'u_outsider';    // no membership anywhere

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed with rules bypassed.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await setDoc(doc(db, 'teams', TEAM), {
      orgId: 'org_1', name: 'Ridgeview Reds', season: 'Spring 2027',
    });

    const members = [
      [COACH,    'coach',       []],
      [SCORER,   'scorekeeper', []],
      [JACK_DAD, 'parent',      [JACK]],
      [WU_MOM,   'parent',      [WU]],
      [GRANDMA,  'fan',         [JACK]],
    ];
    for (const [uid, role, linked] of members) {
      await setDoc(doc(db, 'teams', TEAM, 'members', uid), {
        role, linkedPlayerIds: linked, notificationPrefs: {},
      });
    }

    await setDoc(doc(db, 'players', JACK), {
      firstName: 'Jack', lastName: 'Miller', birthYear: 2015,
      guardianUserIds: [JACK_DAD],
      authorizedUserIds: [JACK_DAD, GRANDMA, COACH],
      rosteredTeamIds: [TEAM],
    });
    await setDoc(doc(db, 'players', WU), {
      firstName: 'Wu', lastName: 'Chen', birthYear: 2015,
      guardianUserIds: [WU_MOM],
      authorizedUserIds: [WU_MOM, COACH],
      rosteredTeamIds: [TEAM],
    });

    await setDoc(doc(db, 'players', JACK, 'seasons', `${TEAM}_Spring 2027`), {
      batting: { H: 12, AB: 30 },
    });

    await setDoc(doc(db, 'teams', TEAM, 'games', GAME), {
      opponent: 'Northgate', status: 'live',
      scorekeeperUid: SCORER, batonRequestedBy: null,
      score: { home: 0, away: 0 },
    });

    await setDoc(doc(db, 'careerCodes', 'somehash'), { playerId: JACK });

    await setDoc(doc(db, 'invites', 'inv_1'), {
      teamId: TEAM, type: 'player', playerId: JACK, role: 'parent',
      tokenHash: 'abc', maxUses: 1, usedCount: 0, revoked: false,
    });
  });
});

const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

// ===========================================================================

describe('stat privacy', () => {
  test('a parent reads their own child', async () => {
    await assertSucceeds(getDoc(doc(as(JACK_DAD), 'players', JACK)));
  });

  test("a parent CANNOT read another family's child", async () => {
    // The whole reason players moved to the root and stats got their own docs.
    await assertFails(getDoc(doc(as(WU_MOM), 'players', JACK)));
  });

  test("a parent CANNOT read another child's season stats", async () => {
    await assertFails(getDoc(
      doc(as(WU_MOM), 'players', JACK, 'seasons', `${TEAM}_Spring 2027`)));
  });

  test('a coach reads any player on their team', async () => {
    await assertSucceeds(getDoc(doc(as(COACH), 'players', JACK)));
    await assertSucceeds(getDoc(doc(as(COACH), 'players', WU)));
  });

  test('a fan reads the child they follow', async () => {
    await assertSucceeds(getDoc(doc(as(GRANDMA), 'players', JACK)));
  });

  test('a fan CANNOT read a child they do not follow', async () => {
    await assertFails(getDoc(doc(as(GRANDMA), 'players', WU)));
  });

  test('an outsider reads nothing', async () => {
    await assertFails(getDoc(doc(as(OUTSIDER), 'players', JACK)));
    await assertFails(getDoc(doc(anon(), 'players', JACK)));
  });

  test('nobody writes stats directly — finalize does', async () => {
    await assertFails(setDoc(
      doc(as(COACH), 'players', JACK, 'seasons', `${TEAM}_Spring 2027`),
      { batting: { H: 999 } }));
  });

  test('a parent cannot grant themselves access to a child', async () => {
    await assertFails(updateDoc(doc(as(WU_MOM), 'players', JACK), {
      authorizedUserIds: [WU_MOM],
    }));
  });
});

describe('the baton', () => {
  const evPath = (uid) => collection(as(uid), 'teams', TEAM, 'games', GAME, 'events');
  const ev = { seq: 0, type: 'SINGLE', payload: {}, voided: false };

  test('the holder appends events', async () => {
    await assertSucceeds(addDoc(evPath(SCORER), { ...ev, createdBy: SCORER }));
  });

  test('a coach WITHOUT the baton cannot append', async () => {
    await assertFails(addDoc(evPath(COACH), { ...ev, createdBy: COACH }));
  });

  test('a parent cannot append', async () => {
    await assertFails(addDoc(evPath(JACK_DAD), { ...ev, createdBy: JACK_DAD }));
  });

  test('nobody forges createdBy', async () => {
    await assertFails(addDoc(evPath(SCORER), { ...ev, createdBy: COACH }));
  });

  test('events are immutable once written', async () => {
    let id;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const r = await addDoc(
        collection(ctx.firestore(), 'teams', TEAM, 'games', GAME, 'events'),
        { ...ev, createdBy: SCORER });
      id = r.id;
    });
    await assertFails(updateDoc(
      doc(as(SCORER), 'teams', TEAM, 'games', GAME, 'events', id), { voided: true }));
    await assertFails(deleteDoc(
      doc(as(SCORER), 'teams', TEAM, 'games', GAME, 'events', id)));
  });

  test('any scorer may REQUEST the book', async () => {
    await assertSucceeds(updateDoc(doc(as(COACH), 'teams', TEAM, 'games', GAME), {
      batonRequestedBy: COACH,
    }));
  });

  test('but requesting is not taking', async () => {
    await assertFails(updateDoc(doc(as(COACH), 'teams', TEAM, 'games', GAME), {
      scorekeeperUid: COACH,
    }));
  });

  test('the holder may hand it over', async () => {
    await assertSucceeds(updateDoc(doc(as(SCORER), 'teams', TEAM, 'games', GAME), {
      scorekeeperUid: COACH, batonRequestedBy: null,
    }));
  });

  test('a parent cannot request the book', async () => {
    await assertFails(updateDoc(doc(as(JACK_DAD), 'teams', TEAM, 'games', GAME), {
      batonRequestedBy: JACK_DAD,
    }));
  });

  test('spectators still read the game live', async () => {
    await assertSucceeds(getDoc(doc(as(GRANDMA), 'teams', TEAM, 'games', GAME)));
    await assertSucceeds(getDoc(doc(as(WU_MOM), 'teams', TEAM, 'games', GAME)));
  });
});

describe('fans are not guardians', () => {
  test('a fan is kept out of team channels', async () => {
    await assertFails(getDoc(
      doc(as(GRANDMA), 'teams', TEAM, 'channels', 'chatter')));
  });

  test('a parent is not', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'teams', TEAM, 'channels', 'chatter'), {});
    });
    await assertSucceeds(getDoc(
      doc(as(JACK_DAD), 'teams', TEAM, 'channels', 'chatter')));
  });

  test('a fan cannot start a DM', async () => {
    await assertFails(setDoc(
      doc(as(GRANDMA), 'conversations', `${TEAM}_${COACH}_${GRANDMA}`), {
        teamId: TEAM, participantUids: [COACH, GRANDMA].sort(),
      }));
  });
});

describe('direct messages stay on the roster', () => {
  test('two team members may open a thread', async () => {
    const users = [COACH, JACK_DAD].sort();
    await assertSucceeds(setDoc(
      doc(as(JACK_DAD), 'conversations', `${TEAM}_${users[0]}_${users[1]}`), {
        teamId: TEAM, participantUids: users,
      }));
  });

  test('an outsider cannot', async () => {
    const users = [COACH, OUTSIDER].sort();
    await assertFails(setDoc(
      doc(as(OUTSIDER), 'conversations', `${TEAM}_${users[0]}_${users[1]}`), {
        teamId: TEAM, participantUids: users,
      }));
  });

  test('a member cannot open a thread with a non-member', async () => {
    const users = [JACK_DAD, OUTSIDER].sort();
    await assertFails(setDoc(
      doc(as(JACK_DAD), 'conversations', `${TEAM}_${users[0]}_${users[1]}`), {
        teamId: TEAM, participantUids: users,
      }));
  });

  test('a thread cannot be created without including yourself', async () => {
    const users = [COACH, WU_MOM].sort();
    await assertFails(setDoc(
      doc(as(JACK_DAD), 'conversations', `${TEAM}_${users[0]}_${users[1]}`), {
        teamId: TEAM, participantUids: users,
      }));
  });
});

describe('closed collections', () => {
  test('career codes are unreadable by everyone', async () => {
    for (const uid of [COACH, JACK_DAD, GRANDMA, OUTSIDER]) {
      await assertFails(getDoc(doc(as(uid), 'careerCodes', 'somehash')));
    }
    await assertFails(getDoc(doc(anon(), 'careerCodes', 'somehash')));
  });

  test('invites are unreadable — the token hash must never leak', async () => {
    for (const uid of [COACH, JACK_DAD, OUTSIDER]) {
      await assertFails(getDoc(doc(as(uid), 'invites', 'inv_1')));
    }
  });

  test('an unmatched path is denied', async () => {
    await assertFails(getDoc(doc(as(COACH), 'somethingElse', 'x')));
  });
});

describe('roster and membership', () => {
  test('a coach edits the roster', async () => {
    await assertSucceeds(setDoc(doc(as(COACH), 'teams', TEAM, 'roster', JACK), {
      jerseyNumber: 12, active: true,
    }));
  });

  test('a parent cannot', async () => {
    await assertFails(setDoc(doc(as(JACK_DAD), 'teams', TEAM, 'roster', JACK), {
      jerseyNumber: 99,
    }));
  });

  test("a parent may set their own child's walk-up audio", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'teams', TEAM, 'roster', JACK), {
        jerseyNumber: 12, active: true, audioConfig: {},
      });
    });
    await assertSucceeds(updateDoc(
      doc(as(JACK_DAD), 'teams', TEAM, 'roster', JACK), {
        audioConfig: { storageUrl: 'x', startSeconds: 10 },
      }));
  });

  test("but not another child's", async () => {
    await assertFails(updateDoc(
      doc(as(WU_MOM), 'teams', TEAM, 'roster', JACK), {
        audioConfig: { storageUrl: 'x' },
      }));
  });

  test('a member may edit only their own notification preferences', async () => {
    await assertSucceeds(updateDoc(
      doc(as(JACK_DAD), 'teams', TEAM, 'members', JACK_DAD), {
        notificationPrefs: { myPlayerAtBat: false },
      }));
  });

  test('a member cannot promote themselves', async () => {
    await assertFails(updateDoc(
      doc(as(JACK_DAD), 'teams', TEAM, 'members', JACK_DAD), { role: 'coach' }));
  });

  test('a coach cannot mint an owner', async () => {
    await assertFails(updateDoc(
      doc(as(COACH), 'teams', TEAM, 'members', SCORER), { role: 'owner' }));
  });

  test('an outsider reads nothing about the team', async () => {
    await assertFails(getDoc(doc(as(OUTSIDER), 'teams', TEAM)));
    await assertFails(getDoc(doc(as(OUTSIDER), 'teams', TEAM, 'games', GAME)));
  });
});

describe('transfers require a guardian', () => {
  test('a coach may open a request', async () => {
    await assertSucceeds(addDoc(collection(as(COACH), 'transfers'), {
      playerId: JACK, toTeamId: TEAM, status: 'pending', requestedBy: COACH,
    }));
  });

  test('a parent cannot open one on their own', async () => {
    await assertFails(addDoc(collection(as(JACK_DAD), 'transfers'), {
      playerId: JACK, toTeamId: TEAM, status: 'pending', requestedBy: JACK_DAD,
    }));
  });

  test('nobody approves client-side — the function does', async () => {
    let id;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const r = await addDoc(collection(ctx.firestore(), 'transfers'), {
        playerId: JACK, toTeamId: TEAM, status: 'pending', requestedBy: COACH,
      });
      id = r.id;
    });
    await assertFails(updateDoc(doc(as(JACK_DAD), 'transfers', id), {
      status: 'approved',
    }));
  });
});

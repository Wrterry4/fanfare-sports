/**
 * firebase-init.js — Admin SDK setup, and the only place it happens.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * index.js used to call initializeApp() in its own body and re-export the
 * other modules at the bottom of the file:
 *
 *     initializeApp();                              // line 26
 *     const db = getFirestore();
 *     ...
 *     export { createTeam } from './teams.js';      // line 389
 *
 * That reads as though initializeApp() runs first. It does not. ES modules
 * hoist imports and fully evaluate every dependency BEFORE a single statement
 * of the importing module runs — and a re-export is an import. So teams.js,
 * claims.js, invites.js and notifications.js were all evaluated first, each
 * calling getFirestore() at its top level, before any app existed:
 *
 *     Error: The default Firebase app does not exist. Make sure you call
 *     initializeApp() before using any of the Firebase services.
 *
 * The whole deployment failed to load. Not one function — all of them. Every
 * callable answered with `internal` (which the browser reports as "an internal
 * error occurred") and no Firestore trigger ever fired, so no notification was
 * ever sent. Two symptoms, one cause.
 *
 * Putting initialization in a module that everything else imports makes the
 * order a property of the dependency graph rather than of where a line happens
 * to sit in a file. This module is a dependency of every other one, so it is
 * guaranteed to finish evaluating first.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// getApps() guards against a double call — harmless in production, but the
// emulator re-imports modules between runs and would otherwise throw.
if (!getApps().length) initializeApp();

/** The one Firestore handle. Import this; never call getFirestore() directly. */
export const db = getFirestore();

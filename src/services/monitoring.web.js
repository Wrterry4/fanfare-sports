/**
 * monitoring.web.js — WEB. Crash reporting and performance traces.
 *
 * ── Crashlytics has no web SDK ─────────────────────────────────────────────
 *
 * It's native-only, so "Crashlytics on the web" means Analytics `exception`
 * events, which is what Firebase's own guidance amounts to. That's a real
 * report — message, where it happened, whether it killed the screen — arriving
 * in a console you already have, at no cost. What it is NOT is a symbolicated
 * stack trace with a grouped issue list, so this file deliberately sends the
 * first few frames in the event itself rather than pretending otherwise.
 *
 * ── What's actually being caught ───────────────────────────────────────────
 *
 *   window.onerror              a throw nothing caught
 *   unhandledrejection          the one that matters most here — every
 *                               Firestore call is a promise, and a rejected
 *                               one currently disappears in silence
 *   ErrorBoundary               a render error that blanked the screen
 *
 * ── Performance ────────────────────────────────────────────────────────────
 *
 * getPerformance() alone collects page load and every network request with no
 * further code. That's the measurement worth having: the complaint is always
 * "it's slow to open", which is a cold-start question and answered by the
 * automatic traces rather than anything hand-instrumented.
 *
 * Both are optional at runtime. A missing measurementId, a browser that blocks
 * them, an ad blocker eating the script — all of it degrades to no monitoring,
 * never to a broken app. Monitoring that can take the app down with it is
 * worse than none.
 */

import { app } from './firebase';

let analytics = null;
let started = false;

/**
 * Called once at startup. Safe to call twice; the second call does nothing.
 *
 * @returns true when at least one of the two came up
 */
export function startMonitoring() {
  if (started) return !!analytics;
  started = true;

  installGlobalHandlers();

  // Both SDKs are imported lazily so a browser that can't run them — or a
  // blocker that refuses to fetch them — costs nothing on the critical path
  // to first paint.
  import('firebase/performance')
    .then(({ getPerformance }) => { getPerformance(app); })
    .catch(() => {});

  import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      if (!(await isSupported())) return;
      analytics = getAnalytics(app);
    })
    .catch(() => {});

  return true;
}

/**
 * @param context  free-form, e.g. { where: 'ErrorBoundary', fatal: true }
 */
export function reportError(error, context = {}) {
  const message = String(error?.message || error || 'Unknown error');

  // The console first and always. It's the only report available while the
  // Analytics SDK is still loading, and the only one a developer with
  // devtools open actually reads.
  console.error('[Fanfare]', message, context);

  if (!analytics) return;
  import('firebase/analytics').then(({ logEvent }) => {
    logEvent(analytics, 'exception', {
      description: message.slice(0, 100),
      fatal: !!context.fatal,
      where: context.where || 'unknown',
      // Three frames is enough to place an error and short enough to fit an
      // Analytics parameter, which truncates at 100 characters.
      stack: firstFrames(error?.stack, 3).slice(0, 100),
    });
  }).catch(() => {});
}

/** Ties reports to an account, so one person's bad session is one thread. */
export function setMonitoringUser(uid) {
  if (!analytics || !uid) return;
  import('firebase/analytics')
    .then(({ setUserId }) => setUserId(analytics, uid))
    .catch(() => {});
}

/**
 * Time something the automatic traces can't see — a roster import, a
 * finalize. Returns stop(); calling it is optional and dropping it leaks
 * nothing.
 */
export function trace(name) {
  let stop = () => {};
  import('firebase/performance')
    .then(({ getPerformance, trace: makeTrace }) => {
      const t = makeTrace(getPerformance(app), name);
      t.start();
      stop = () => { try { t.stop(); } catch { /* already stopped */ } };
    })
    .catch(() => {});
  return () => stop();
}

function installGlobalHandlers() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (e) => {
    reportError(e.error || e.message, { where: 'window', fatal: false });
  });

  // The important one: every Firestore call is a promise, and a rejected one
  // that nothing catches currently vanishes without a trace.
  window.addEventListener('unhandledrejection', (e) => {
    reportError(e.reason, { where: 'promise', fatal: false });
  });
}

const firstFrames = (stack, n) =>
  (stack || '').split('\n').slice(1, 1 + n).map((s) => s.trim()).join(' | ');

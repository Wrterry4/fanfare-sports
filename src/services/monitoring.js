/**
 * monitoring.js — NATIVE. Crash reporting and performance traces.
 *
 * Nothing here yet, and the gap is a dependency rather than a decision.
 * Crashlytics on native is @react-native-firebase/crashlytics plus a build
 * phase that uploads dSYMs on iOS and a Gradle plugin on Android — none of
 * which is installed. Performance Monitoring is the same story.
 *
 * The API below is what the app calls, so wiring the real thing in later is
 * this file and nothing else: reportError forwards to
 * crashlytics().recordError, setUser to setUserId, and trace to
 * perf().startTrace.
 *
 * Errors still reach the console in the meantime, which is what a device
 * attached to Xcode or Android Studio shows.
 */

export function startMonitoring() { return false; }

export function reportError(error, context = {}) {
  console.error('[Fanfare]', error?.message || error, context);
}

export function setMonitoringUser() {}

/** Returns a stop() function so callers need no platform check. */
export function trace() { return () => {}; }

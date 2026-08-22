/**
 * buildLabel.js — Turning BUILD_INFO into what Settings actually shows.
 *
 * Split from the screen so the formatting — which has real edge cases, like
 * the placeholder committed build with no timestamp at all — is testable
 * without rendering anything.
 */

/**
 * @param buildInfo { version, builtAt, commit } — see generated/buildInfo.js
 * @param now       injectable for tests; defaults to the real clock
 */
export function formatBuildLabel(buildInfo, now = new Date()) {
  const version = buildInfo?.version || '0.0.0';

  if (!buildInfo?.builtAt) {
    // The committed placeholder, or a dev environment where the stamp script
    // has never run. Not an error — just means nobody has run
    // `npm run build:web` in this checkout yet.
    return `v${version} · unbuilt`;
  }

  const built = new Date(buildInfo.builtAt);
  if (isNaN(built)) return `v${version} · unbuilt`;

  const dateStr = built.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
    year: built.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
  const timeStr = built.toLocaleTimeString(undefined, {
    hour: 'numeric', minute: '2-digit',
  });

  const commit = buildInfo.commit ? ` · ${buildInfo.commit}` : '';
  return `v${version} · built ${dateStr} ${timeStr}${commit}`;
}

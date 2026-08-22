/**
 * pushEligibility.js — Should the post-install notification prompt show?
 *
 * Split from PostInstallNotifyPrompt.jsx specifically so this decision is
 * testable in plain Node — the component itself needs a real browser
 * (isInstalled(), Notification.permission), but the RULE for when to show
 * doesn't, and that rule is the part worth pinning down with a test: it's
 * the difference between a helpful one-time nudge and a prompt that nags
 * someone who already said no.
 */

/**
 * Only the genuinely first-ever ask counts. Someone who already granted or
 * explicitly denied has already made this decision — asking again reads as
 * nagging, and on iOS a re-ask after a denial does nothing anyway, since
 * reversing that requires a trip to system Settings regardless of what this
 * app does.
 */
export function isEligibleForPostInstallPrompt({ installed, supported, permission }) {
  return !!installed && !!supported && permission === 'default';
}

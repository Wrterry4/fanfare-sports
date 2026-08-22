/**
 * shareCaption.js — What the post-game share actually says.
 *
 * Pure, so the wording is testable without a canvas or a share sheet. The
 * image and the text both come from here, which is why it lives apart from
 * either renderer.
 *
 * ── Tone ────────────────────────────────────────────────────────────────────
 *
 * This text gets forwarded to grandparents and pasted into group chats, so it
 * has to read well when the team lost — which is half the time. It states the
 * result and never editorializes: no "tough loss", no "we'll get 'em next
 * time". A parent who wants to add that can type it themselves; an app that
 * says it on their behalf is presumptuous, and a kid reading it over their
 * shoulder doesn't need the app's opinion.
 */

/**
 * @param outcome   from describeOutcome()
 * @param teamName  our team
 * @param opponent  optional opponent name
 * @returns { headline, line, full } — headline for the image, full for text
 */
export function shareCaption(outcome, teamName, opponent) {
  const us = outcome?.us ?? 0;
  const them = outcome?.them ?? 0;
  const name = teamName || 'Our team';
  const other = opponent || 'the opponent';

  const headline = outcome?.result === 'win' ? 'FINAL — WIN'
    : outcome?.result === 'tie' ? 'FINAL — TIE'
      : 'FINAL';

  // Score always reads us-first, matching the scoreboard the parent just
  // watched. Reversing it for a loss to make it look better would be lying.
  const line = `${name} ${us}, ${other} ${them}`;

  return { headline, line, full: `${headline}\n${line}` };
}

/** Filename for a saved card. Safe on every filesystem. */
export function shareFileName(teamName, date = new Date()) {
  const slug = String(teamName || 'game')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'game';
  const stamp = Number.isNaN(date?.getTime?.()) ? '' : date.toISOString().slice(0, 10);
  return `${slug}-${stamp}.png`;
}

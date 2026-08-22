/**
 * shareCard.web.js — WEB. The final score, as an actual image.
 *
 * ── Why a canvas and not a screenshot ───────────────────────────────────────
 *
 * Rasterizing React Native views means react-native-view-shot on native and
 * an html-to-image library on web: two dependencies, two rendering paths, and
 * output that changes whenever the screen it's copying changes. The card is a
 * fixed composition of a few rectangles and three strings, so drawing it
 * directly is less code than either library's setup and produces the same
 * image on every device.
 *
 * 1080×1080 because every place this gets posted or texted expects a square,
 * and it's large enough to stay sharp when a phone scales it up.
 *
 * ── How it leaves the app ───────────────────────────────────────────────────
 *
 * navigator.share with a file is the good path — it opens the real share
 * sheet, so Messages and the photo library are one tap away. Browsers that
 * can't share files fall back to a download, and browsers that can't do
 * either get the caption text on the clipboard. Every branch returns what it
 * actually did so the caller can say so.
 */

import { shareCaption, shareFileName } from '../shared/shareCaption.js';

const SIZE = 1080;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

/**
 * Shrinks the type until the string fits. A team called "Northwest Regional
 * Thunderbolts 12U" must not run off the edge of a picture someone is about
 * to text to forty people.
 */
function fitText(ctx, textStr, maxWidth, startPx, weight, family) {
  let px = startPx;
  do {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(textStr).width <= maxWidth) break;
    px -= 4;
  } while (px > 24);
  return px;
}

const FAMILY = 'Archivo, "Segoe UI", system-ui, -apple-system, sans-serif';

/** Draws the card and hands back a PNG blob. */
export async function buildCardBlob({ outcome, teamName, opponent, teamColor }) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  const fill = teamColor?.fill || '#2563EB';
  const onFill = teamColor?.onFill || '#FFFFFF';
  const { headline } = shareCaption(outcome, teamName, opponent);

  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // A translucent panel keeps every string on one predictable surface, so the
  // contrast guarantee from teamColors.js still holds for the text on top.
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  roundRect(ctx, 70, 250, SIZE - 140, 580, 44);

  ctx.textAlign = 'center';
  ctx.fillStyle = onFill;

  ctx.globalAlpha = 0.85;
  ctx.font = `700 40px ${FAMILY}`;
  ctx.fillText(headline, SIZE / 2, 200);
  ctx.globalAlpha = 1;

  const namePx = fitText(ctx, String(teamName || 'Our team').toUpperCase(),
    SIZE - 220, 74, 800, FAMILY);
  ctx.font = `800 ${namePx}px ${FAMILY}`;
  ctx.fillText(String(teamName || 'Our team').toUpperCase(), SIZE / 2, 400);

  const score = `${outcome?.us ?? 0} — ${outcome?.them ?? 0}`;
  const scorePx = fitText(ctx, score, SIZE - 240, 200, 900, FAMILY);
  ctx.font = `900 ${scorePx}px ${FAMILY}`;
  ctx.fillText(score, SIZE / 2, 640);

  if (opponent) {
    ctx.globalAlpha = 0.8;
    const oppPx = fitText(ctx, `vs ${opponent}`, SIZE - 240, 40, 600, FAMILY);
    ctx.font = `600 ${oppPx}px ${FAMILY}`;
    ctx.fillText(`vs ${opponent}`, SIZE / 2, 740);
    ctx.globalAlpha = 1;
  }

  ctx.globalAlpha = 0.7;
  ctx.font = `700 32px ${FAMILY}`;
  ctx.fillText('FANFARE SPORTS', SIZE / 2, 960);
  ctx.globalAlpha = 1;

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * @returns 'shared' | 'downloaded' | 'copied' | 'failed'
 */
export async function shareCard(opts) {
  const { outcome, teamName, opponent } = opts;
  const { full } = shareCaption(outcome, teamName, opponent);

  let blob = null;
  try { blob = await buildCardBlob(opts); } catch { blob = null; }

  if (blob) {
    const file = new File([blob], shareFileName(teamName), { type: 'image/png' });

    // canShare must be asked about the actual file — Safari reports
    // navigator.share present while refusing file payloads.
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: full });
        return 'shared';
      }
    } catch (e) {
      // A user dismissing the sheet throws AbortError. That's a completed
      // interaction, not a failure to fall back from.
      if (e?.name === 'AbortError') return 'shared';
    }

    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = shareFileName(teamName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return 'downloaded';
    } catch { /* fall through to text */ }
  }

  try {
    await navigator.clipboard.writeText(full);
    return 'copied';
  } catch { return 'failed'; }
}

export const shareCardSupported = () =>
  typeof document !== 'undefined' && !!document.createElement('canvas').getContext;

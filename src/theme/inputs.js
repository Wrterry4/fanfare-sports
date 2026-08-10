/**
 * inputs.js — Shared form field styling.
 *
 * fontSize is 16 and must stay there. Mobile Safari zooms the viewport on
 * focus for anything smaller, and once zoomed the layout is wrong until the
 * user pinches back out. It's the single most common "this feels like a
 * website" tell on iOS.
 */

import { colors, radius } from './tokens.js';

export const INPUT_FONT_SIZE = 16;

export const inputStyle = {
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: radius.md,
  paddingHorizontal: 12,
  height: 46,
  fontSize: INPUT_FONT_SIZE,
  color: colors.navy,
  backgroundColor: '#FDFDFC',
};

export const multilineStyle = {
  ...inputStyle,
  height: undefined,
  minHeight: 44,
  maxHeight: 110,
  paddingVertical: 11,
  textAlignVertical: 'top',
};

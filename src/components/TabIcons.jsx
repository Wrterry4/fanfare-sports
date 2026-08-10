/**
 * TabIcons.jsx — Distinct glyph per tab.
 *
 * All five were the same generic shape before, which makes a tab bar useless:
 * people navigate by silhouette, not by reading labels.
 */

import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const base = (color) => ({
  fill: 'none', stroke: color, strokeWidth: 1.9,
  strokeLinecap: 'round', strokeLinejoin: 'round',
});

export const GameDayIcon = ({ color, size = 22 }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    {/* The scorebook diamond — same glyph as the live field, so the tab and
        the screen it opens read as the same thing. */}
    <Path d="M12 3 L21 12 L12 21 L3 12 Z" {...base(color)} />
    <Circle cx="12" cy="12" r="2.2" fill={color} stroke="none" />
  </Svg>
);

export const ScheduleIcon = ({ color, size = 22 }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    <Rect x="3" y="5" width="18" height="16" rx="2.5" {...base(color)} />
    <Path d="M3 10h18M8 3v4M16 3v4" {...base(color)} />
    <Circle cx="8.5" cy="14.5" r="1.1" fill={color} stroke="none" />
    <Circle cx="12" cy="14.5" r="1.1" fill={color} stroke="none" />
  </Svg>
);

export const RosterIcon = ({ color, size = 22 }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    <Circle cx="12" cy="7.5" r="3.5" {...base(color)} />
    <Path d="M4.5 20.5c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" {...base(color)} />
  </Svg>
);

export const MessagesIcon = ({ color, size = 22 }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    <Path d="M21 14.5a2.5 2.5 0 0 1-2.5 2.5H8l-4.5 4V5.5A2.5 2.5 0 0 1 6 3h12.5A2.5 2.5 0 0 1 21 5.5z" {...base(color)} />
  </Svg>
);

export const SettingsIcon = ({ color, size = 22 }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    <Circle cx="12" cy="12" r="3" {...base(color)} />
    <Path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" {...base(color)} />
  </Svg>
);

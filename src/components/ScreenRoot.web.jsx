/**
 * ScreenRoot.web.jsx — WEB. The outermost view of a tab screen.
 *
 * A plain View, and the reason is measured rather than assumed.
 *
 * Every tab screen used to be a <SafeAreaView edges={['top']}>. On an
 * installed iOS PWA that still padded the BOTTOM by
 * env(safe-area-inset-bottom) — 34pt on a device with a home indicator — and
 * because padding sits inside the element, those 34pt were painted in the
 * screen's own background colour. That was the dead strip of team colour
 * between the content and the tab bar, on every screen: 102 device pixels of
 * it in a 3x screenshot, exactly the inset.
 *
 * The top inset is applied above this component (the header starts below the
 * status bar with the page background showing through, not the screen's), so
 * nothing is lost by dropping down to a View — and the tab bar already sizes
 * itself around the indicator, so the bottom was never this component's to
 * reserve.
 *
 * Kept as a platform split rather than a prop, because the native side has no
 * such problem and there's nothing to be gained by changing it.
 */

import React from 'react';
import { View } from 'react-native';

export default function ScreenRoot({ style, children, edges, ...rest }) {
  return <View style={style} {...rest}>{children}</View>;
}

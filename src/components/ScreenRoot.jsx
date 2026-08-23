/**
 * ScreenRoot.jsx — NATIVE. The outermost view of a tab screen.
 *
 * Top inset only. The bottom belongs to the tab bar, which sizes itself around
 * the home indicator (see RootNavigator) — a screen that also insets its own
 * bottom edge reserves that space twice.
 */

import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScreenRoot({ style, children, ...rest }) {
  return (
    <SafeAreaView style={style} edges={['top']} {...rest}>
      {children}
    </SafeAreaView>
  );
}

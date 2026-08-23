/**
 * ErrorBoundary.jsx — Show the error instead of a blank screen.
 *
 * An uncaught render error unmounts the whole React tree, leaving the page
 * background visible and nothing else. At a game that's indistinguishable from
 * the app dying, and there's no way to report what happened.
 *
 * This catches it, shows what broke, and offers a reload. The stack is on
 * screen so it can be read or screenshotted without opening devtools.
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { reportError } from '../services/monitoring.js';
import { colors, radius, spacing, text } from '../theme/tokens.js';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // A render error is the fatal kind: the screen is gone and the person is
    // looking at this instead. reportError keeps it in the console too, for
    // anyone who does have devtools open.
    reportError(error, {
      where: 'ErrorBoundary',
      fatal: true,
      componentStack: info?.componentStack?.slice(0, 300),
    });
  }

  reload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
    else this.setState({ error: null, info: null });
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Something broke</Text>
          <Text style={styles.sub}>
            The app hit an error and stopped. Nothing you entered has been lost —
            scoring is saved as it happens.
          </Text>

          <View style={styles.box}>
            <Text style={styles.errName}>{String(error?.message || error)}</Text>
            {info?.componentStack ? (
              <Text style={styles.stack} selectable>
                {info.componentStack.trim().split('\n').slice(0, 12).join('\n')}
              </Text>
            ) : null}
          </View>

          <Pressable onPress={this.reload} style={styles.cta}>
            <Text style={styles.ctaText}>RELOAD</Text>
          </Pressable>

          <Text style={styles.fine}>
            Screenshot this screen — the lines above say exactly which component
            failed.
          </Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chalk },
  scroll: { padding: spacing.lg, paddingTop: 60 },
  title: { fontFamily: 'Archivo', fontWeight: '800', fontSize: 22, color: colors.navy },
  sub: { ...text.body, color: colors.pencil, marginTop: 6, marginBottom: spacing.lg, lineHeight: 19 },
  box: {
    backgroundColor: '#FDECEC', borderWidth: 1, borderColor: '#F3C9C9',
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg,
  },
  errName: { ...text.bodyStrong, fontSize: 14, color: '#9E1B1B', lineHeight: 20 },
  stack: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 11, color: '#6B2222', marginTop: spacing.md, lineHeight: 16,
  },
  cta: {
    height: 50, borderRadius: radius.md, backgroundColor: colors.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { ...text.buttonSecondary, color: '#FFF', letterSpacing: 0.8 },
  fine: { ...text.body, fontSize: 11.5, color: colors.pencil, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
});

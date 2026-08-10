/**
 * ThemeProvider.jsx — Theme in context.
 *
 * Takes the active sport pack and the current game's date, so the app can be
 * light at a Saturday morning game and dark at a Tuesday night one without the
 * person touching a setting.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { resolveTheme } from './index.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ sport, gameDate, systemPreference, children }) {
  const theme = useMemo(
    () => resolveTheme({ sportTheme: sport?.theme, gameDate, systemPreference }),
    [sport, gameDate, systemPreference]
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside <ThemeProvider>');
  return t;
}

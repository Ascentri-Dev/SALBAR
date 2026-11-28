import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { DARK_PALETTE, LIGHT_PALETTE, ThemePalette } from './tokens';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemePalette;
  toggleTheme: () => void;
  setThemeOverride: (mode: ThemeMode | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [overrideMode, setOverrideMode] = useState<ThemeMode | null>(null);

  const mode: ThemeMode = overrideMode ?? (systemScheme === 'light' ? 'light' : 'dark');
  const isDark = mode === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark,
      colors: isDark ? DARK_PALETTE : LIGHT_PALETTE,
      toggleTheme: () => setOverrideMode((prev) => (prev ?? mode) === 'dark' ? 'light' : 'dark'),
      setThemeOverride: setOverrideMode,
    }),
    [mode, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return ctx;
}

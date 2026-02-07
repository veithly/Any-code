import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ResolvedTheme;           // The actual applied theme (light or dark)
  themeMode: ThemeMode;            // The user's preference (light, dark, or system)
  setTheme: (theme: ResolvedTheme) => void;  // Backward compat - sets mode to explicit light/dark
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;         // Cycles through: light -> dark -> system -> light
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark'; // default fallback
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return getSystemTheme();
  return mode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme_mode') as ThemeMode | null;
    // Migrate: if 'theme_mode' key doesn't exist, check old 'theme' key
    if (!saved) {
      const oldTheme = localStorage.getItem('theme') as ResolvedTheme | null;
      if (oldTheme === 'light' || oldTheme === 'dark') {
        return oldTheme;
      }
      return 'system'; // Default to 'system' for new installs
    }
    return saved;
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(themeMode));

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    if (themeMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [themeMode]);

  // Update resolved theme when mode changes
  useEffect(() => {
    setResolvedTheme(resolveTheme(themeMode));
  }, [themeMode]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);

    // Update data-color-mode for markdown editor
    document.documentElement.setAttribute('data-color-mode', resolvedTheme);

    // Save both the mode preference and the resolved theme for backward compat
    localStorage.setItem('theme', resolvedTheme);
    localStorage.setItem('theme_mode', themeMode);

    // Update Windows title bar color to match theme
    invoke('set_titlebar_theme', { isDark: resolvedTheme === 'dark' }).catch((err) => {
      console.warn('Failed to update titlebar theme:', err);
    });
  }, [resolvedTheme, themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
  }, []);

  // Backward compatibility: setTheme('light'|'dark') sets mode to that explicit value
  const setTheme = useCallback((theme: ResolvedTheme) => {
    setThemeModeState(theme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeModeState(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light'; // system -> light
    });
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme: resolvedTheme,
      themeMode,
      setTheme,
      setThemeMode,
      toggleTheme
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

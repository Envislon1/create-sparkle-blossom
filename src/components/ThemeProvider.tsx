import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'dark',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const { profile, updateProfile, user } = useAuth();
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  // Initialize theme - prioritize localStorage for immediate persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem(storageKey) as Theme;
    
    if (savedTheme) {
      // Use saved theme from localStorage first
      setTheme(savedTheme);
    } else if (profile?.theme_preference) {
      // Fall back to profile preference if no localStorage
      setTheme(profile.theme_preference as Theme);
    } else {
      // Default to dark theme
      setTheme('dark');
      localStorage.setItem(storageKey, 'dark');
    }
  }, [profile, storageKey]);

  // Apply theme to DOM
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const handleSetTheme = async (newTheme: Theme) => {
    setTheme(newTheme);
    // Always save to localStorage immediately for persistence
    localStorage.setItem(storageKey, newTheme);
    
    // Update profile if user is logged in (non-blocking)
    if (user && profile) {
      try {
        await updateProfile({ theme_preference: newTheme });
      } catch (error) {
        console.log('Failed to update theme preference in profile:', error);
        // Don't fail the theme change if profile update fails
      }
    }
  };

  const value = {
    theme,
    setTheme: handleSetTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};

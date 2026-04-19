import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import { ThemeMode } from '../constants/message_types';

const THEME_STORAGE_KEY = 'themeMode';

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    const loadTheme = async () => {
      const result = await browser.storage.local.get(THEME_STORAGE_KEY);
      const storedTheme = result[THEME_STORAGE_KEY] as ThemeMode | undefined;
      if (storedTheme === 'light' || storedTheme === 'dark') {
        setThemeMode(storedTheme);
      }
    };

    loadTheme();

    const handleStorageChange = (changes: { [key: string]: browser.Storage.StorageChange }) => {
      const themeChange = changes[THEME_STORAGE_KEY];
      if (!themeChange) return;

      const nextTheme = themeChange.newValue as ThemeMode | undefined;
      if (nextTheme === 'light' || nextTheme === 'dark') {
        setThemeMode(nextTheme);
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const setMode = async (mode: ThemeMode) => {
    setThemeMode(mode);
    await browser.storage.local.set({ [THEME_STORAGE_KEY]: mode });
  };

  const toggleTheme = async () => {
    const nextTheme: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
    await setMode(nextTheme);
  };

  return {
    themeMode,
    isLight: themeMode === 'light',
    isDark: themeMode === 'dark',
    setThemeMode: setMode,
    toggleTheme,
  };
}

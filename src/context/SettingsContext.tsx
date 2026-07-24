/**
 * SettingsContext: preferenze utente (tema chiaro/scuro/sistema) persistite localmente.
 * La preferenza di tema alimenta <ThemeProvider preference=...> nel layout radice.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { asyncStorageStore, STORAGE_KEYS } from '../core/storage/keyValueStore';
import type { ThemePreference } from '../ui/theme';

type Settings = { themePreference: ThemePreference };
const DEFAULT_SETTINGS: Settings = { themePreference: 'system' };

type SettingsContextValue = Settings & {
  ready: boolean;
  setThemePreference: (pref: ThemePreference) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    asyncStorageStore.getJSON<Settings>(STORAGE_KEYS.settings).then((saved) => {
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });
      setReady(true);
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      ready,
      setThemePreference: (themePreference) => {
        setSettings((prev) => {
          const next = { ...prev, themePreference };
          void asyncStorageStore.setJSON(STORAGE_KEYS.settings, next);
          return next;
        });
      },
    }),
    [settings, ready]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings deve essere usato dentro <SettingsProvider>.');
  return ctx;
}

/**
 * AuthContext: utente corrente. In Fase 1 è un utente locale creato al primo avvio
 * (vedi LocalAuthRepository); in Fase 2 diventerà login reale senza cambiare l'interfaccia.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getAuthRepository, type AuthUser } from '../core/repositories';

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  updateProfile: (patch: Partial<Pick<AuthUser, 'displayName' | 'email'>>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const repo = useMemo(() => getAuthRepository(), []);

  useEffect(() => {
    repo.getCurrentUser().then((u) => {
      setUser(u);
      setReady(true);
    });
  }, [repo]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      updateProfile: async (patch) => setUser(await repo.updateProfile(patch)),
    }),
    [user, ready, repo]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>.');
  return ctx;
}

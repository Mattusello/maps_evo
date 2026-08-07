/**
 * AuthContext: l'utente corrente e, se il backend è configurato, la sessione.
 *
 * C'è **sempre** un utente, anche senza backend e senza accesso: serve a firmare gli
 * itinerari. Accedere aggiunge una sessione, non cambia il dispositivo; uscire toglie la
 * sessione e lascia i dati dove sono.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { setUnauthorizedHandler } from '../core/api/apiClient';
import {
  getAuthRepository,
  isRemoteAuthRepository,
  type AuthUser,
  type SignInInput,
  type SignUpInput,
} from '../core/repositories';

type AuthContextValue = {
  user: AuthUser | null;
  /** Il primo caricamento è finito (utente locale letto, sessione eventualmente ripresa). */
  ready: boolean;
  /** Il backend è configurato: esistono accesso e sincronizzazione. */
  remote: boolean;
  /** C'è una sessione aperta su questo dispositivo. */
  signedIn: boolean;
  updateProfile: (patch: Partial<Pick<AuthUser, 'displayName' | 'email'>>) => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const repo = useMemo(() => getAuthRepository(), []);
  const remoteRepo = isRemoteAuthRepository(repo) ? repo : null;

  useEffect(() => {
    let alive = true;

    async function boot() {
      // Prima l'identità locale: la UI non deve aspettare la rete per esistere.
      const current = await repo.getCurrentUser();
      if (!alive) return;
      setUser(current);

      if (remoteRepo) {
        const restored = await remoteRepo.restoreSession();
        if (!alive) return;
        if (restored) setUser(restored);
        setSignedIn(remoteRepo.hasSession());
      }
      if (alive) setReady(true);
    }

    void boot();
    return () => {
      alive = false;
    };
  }, [repo, remoteRepo]);

  // Token scaduto o revocato mentre l'app è aperta: si torna "non connessi" senza perdere nulla.
  useEffect(() => {
    if (!remoteRepo) return;
    setUnauthorizedHandler(() => setSignedIn(false));
    return () => setUnauthorizedHandler(null);
  }, [remoteRepo]);

  const signIn = useCallback(
    async (input: SignInInput) => {
      if (!remoteRepo) return;
      setUser(await remoteRepo.signIn(input));
      setSignedIn(true);
    },
    [remoteRepo]
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      if (!remoteRepo) return;
      setUser(await remoteRepo.signUp(input));
      setSignedIn(true);
    },
    [remoteRepo]
  );

  const signOut = useCallback(async () => {
    await repo.signOut();
    setSignedIn(false);
    setUser(await repo.getCurrentUser());
  }, [repo]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      remote: remoteRepo !== null,
      signedIn,
      updateProfile: async (patch) => setUser(await repo.updateProfile(patch)),
      signIn,
      signUp,
      signOut,
    }),
    [user, ready, remoteRepo, signedIn, repo, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>.');
  return ctx;
}

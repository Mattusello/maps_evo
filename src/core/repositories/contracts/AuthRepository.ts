/**
 * CONTRATTO di autenticazione.
 *
 * Un'identità c'è **sempre**, anche senza backend e senza login: serve a firmare gli
 * itinerari (`ownerId`) e a dividere i costi. Con il backend attivo si aggiunge una
 * sessione vera (Laravel Sanctum), che non sostituisce l'identità locale ma la qualifica.
 */
export type AuthUser = {
  id: string;
  displayName: string;
  email?: string;
};

export interface AuthRepository {
  /** Utente corrente; al primo avvio ne crea uno locale. */
  getCurrentUser(): Promise<AuthUser>;
  updateProfile(patch: Partial<Pick<AuthUser, 'displayName' | 'email'>>): Promise<AuthUser>;
  signOut(): Promise<void>;
}

export type SignInInput = { email: string; password: string };
export type SignUpInput = { displayName: string; email: string; password: string };

/**
 * Autenticazione con un backend. È un'interfaccia separata perché il login **non esiste**
 * senza server: chi la implementa lo dichiara, e la UI mostra il modulo di accesso solo
 * quando c'è qualcuno che sa gestirlo.
 */
export interface RemoteAuthRepository extends AuthRepository {
  signIn(input: SignInInput): Promise<AuthUser>;
  signUp(input: SignUpInput): Promise<AuthUser>;
  /**
   * Riprende la sessione salvata sul dispositivo. `null` se non c'è o non è più valida;
   * **senza rete restituisce l'utente conosciuto**, per non buttare fuori chi è in viaggio.
   */
  restoreSession(): Promise<AuthUser | null>;
  /** C'è una sessione aperta su questo dispositivo? */
  hasSession(): boolean;
}

export function isRemoteAuthRepository(repo: AuthRepository): repo is RemoteAuthRepository {
  return 'signIn' in repo && typeof (repo as RemoteAuthRepository).signIn === 'function';
}

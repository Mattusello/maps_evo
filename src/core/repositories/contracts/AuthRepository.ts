/**
 * CONTRATTO di autenticazione. Fase 1: utente locale anonimo persistito sul dispositivo.
 * Fase 2: login reale (Laravel Sanctum) dietro la stessa interfaccia.
 */
export type AuthUser = {
  id: string;
  displayName: string;
  email?: string;
};

export interface AuthRepository {
  /** Utente corrente (in Fase 1 ne crea uno locale al primo avvio). */
  getCurrentUser(): Promise<AuthUser>;
  updateProfile(patch: Partial<Pick<AuthUser, 'displayName' | 'email'>>): Promise<AuthUser>;
  /** Predisposto per la Fase 2. */
  signOut(): Promise<void>;
}

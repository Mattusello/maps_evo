import { randomUUID } from 'expo-crypto';

/** Genera un UUID lato client (necessario per il merge futuro con il backend). */
export function newId(): string {
  return randomUUID();
}

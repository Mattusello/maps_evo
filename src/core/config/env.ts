/**
 * Configurazione da variabili d'ambiente. Le chiavi NON sono mai hardcoded: si leggono
 * dalle env `EXPO_PUBLIC_*` (vedi `.env.example`). In Expo, le variabili con prefisso
 * `EXPO_PUBLIC_` sono inlined nel bundle a build time via `process.env`.
 */

export const env = {
  /** Base URL del backend Laravel (Fase 2). */
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  /** Chiave Google Maps/Places. */
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  /** Se true, usa il repository API invece di quello locale (Fase 2). */
  useApiBackend: process.env.EXPO_PUBLIC_USE_API === 'true',
} as const;

/** Utile per mostrare avvisi in sviluppo quando manca una chiave. */
export function isGoogleMapsConfigured(): boolean {
  return env.googleMapsApiKey.length > 0;
}

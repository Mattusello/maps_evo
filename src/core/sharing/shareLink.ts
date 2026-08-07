/**
 * Link profondo di condivisione. Isolato dal resto (`shareCode.ts` è puro) perché è l'unico
 * punto che dipende da `expo-linking`: su native produce `mymappa://import?c=…`, sul web
 * l'URL dell'origine corrente, così lo stesso pulsante funziona in entrambi gli ambienti.
 */
import * as Linking from 'expo-linking';

import { SHARE_QUERY_PARAM } from './shareCode';

/** URL apribile che porta l'itinerario dentro l'app (rotta `/import`). */
export function buildShareUrl(code: string): string {
  return Linking.createURL('/import', { queryParams: { [SHARE_QUERY_PARAM]: code } });
}

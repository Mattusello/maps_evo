/**
 * MOTION — regole di movimento del sistema.
 *
 * Tesi: il movimento in MyMappa si comporta come un mezzo che **arriva a una fermata**.
 * Entra deciso e si ferma netto (decelerazione, mai rimbalzo), esce più in fretta di quanto
 * è entrato. Serve a spiegare stato e continuità, non a decorare: un solo momento
 * "d'autore" per superficie (in Fase 4 è l'arrivo del QR nel foglio Condividi), tutto il
 * resto è feedback breve.
 *
 * Le durate stanno in `tokens.ts` (`duration`); qui vive la sola regola trasversale:
 * **rispettare Riduci movimento**.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * `true` quando l'utente ha chiesto al sistema di ridurre le animazioni.
 * Si aggiorna se la preferenza cambia mentre l'app è aperta.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/**
 * Azioni di sistema per la condivisione: appunti e foglio di condivisione nativo.
 *
 * Sul web `Share` di react-native-web usa `navigator.share`, che esiste solo su alcuni
 * browser (e quasi sempre solo in HTTPS): quando manca, invece di far finta di niente,
 * copiamo negli appunti e lo **dichiariamo** al chiamante, così la UI può dire cosa è
 * successo davvero.
 */
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

/** Esito di `shareOrCopy`: cosa è realmente avvenuto. */
export type ShareOutcome = 'shared' | 'copied' | 'dismissed';

export async function copyToClipboard(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

/** Testo negli appunti (stringa vuota se non c'è nulla o il browser lo nega). */
export async function readClipboard(): Promise<string> {
  try {
    return (await Clipboard.getStringAsync()) ?? '';
  } catch {
    return '';
  }
}

export async function shareOrCopy(content: { title: string; message: string }): Promise<ShareOutcome> {
  try {
    const result = (await Share.share({ title: content.title, message: content.message })) as
      | { action?: string }
      | undefined;
    // Nativo: l'utente può chiudere il foglio senza condividere.
    if (result?.action === Share.dismissedAction) return 'dismissed';
    return 'shared';
  } catch (e) {
    // `navigator.share` rifiuta con AbortError quando l'utente annulla: non è un errore.
    if (e instanceof Error && e.name === 'AbortError') return 'dismissed';
    await copyToClipboard(content.message);
    return 'copied';
  }
}

/**
 * `qrcode` è l'encoder che sta dentro react-native-qrcode-svg. Non lo usiamo
 * nell'applicazione — lì passa dal componente — ma nei **test**, per verificare la soglia
 * `QR_MAX_CHARS` contro l'implementazione vera invece che contro una tabella copiata a mano.
 *
 * Serve solo `create`, quindi bastano queste righe: nessun pacchetto di tipi in più.
 */
declare module 'qrcode' {
  export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

  export type QRCodeData = {
    /** Versione (1–40) scelta dall'encoder: determina la densità del reticolo. */
    version: number;
  };

  export function create(
    data: string,
    options?: { errorCorrectionLevel?: ErrorCorrectionLevel; version?: number }
  ): QRCodeData;

  const QRCode: { create: typeof create };
  export default QRCode;
}

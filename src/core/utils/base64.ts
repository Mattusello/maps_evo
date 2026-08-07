/**
 * Base64url per testo UTF-8, scritto a mano e senza dipendenze.
 *
 * Perché non `btoa`/`atob`: non esistono su Hermes (nativo) e comunque non gestiscono
 * caratteri non-latini. Qui il testo viene prima convertito in byte UTF-8, poi in
 * base64 **url-safe** (`-_`, senza padding) così il codice si incolla in una URL,
 * in un QR o in un messaggio senza essere riscritto da nessuno.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Mappa carattere → valore a 6 bit; accetta anche l'alfabeto base64 classico (`+/`). */
const VALUES: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i += 1) VALUES[ALPHABET[i]] = i;
VALUES['+'] = 62;
VALUES['/'] = 63;

/** Testo → byte UTF-8. Itera per code point, quindi le emoji restano intere. */
export function utf8ToBytes(text: string): number[] {
  const out: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
    }
  }
  return out;
}

/** Byte UTF-8 → testo. Lancia se la sequenza è malformata (meglio che caratteri fantasma). */
export function bytesToUtf8(bytes: number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i];
    let cp: number;
    let extra: number;
    if (b0 < 0x80) {
      cp = b0;
      extra = 0;
    } else if (b0 >= 0xc0 && b0 < 0xe0) {
      cp = b0 & 0x1f;
      extra = 1;
    } else if (b0 >= 0xe0 && b0 < 0xf0) {
      cp = b0 & 0x0f;
      extra = 2;
    } else if (b0 >= 0xf0 && b0 < 0xf8) {
      cp = b0 & 0x07;
      extra = 3;
    } else {
      throw new Error('UTF-8 non valido');
    }
    if (i + extra >= bytes.length) throw new Error('UTF-8 troncato');
    for (let k = 1; k <= extra; k += 1) {
      const b = bytes[i + k];
      if ((b & 0xc0) !== 0x80) throw new Error('UTF-8 non valido');
      cp = (cp << 6) | (b & 0x3f);
    }
    out += String.fromCodePoint(cp);
    i += extra + 1;
  }
  return out;
}

/** Testo → base64url senza padding. */
export function encodeBase64Url(text: string): string {
  const bytes = utf8ToBytes(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 === undefined) break;
    out += ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 === undefined) break;
    out += ALPHABET[b2 & 0x3f];
  }
  return out;
}

/** base64url (o base64 classico, con o senza padding) → testo. Lancia se non è valido. */
export function decodeBase64Url(code: string): string {
  const clean = code.trim().replace(/=+$/, '');
  if (clean.length % 4 === 1) throw new Error('Base64 di lunghezza non valida');

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = VALUES[char];
    if (value === undefined) throw new Error(`Carattere non valido nel codice: ${char}`);
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytesToUtf8(bytes);
}

import { describe, expect, it } from '@jest/globals';

import { bytesToUtf8, decodeBase64Url, encodeBase64Url, utf8ToBytes } from './base64';

describe('base64url', () => {
  it('fa il giro completo su testo ascii', () => {
    const text = 'Weekend a Firenze';
    expect(decodeBase64Url(encodeBase64Url(text))).toBe(text);
  });

  it('preserva accenti ed emoji (UTF-8 multi-byte)', () => {
    const text = 'Città della Scienza — 🏛️ €12,50';
    expect(decodeBase64Url(encodeBase64Url(text))).toBe(text);
  });

  it('produce solo caratteri url-safe, senza padding', () => {
    // Un testo lungo copre tutte le lunghezze residue (0, 1, 2 byte finali).
    for (let n = 1; n < 40; n += 1) {
      const code = encodeBase64Url('à'.repeat(n));
      expect(code).toMatch(/^[A-Za-z0-9\-_]+$/);
    }
  });

  it('gestisce le tre lunghezze residue', () => {
    for (const text of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
      expect(decodeBase64Url(encodeBase64Url(text))).toBe(text);
    }
  });

  it('accetta base64 classico con padding', () => {
    // "ciao" in base64 standard.
    expect(decodeBase64Url('Y2lhbw==')).toBe('ciao');
  });

  it('rifiuta caratteri non validi', () => {
    expect(() => decodeBase64Url('non valido!')).toThrow();
  });

  it('rifiuta una lunghezza impossibile', () => {
    expect(() => decodeBase64Url('YWJjZQ')).not.toThrow();
    expect(() => decodeBase64Url('Y')).toThrow('lunghezza');
  });

  it('rifiuta byte UTF-8 malformati', () => {
    expect(() => bytesToUtf8([0xc3])).toThrow();
    expect(() => bytesToUtf8([0xff, 0x00])).toThrow();
  });

  it('codifica la stringa vuota come stringa vuota', () => {
    expect(encodeBase64Url('')).toBe('');
    expect(decodeBase64Url('')).toBe('');
  });

  it('conta i byte UTF-8 attesi', () => {
    expect(utf8ToBytes('a')).toHaveLength(1);
    expect(utf8ToBytes('à')).toHaveLength(2);
    expect(utf8ToBytes('€')).toHaveLength(3);
    expect(utf8ToBytes('🏛')).toHaveLength(4);
  });
});

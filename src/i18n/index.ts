/**
 * Configurazione i18n. Fase 1: una sola lingua caricata ('it'), ma la struttura è
 * pronta al multilingua — basta aggiungere risorse e la lingua rilevata dal dispositivo.
 * Nessuna stringa deve essere hardcoded nei componenti: usare sempre `t('...')`.
 */
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import it from './locales/it.json';

export const defaultLanguage = 'it';
export const supportedLanguages = ['it'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

/** Lingua del dispositivo se supportata, altrimenti la lingua di default. */
function resolveInitialLanguage(): SupportedLanguage {
  const device = getLocales()[0]?.languageCode;
  return (supportedLanguages as readonly string[]).includes(device ?? '')
    ? (device as SupportedLanguage)
    : defaultLanguage;
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: { it: { translation: it } },
    lng: resolveInitialLanguage(),
    fallbackLng: defaultLanguage,
    supportedLngs: supportedLanguages as unknown as string[],
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
  });
}

export default i18n;

// Tipizzazione delle chiavi di traduzione per autocompletamento e sicurezza.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof it };
  }
}

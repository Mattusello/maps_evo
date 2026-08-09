# mapsEvo

App mobile cross-platform (iOS + Android) per **creare, organizzare e condividere itinerari di
viaggio**. Per ogni tappa: orari/disponibilità, fascia di prezzo (baseline Google + prezzi reali
crowdsourced) e affollamento stimato. Ispirata a Google My Maps ma incentrata sul viaggio, con
timeline, budget, ottimizzazione del percorso e collaborazione. UI in italiano.

> Stato: **Fase 1** completata (scaffold, design system, i18n, persistenza locale, navigazione
> base). Vedi la roadmap in fondo.

## Stack

- **Expo SDK 57** (workflow con prebuild) + **React Native 0.86** + **TypeScript strict**
- **expo-router** (navigazione file-based, deep-link pronti per la condivisione)
- **NativeWind v4** (Tailwind per RN) + design system a token custom (`src/ui/theme`)
- **React Context + useReducer** per lo stato (nessun Redux/Zustand)
- **AsyncStorage** dietro un layer **repository astratto** (pronto per SQLite o backend Laravel)
- **react-hook-form + zod**, **i18next**, **@gorhom/bottom-sheet**, **react-native-reanimated**,
  **lucide-react-native**

## Requisiti

- Node ≥ 20, npm
- Per il build nativo: Android Studio (Android) e/o Xcode su macOS (iOS). In alternativa,
  **Expo Go** per uno sviluppo rapido senza toolchain nativa (limitato per i moduli nativi).

## Setup

```bash
npm install
cp .env.example .env   # poi inserisci le chiavi (vedi sotto)
```

### Chiavi API

Le chiavi non sono mai hardcoded: si leggono da `.env` (vedi `.env.example`).

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — necessaria dalla **Fase 2** per mappa e ricerca POI.
  Su Google Cloud abilita *Maps SDK for Android/iOS* e *Places API*.
- `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_USE_API` — backend Laravel (**Fase 2**).

## Avvio

```bash
npm start          # avvia Metro (poi premi i / a per iOS / Android, o usa Expo Go)
npm run android    # build+run su Android
npm run ios        # build+run su iOS (richiede macOS)
npm run web        # anteprima web
```

Alla prima esecuzione con moduli nativi conviene generare i progetti nativi:

```bash
npx expo prebuild        # genera ios/ e android/
```

## Struttura del progetto

```
src/
  app/                 # rotte expo-router (schermate)
  core/
    models/            # entità + schema zod (fonte di verità dei dati)
    repositories/      # contratti + impl. locale (Fase 1) + impl. API (predisposta)
    providers/         # (Fase 2) POI / prezzi / affollamento dietro interfacce
    api/               # apiClient centralizzato (base URL da env, token, errori)
    sync/              # outbox per la sincronizzazione futura
    storage/           # layer key-value astratto (AsyncStorage → SQLite in futuro)
  features/            # logica e componenti per dominio (itineraries, map, timeline, budget…)
  context/             # ItinerariesContext, AuthContext, SettingsContext
  ui/
    theme/             # token (colori, spacing, tipografia, ombre) + ThemeProvider
    components/         # componenti riutilizzabili (Text, Button, Card, Badge, Chip…)
  i18n/                # configurazione i18next + locale it
```

## Testing

```bash
npm test
```

Test con Jest + React Native Testing Library sui moduli core (repository, utility).

## Roadmap (fasi)

- **Fase 0** — Scelte architetturali, struttura, modello dati. ✅
- **Fase 1** — Scaffold, TypeScript, design system + tema chiaro/scuro, i18n, repository locale,
  navigazione base. ✅
- **Fase 2** — Mappa interattiva (Leaflet + OpenStreetMap, gratuita), ricerca POI, aggiunta tappe
  (ricerca o tap sulla mappa), linea-percorso, dettaglio tappa in bottom sheet con stato apertura,
  affollamento stimato e prezzo crowdsourced. Tre provider dietro interfacce (`src/core/providers`,
  vedi `docs/DATA_PROVIDERS.md`). ✅
- **Fase 3** — Timeline con orari, drag & drop, budget tracker, ottimizzazione percorso (TSP).
- **Fase 4** — Condivisione/export (JSON/QR), rifinitura UI/animazioni, empty/loading states.
- **Fase 5** — Backend **Laravel**: `docs/BACKEND.md` + `ApiItineraryRepository` completo (già
  predisposto), test estesi sui moduli core.

Dettagli di prodotto in `PRODUCT.md`, di design in `DESIGN.md`.

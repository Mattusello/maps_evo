# MyMappa — Documento di Handoff (Fase 1 + Fase 2)

Documento per **riprendere il progetto** (Fase 3 e successive) in un secondo momento.
Riassume stato, decisioni, architettura, come far girare/verificare e i prossimi passi.

- **Prodotto:** app mobile (iOS + Android) per creare, organizzare e condividere **itinerari di
  viaggio**, con per ogni tappa orari, prezzi e affollamento. Dettagli in [`PRODUCT.md`](../PRODUCT.md).
- **Design:** mondo visivo *Segnaletica / Wayfinding*, sviluppato con la skill **/impeccable**.
  Contratto e regole in [`DESIGN.md`](../DESIGN.md).
- **Metodo di lavoro:** sviluppo **a fasi (0→5)**; ci si **ferma a fine di ogni fase per conferma**
  prima di procedere. Commit a step logici.

Brief originale completo: [`prompt-claude-code-itinerari.md`](../prompt-claude-code-itinerari.md).

---

## 1. Stato attuale

| Fase | Contenuto | Stato |
|---|---|---|
| 0 | Scelte architetturali, struttura, modello dati | ✅ |
| 1 | Scaffold, design system, i18n, repository locale, navigazione base | ✅ |
| 2 | Mappa OSM, ricerca POI, aggiunta/dettaglio tappa (3 provider) | ✅ |
| 3 | Timeline + drag & drop, budget, ottimizzazione percorso (TSP) | ⬜ da fare |
| 4 | Condivisione/export, rifinitura UI/animazioni | ⬜ |
| 5 | Backend Laravel (BACKEND.md + ApiItineraryRepository), test estesi | ⬜ |

Verifiche verdi all'ultimo commit: `tsc` pulito, **14 test** verdi, bundle web ok.

---

## 2. Stack tecnico (deciso in Fase 0)

- **Expo SDK 57** (RN 0.86, React 19.2), workflow con **prebuild**, **TypeScript strict**.
- **expo-router** (navigazione file-based, deep-link pronti per la condivisione).
- **NativeWind v4** (Tailwind per RN) + **design system a token custom** in `src/ui/theme`.
  Strategia dark **`class`** (`tailwind.config.js`), variabili colore in `src/global.css`.
- **React Context + useReducer** per lo stato (niente Redux/Zustand), un context per dominio.
- **AsyncStorage dietro un layer repository astratto** (SQLite-ready). La UI dipende **solo**
  dai contratti, mai da storage o HTTP.
- **react-hook-form + zod**, **i18next** (solo `it`, struttura multilingua pronta),
  **@gorhom/bottom-sheet**, **react-native-reanimated**, **lucide-react-native**.
- **Mappa/POI:** stack **gratuito OpenStreetMap** (vedi §5 e `DATA_PROVIDERS.md`).

---

## 3. Come far girare e verificare

```bash
npm install
npm run web        # ANTEPRIMA PRINCIPALE (localhost:8081) — vedi §7 sul perché
npm run typecheck  # tsc --noEmit
npm test           # Jest (14 test)
npm start          # dev server (QR) per device — richiede un dev build, vedi §7
```

Chiavi/API: nessuna richiesta in Fase 1–2 (stack OSM gratuito). Vedi `.env.example` per le
variabili future (Google, backend).

---

## 4. Architettura e mappa dei file

```
src/
  app/                         # rotte expo-router
    _layout.tsx                # provider globali + font + tema + gesture/bottom-sheet root
    (tabs)/                    # index (lista itinerari), explore, settings
    itinerary/
      new.tsx                  # form nuovo itinerario (react-hook-form + zod)
      [id]/index.tsx           # overview itinerario (giorni, azioni)
      [id]/map.tsx             # MAPPA (Fase 2)
      [id]/timeline.tsx        # placeholder → Fase 3
      [id]/budget.tsx          # placeholder → Fase 3
  core/
    models/                    # entità + schema zod (FONTE DI VERITÀ dei dati)
    repositories/
      contracts/               # ItineraryRepository, AuthRepository, PriceReportRepository
      local/                   # impl. Fase 1/2 (AsyncStorage + outbox)
      api/                     # ApiItineraryRepository PREDISPOSTA (Laravel, Fase 5)
      index.ts                 # factory: sceglie impl. da env (getItineraryRepository, …)
    providers/                 # POI / prezzi / affollamento dietro interfacce (§5)
      contracts/  poi/  crowd/  price/  index.ts
    storage/keyValueStore.ts   # astrazione AsyncStorage (→ SQLite in futuro)
    sync/outbox.ts             # coda mutazioni per sync futuro
    api/apiClient.ts           # client HTTP centralizzato (token/errori) per Laravel
    config/env.ts              # lettura EXPO_PUBLIC_*
    utils/                     # id (uuid), time, format (money/price level)
  context/                     # ItinerariesContext, AuthContext, SettingsContext
  features/
    itineraries/components/    # RouteStrip (motivo firma), ItineraryCard
    map/                       # MapCanvas(.web), leafletHtml, mapPayload, PoiSearchBar
    stops/                     # StopDetailSheet, CrowdBars, openingHours, category
  ui/
    theme/                     # palette, tokens, ThemeProvider (useTheme/useThemeColors)
    components/                # Text, Button, Card, Badge, Chip, Screen, EmptyState, Fab,
                               # Skeleton, TextField
  i18n/                        # config + locales/it.json (NIENTE stringhe hardcoded)
docs/                          # DATA_PROVIDERS.md, HANDOFF.md (questo file)
```

### Pattern chiave da rispettare
- **Repository astratto:** importa sempre da `@/core/repositories` (`getItineraryRepository()`,
  `getPriceReportRepository()`), mai le classi `Local*`/`Api*`. Ogni mutazione locale scrive
  anche nell'**outbox** e marca l'entità `syncStatus: 'pending'` (per il sync di Fase 5).
- **Provider astratti:** importa da `@/core/providers` (`getPoiProvider/getCrowdProvider/
  getPriceProvider`). Sostituire una fonte = nuova classe dietro l'interfaccia, UI invariata.
- **Design a token:** niente colori/misure hardcoded; usa `useTheme()` (JS) o le classi NativeWind
  (`bg-surface`, `text-primary`, …). Tipografia solo via `<Text variant>`.
- **i18n:** ogni stringa passa da `t('...')` con chiave in `src/i18n/locales/it.json`.
- **Dato onesto:** affollamento sempre "stimato"; prezzo con freschezza.

---

## 5. I tre provider dati (§5) — stato

Attivi: **stack gratuito OpenStreetMap** (nessuna chiave). Dettagli e limiti in
[`DATA_PROVIDERS.md`](DATA_PROVIDERS.md).

- **PoiProvider → `OsmPoiProvider`** (Photon): autocomplete + reverse geocoding.
  ⚠️ OSM **non** dà orari/foto/priceLevel/rating → campi indefiniti in UI.
- **CrowdProvider → `EstimatedCrowdProvider`**: curve orarie per categoria × giorno settimana,
  sempre `source: 'estimated'`.
- **PriceProvider → `HybridPriceProvider`**: baseline (priceLevel, oggi assente) + prezzi
  **crowdsourced** (`PriceReport`) con freschezza e voto; persistiti in `LocalPriceReportRepository`.

Google resta un'opzione "drop-in" futura (un `GooglePoiProvider` dietro la stessa interfaccia).

---

## 6. Modello dati (dove agganciare le prossime fasi)

`src/core/models` (zod). Entità: **Itinerary** (title, days[], ownerId, collaborators[], currency,
partySize, syncStatus…), **Day** (orderedStopIds[]), **Stop** (title, category, location,
**plannedArrival**, **plannedDurationMin**, **cost**, bookingUrl, order…), **Poi**, **PriceReport**,
**CrowdEstimate**, **OutboxEntry**. Tutte con `id` UUID lato client, timestamps, `syncStatus`,
soft-delete (`deletedAt`).

**Metodi repository già pronti** utili alle fasi 3–4 (in `ItineraryRepository`):
`updateStop` (per orari/durata/costo), `reorderStops` (drag & drop **e** ottimizzazione TSP),
`moveStop`, `reorderDays`, `exportItinerary`/`importItinerary` (condivisione Fase 4).

---

## 7. Vincoli d'ambiente (IMPORTANTE per chi riprende)

- L'utente sviluppa su **iPhone + Windows**, **senza account Apple Developer** e senza Mac →
  **non può creare un dev build iOS su device**. Di conseguenza **valida tutto sul web**
  (`npm run web`). Tienine conto: ogni feature deve restare **visibile/funzionante sul web**.
- **Expo Go non funziona**: il progetto è su SDK 57, più recente del runtime dell'app Expo Go
  dello store. Per provare su device serve un **development build** (EAS per Android senza toolchain
  locale; iOS richiede account Apple o Mac).
- **Perché la mappa è in WebView/iframe (Leaflet) e non MapLibre nativo:** i moduli mappa nativi
  non girano su react-native-web; la WebView/iframe permette di vederla anche sul web. È dietro
  `MapCanvas`, quindi sostituibile in futuro.
- Il PC di sviluppo **non ha Java né Android SDK** (build Android locale non immediata).

---

## 8. Cosa è stato consegnato

**Fase 1** — Scaffold Expo SDK 57 + toolchain (NativeWind, TS strict, Jest, Prettier). Design system
Wayfinding (token colori light/dark, tipografia per ruoli con Archivo + sistema, spacing/raggi/ombre)
e componenti riutilizzabili + motivo `RouteStrip`. Modello dati zod. Layer repository astratto
(locale + API predisposta + factory + apiClient). Context per dominio. i18n `it`. Navigazione:
tab (Itinerari/Esplora/Impostazioni), lista con empty state/skeleton/FAB, form nuovo itinerario,
dettaglio itinerario, placeholder Mappa/Timeline/Budget. `PRODUCT.md`, `DESIGN.md`, `README.md`.

**Fase 2** — Mappa Leaflet + OSM (marker per categoria, linea-percorso) dietro `MapCanvas`
(WebView/iframe). Ricerca POI (Photon) e aggiunta tappa da ricerca o tap sulla mappa (reverse
geocoding). `StopDetailSheet` (bottom sheet) con stato apertura, affollamento stimato + istogramma
orario, prezzo crowdsourced con freschezza e voto. Tre provider dietro interfacce. `PriceReportRepository`.
`docs/DATA_PROVIDERS.md`. Test: crowd, orari, prezzi, repository.

---

## 9. Prossimi passi

### Fase 3 — Timeline, drag & drop, budget, TSP
- **Timeline** (`src/features/timeline`, sostituire `app/itinerary/[id]/timeline.tsx`): per ogni
  giorno, tappe ordinate con **orari pianificati** (`plannedArrival`) e **durata**
  (`plannedDurationMin`) → editabili via `updateStop`. Mostrare gli spostamenti tra tappe.
- **Drag & drop** per riordinare: già disponibile `reorderStops(dayId, orderedIds)`. Valutare
  `react-native-draggable-flatlist` (da installare) — verificare la resa **sul web**.
- **Budget** (`src/features/budget`, sostituire `app/itinerary/[id]/budget.tsx`): somma
  `Stop.cost` (+ eventuale prezzo crowdsourced) per **giorno**, **totale** e **per persona**
  (`itinerary.partySize`). Split costi tra partecipanti (§7 del brief). Valuta = `itinerary.currency`;
  usare `formatMoney` in `core/utils/format.ts`.
- **Ottimizzazione percorso (TSP)** (creare `src/core/tsp`): euristica **nearest-neighbor + 2-opt**
  sulle coordinate delle tappe del giorno; output → `reorderStops`. Commentare l'euristica.
  Idea §7: *smart scheduling* incrociando orari + affollamento (`CrowdProvider`).

### Fase 4 — Condivisione + rifinitura
- Export/import: `exportItinerary`/`importItinerary` già nel repository. Aggiungere UI + **JSON/QR**
  (serve una lib QR + `expo-clipboard`/`expo-sharing`). Gestione lista collaboratori a livello modello.
- Rifinitura UI/animazioni (usare **/impeccable**: `polish`, `animate`), empty/loading states,
  e il **finish-review** di impeccable rimandato dalla Fase 1.

### Fase 5 — Backend Laravel
- Scrivere `docs/BACKEND.md` (endpoint REST, payload JSON, auth **Sanctum**). Gli endpoint attesi
  sono già "cablati" in `ApiItineraryRepository`. Completare `apiClient` (token) e un **SyncEngine**
  che svuota l'**outbox** (`src/core/sync/outbox.ts`). Attivazione via `EXPO_PUBLIC_USE_API=true`.

---

## 10. Come riprendere in pratica

1. `npm install` → `npm run web` per vedere lo stato attuale; `npm test` e `npm run typecheck`.
2. Leggere `PRODUCT.md`, `DESIGN.md`, `DATA_PROVIDERS.md` e questo file.
3. Scegliere la fase, implementarla **feature per feature restando verificabile sul web**,
   committare a step logici, poi fermarsi per conferma.
4. Per il design usare la skill **/impeccable** (mondo visivo già definito in `DESIGN.md`).

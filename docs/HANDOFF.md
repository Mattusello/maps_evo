# MyMappa — Documento di Handoff (Fasi 1 → 3)

Documento per **riprendere il progetto** (Fase 4 e successive) in un secondo momento.
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
| 3 | Timeline + drag & drop, budget, ottimizzazione percorso (TSP) | ✅ |
| 4 | Condivisione/export, rifinitura UI/animazioni | ⬜ da fare |
| 5 | Backend Laravel (BACKEND.md + ApiItineraryRepository), test estesi | ⬜ |

Verifiche verdi all'ultimo commit: `tsc` pulito, **46 test** verdi, bundle web ok.
Timeline e Budget sono stati provati **nel browser** (riordino, foglio tappa, ottimizzazione,
inserimento costo): vedi §8.

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
  **react-native-reanimated**, **lucide-react-native**.
- **Fogli (bottom sheet):** sempre via il componente `ui/components/Sheet`. Nativo =
  **@gorhom/bottom-sheet**; web = `Sheet.web.tsx` fatto in casa, perché il modale di gorhom
  con Reanimated 4 su react-native-web viene montato ma **non compare** (vedi §7).
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
      [id]/timeline.tsx        # TIMELINE (Fase 3)
      [id]/budget.tsx          # BUDGET (Fase 3)
  core/
    geo/distance.ts            # haversine + stima tempi di spostamento (Fase 3)
    tsp/optimizeRoute.ts       # ottimizzazione percorso: nearest-neighbor + 2-opt (Fase 3)
    schedule/                  # daySchedule (orari) + smartSchedule (meno coda) (Fase 3)
    budget/budget.ts           # totali per giorno/viaggio/persona (Fase 3)
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
    timeline/                  # DayTimeline, TimelineRow, StopScheduleSheet (Fase 3)
    budget/                    # BudgetSummary, CostSheet (Fase 3)
  ui/
    theme/                     # palette, tokens, ThemeProvider (useTheme/useThemeColors)
    components/                # Text, Button, Card, Badge, Chip, Screen, EmptyState, Fab,
                               # Skeleton, TextField, Sheet(.web), DraggableList
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
- **Dato onesto:** affollamento sempre "stimato"; prezzo con freschezza; orari e distanze
  sono stime dichiarate (linea d'aria, velocità medie), mai spacciate per dati di routing.
- **Calcolo fuori dalla UI:** orari, budget e ottimizzazione stanno in `core/` come funzioni
  pure e testate; le schermate presentano soltanto.
- **Costi a persona:** `Stop.cost` è il costo **per persona** (come i `PriceReport`); il totale
  di gruppo è `costo × partySize`. Non mescolare le due letture.

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
- **Bottom sheet sul web:** `@gorhom/bottom-sheet` (v5) con **Reanimated 4** su react-native-web
  monta il modale ma non lo mostra: `present()` non produce nulla in pagina. Per questo esiste
  `ui/components/Sheet` con variante `.web.tsx`. **Non usare `BottomSheetModal` direttamente**:
  passa sempre da `Sheet`, altrimenti la feature sparisce sul web.
- **Animazioni Reanimated sul web:** le molle (`withSpring`) possono congelarsi a metà corsa.
  In `DraggableList` si usa `withTiming` e la posizione di riposo viene sempre riallineata da
  React (`initialIndex`), così una animazione interrotta non lascia la lista disallineata.
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

**Fase 3** — **Timeline**: per ogni giorno finestra oraria, totali visite/spostamenti, fermate con
orario di arrivo, permanenza, tratta di spostamento (a piedi/motorizzata, minuti + distanza),
affollamento stimato all'ora di arrivo, conflitti d'orario segnalati. **Riordino** per
trascinamento (`DraggableList` fatto in casa, funziona anche sul web) con alternativa accessibile
"Sposta su/giù" nel foglio della tappa. **Ottimizzazione percorso** (nearest-neighbor + 2-opt) con
esito dichiarato ("più corto di X" / "già il più breve"). **Smart scheduling**: proposte di orario
meno affollato, applicabili con un tocco. **Budget**: totale del viaggio, quota a persona, stepper
partecipanti, dettaglio per giorno e per tappa, costo modificabile con proposta del prezzo
crowdsourced; tappe senza costo e valute diverse dichiarate. Nuovo `ui/components/Sheet(.web)`
(usato anche dal `StopDetailSheet` della Fase 2, che sul web non si apriva). Test: geo, TSP,
orari/schedule, smart scheduling, budget (46 in totale).

---

## 9. Prossimi passi

### Fase 4 — Condivisione + rifinitura
- Export/import: `exportItinerary`/`importItinerary` già nel repository. Aggiungere UI + **JSON/QR**
  (serve una lib QR + `expo-clipboard`/`expo-sharing`). Gestione lista collaboratori a livello modello.
- Rifinitura UI/animazioni (usare **/impeccable**: `polish`, `animate`), empty/loading states,
  e il **finish-review** di impeccable rimandato dalla Fase 1.
- **Da verificare** (emerso provando la Fase 3 nel browser): sulla schermata Mappa i marker delle
  tappe non si vedevano con l'itinerario di prova — controllare centratura/fit dei bounds in
  `MapCanvas.web`. Da sistemare insieme alla rifinitura.

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

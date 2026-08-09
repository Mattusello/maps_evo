# mapsEvo — Documento di Handoff (Fasi 1 → 5)

Documento per **riprendere il progetto** in un secondo momento: resta da scrivere il backend
Laravel vero, seguendo il contratto in [`BACKEND.md`](BACKEND.md).
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
| 4 | Condivisione (QR/link/codice), import, collaboratori, rifinitura | ✅ |
| 5 | Contratto backend + sincronizzazione lato app | ✅ lato app |
| 5b | **Il backend Laravel vero**, da scrivere seguendo `docs/BACKEND.md` | ⬜ |

Verifiche verdi all'ultimo commit: `tsc` pulito, **112 test** verdi, bundle web ok, detector
di `/impeccable` pulito.

⚠️ Due cose non verificate da una persona, ed è bene saperlo:
- **La Fase 4 non è ancora stata guardata nel browser** (l'estensione Chrome non era
  collegata durante lo sviluppo). Cosa provare per prima cosa: §10.
- **La Fase 5 non ha mai parlato con un server vero**: su questo PC non ci sono PHP né
  Composer. Il motore di sincronizzazione è provato contro un trasporto finto che rispetta
  `docs/BACKEND.md`; quei test sono la specifica eseguibile del protocollo, non una prova
  che il backend funzioni.

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
npm run web           # ANTEPRIMA PRINCIPALE (localhost:8081) — vedi §7 sul perché
npm run typecheck     # tsc --noEmit
npm test              # Jest (112 test)
npm run assets:brand  # rigenera icona/splash/favicon dal motivo della linea-percorso
npm start             # dev server (QR) per device — richiede un dev build, vedi §7
```

**Test di componente** (introdotti in Fase 4, vedi `src/test/importScreen.test.tsx`): si montano con
`renderWithProviders` (`src/test/`), che porta tema, safe-area e i18n. Attenzione: in
@testing-library/react-native 14 **`render` e `fireEvent` sono asincroni** e vanno attesi con
`await`, altrimenti gli aggiornamenti di stato non risultano applicati. La configurazione
necessaria sta in `jest.config.js` (resolver di `react-native-worklets`, mapping di
`lucide-react-native` sulla build CJS) e in `jest.setup.js` (`IS_REACT_ACT_ENVIRONMENT`).

Chiavi/API: nessuna richiesta per usare l’app (stack OSM gratuito). Il backend si attiva con
`EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_USE_API` (vedi `.env.example`); senza, l’app resta locale
e lo dichiara nelle Impostazioni.

---

## 4. Architettura e mappa dei file

```
src/
  app/                         # rotte expo-router
    _layout.tsx                # provider globali + font + tema + gesture/bottom-sheet root
    (tabs)/                    # index (lista itinerari), explore, settings
    import.tsx                 # IMPORTA itinerario ricevuto (Fase 4) + bersaglio deep link
    itinerary/
      new.tsx                  # form nuovo itinerario (react-hook-form + zod)
      [id]/index.tsx           # overview itinerario (giorni, azioni, condividi)
      [id]/map.tsx             # MAPPA (Fase 2)
      [id]/timeline.tsx        # TIMELINE (Fase 3)
      [id]/budget.tsx          # BUDGET (Fase 3)
  core/
    sharing/                   # shareCode (formato + codifica) + shareLink (Fase 4)
    geo/distance.ts            # haversine + stima tempi di spostamento (Fase 3)
    tsp/optimizeRoute.ts       # ottimizzazione percorso: nearest-neighbor + 2-opt (Fase 3)
    schedule/                  # daySchedule (orari) + smartSchedule (meno coda) (Fase 3)
    budget/budget.ts           # totali per giorno/viaggio/persona (Fase 3)
    models/                    # entità + schema zod (FONTE DI VERITÀ dei dati)
    repositories/
      contracts/               # ItineraryRepository, AuthRepository, PriceReportRepository
      local/                   # AsyncStorage + outbox; LocalCollections (condivise col sync)
      api/                     # ApiItineraryRepository (solo online) + ApiAuthRepository
      index.ts                 # factory: sceglie impl. da env (getItineraryRepository, …)
    providers/                 # POI / prezzi / affollamento dietro interfacce (§5)
      contracts/  poi/  crowd/  price/  index.ts
    storage/keyValueStore.ts   # astrazione AsyncStorage (→ SQLite in futuro)
    utils/base64.ts            # base64url UTF-8 scritto a mano (Hermes non ha btoa)
    sync/                      # outbox + contracts + syncEngine + ApiSyncTransport (Fase 5)
    api/                       # apiClient (token, timeout, classificazione errori) + tokenStore
    config/env.ts              # lettura EXPO_PUBLIC_*
    utils/                     # id (uuid), time, format (money/price level)
  context/                     # Itineraries, Auth (sessione), Settings, Sync (Fase 5)
  features/
    itineraries/components/    # RouteStrip (motivo firma), ItineraryCard
    map/                       # MapCanvas(.web), leafletHtml, mapPayload, PoiSearchBar
    stops/                     # StopDetailSheet, CrowdBars, openingHours, category
    timeline/                  # DayTimeline, TimelineRow, StopScheduleSheet (Fase 3)
    budget/                    # BudgetSummary, CostSheet (Fase 3)
    sync/                      # AccountSyncCard: account e stato della sincronizzazione
    sharing/                   # ShareSheet (QR/link/codice), CollaboratorsSheet,
                               # shareActions (appunti + foglio di sistema) (Fase 4)
  test/                        # renderWithProviders per i test di componente (Fase 4)
  types/                       # dichiarazioni locali (qrcode, usato solo nei test)
  ui/
    theme/                     # palette, tokens, motion (useReducedMotion), ThemeProvider
    components/                # Text, Button, Card, Badge, Chip, Screen, EmptyState, Fab,
                               # Skeleton, TextField, Sheet(.web), DraggableList
  i18n/                        # config + locales/it.json (NIENTE stringhe hardcoded)
docs/                          # DATA_PROVIDERS.md, BACKEND.md (contratto server), HANDOFF.md
```

### Pattern chiave da rispettare
- **Repository astratto:** importa sempre da `@/core/repositories` (`getItineraryRepository()`,
  `getPriceReportRepository()`), mai le classi `Local*`/`Api*`. Ogni mutazione locale scrive
  anche nell'**outbox** e marca l'entità `syncStatus: 'pending'`: è ciò che il SyncEngine
  rigioca verso il server.
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
- **Il locale resta la sorgente di verità.** Anche con il backend attivo la UI legge e scrive
  dal repository locale: il server è la copia condivisa, e ad allineare le due parti è il
  `SyncEngine`. Quindi: ogni mutazione deve lasciare una voce nell'**outbox** (se cambia anche
  il genitore — l'ordine dei giorni o delle tappe — vanno messe in coda **entrambe**), e i dati
  che arrivano dal server si scrivono con `LocalCollections`, **mai** passando dal repository:
  altrimenti tornerebbero in coda verso il mittente.
- **Distinguere "non c'è rete" da "il server ha rifiutato".** È `ApiError.isNetwork` a deciderlo,
  ed è ciò che stabilisce se una modifica si riprova o si scarta: non inghiottire quell'errore.
- **Condivisione = copia.** Un itinerario ricevuto diventa una **copia locale** con id nuovi:
  non è un documento condiviso finché non c'è il backend. La UI lo dichiara; non promettere
  sincronizzazione. Il formato del codice è versionato (`SHARE_CODE_VERSION`): un codice più
  recente viene **rifiutato con un motivo**, mai letto a metà. Se si aggiunge una categoria o
  una valuta al modello, va aggiunta **in coda** a `SHARED_CATEGORIES`/`SHARED_CURRENCIES`
  (l'ordine è parte del protocollo; un test lo verifica).

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

## 6. Modello dati

`src/core/models` (zod). Entità: **Itinerary** (title, days[], ownerId, collaborators[], currency,
partySize, syncStatus…), **Day** (orderedStopIds[]), **Stop** (title, category, location,
**plannedArrival**, **plannedDurationMin**, **cost**, bookingUrl, order…), **Poi**, **PriceReport**,
**CrowdEstimate**, **OutboxEntry**. Tutte con `id` UUID lato client, timestamps, `syncStatus`,
soft-delete (`deletedAt`).

**Metodi del repository** (in `ItineraryRepository`):
`updateStop` (per orari/durata/costo), `reorderStops` (drag & drop **e** ottimizzazione TSP),
`moveStop`, `reorderDays`, `exportItinerary`/`importItinerary` (condivisione).

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
- Il PC di sviluppo **non ha Java né Android SDK** (build Android locale non immediata),
  **né PHP né Composer**: il backend Laravel non è scrivibile/eseguibile da qui. Per questo
  la Fase 5 consegna il contratto (`docs/BACKEND.md`) e tutto il lato app, provato contro un
  trasporto finto.

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

**Fase 4** — **Condivisione**: un itinerario esce come **QR**, **link profondo**
(`mymappa://import?c=…`) o **codice** testuale, più il JSON completo come backup. Il formato
del codice è compatto e versionato: tappe come tuple posizionali, categoria e valuta come
indici, coordinate come scarti interi da un'origine comune — così un viaggio di 3 giorni ×
5 tappe **sta davvero in un QR leggibile** (col formato esteso serviva un QR di versione 31,
inquadrabile solo in teoria). La soglia `QR_MAX_CHARS` è tarata sulla capienza reale e
verificata contro l'encoder vero; oltre la soglia la UI dice di usare il link invece di
disegnare un reticolo illeggibile. **Import** (rotta `/import`, anche bersaglio del deep
link): accetta link, codice o JSON, mostra sempre **un'anteprima** prima di scrivere e
distingue "codice illeggibile" da "formato più recente dell'app". **Collaboratori** a livello
di modello con ruoli. **Rifinitura su tutta l'app** (il finish-review rimandato dalla Fase 1):
contrasto del testo piccolo portato sopra 4.5:1 in entrambi i temi, colori-categoria sdoppiati
per tema, focus da tastiera visibile sul web, ombre reali sul web, stati di errore e testi
fuorvianti corretti, tesi di motion scritta e rispetto di *Riduci movimento*. **Marchio
provvisorio** generato da script dal motivo della linea-percorso. Corretto il difetto noto dei
marker della mappa (closure vecchia nel canvas web). Test: base64, formato di condivisione,
capienza QR, export/import del repository, flusso di import a livello di UI (85 in totale).

**Fase 5** — **Contratto del backend** ([`BACKEND.md`](BACKEND.md)): autenticazione Sanctum,
entità e tabelle, autorizzazioni per ruolo, protocollo di sincronizzazione (push a batch
idempotente + pull incrementale con cursore), regola dei conflitti, formato degli errori e
cosa fa il client per ognuno. **Lato app**: `SyncEngine` che svuota l'outbox e riporta le
modifiche del server nelle stesse collezioni del repository locale; `apiClient` costruito
attorno alla distinzione fra errore di rete (si riprova) e rifiuto (si scarta), con token
Sanctum persistito e 401 che chiude la sessione senza toccare i dati locali;
`ApiAuthRepository` con accesso, registrazione e uscita; `SyncContext` che decide *quando*
sincronizzare (avvio, ritorno in primo piano, richiesta esplicita — nessun timer di fondo);
sezione **Account e sincronizzazione** nelle Impostazioni con i tre stati dichiarati. I test
(sync engine, apiClient, sezione account) sono 27 e girano contro un trasporto finto: 112 in
totale. Emersi e corretti due difetti preesistenti: le modifiche all'**ordine** dentro il
genitore non finivano in coda, e i campi di `TextField` non avevano nome per lo screen reader.

---

## 9. Prossimi passi

### Rimasto indietro dalla Fase 4 (piccolo)
- **Icona e splash sono un marchio provvisorio** generato da script: coerente col mondo
  visivo, ma non un logo disegnato. Da sostituire con l'asset vero.
- **Esplora** è ancora un segnaposto dichiarato: la superficie va progettata quando serve.
- **Hover sul web** non implementato di proposito (app native-first, web = superficie di
  validazione). Da progettare solo se il web diventa un target di spedizione.
- La condivisione produce **copie**: la collaborazione vera arriva col backend.

### Il passo successivo: scrivere il backend
Serve una macchina con PHP e Composer. Il lavoro è guidato: `docs/BACKEND.md` è il contratto,
e i test in `src/core/sync/syncEngine.test.ts` mostrano ogni caso che il server deve
soddisfare. Ordine consigliato:

1. Progetto Laravel + Sanctum, migrazioni con **chiavi UUID generate dal client** e soft delete.
2. `/api/auth/*`, poi `/api/sync/pull` (più semplice: una query per intervallo su `updated_at`).
3. `/api/sync/push` con la tabella di idempotenza e la regola dei conflitti (§4.3).
4. Policy per i ruoli (un `viewer` non deve poter scrivere, nemmeno via sync).
5. Endpoint REST per risorsa (§5), che il client usa solo in modalità "solo online".

Poi, dall'app: `.env` con `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_USE_API=true`, accesso dalle
Impostazioni e prima sincronizzazione. **Da provare per primi** i casi che i test coprono ma
un server vero può smentire: due dispositivi che modificano la stessa tappa, una modifica
fatta in aereo che parte al ritorno del segnale, e un token scaduto mentre l'app è aperta.

### Quando ci sarà il backend, da rivedere lato app
- **Il token sta in AsyncStorage, che non è cifrato**: passare a `expo-secure-store`
  (`src/core/api/tokenStore.ts` è già l'unico punto da toccare).
- La regola dei conflitti è "vince l'ultima scrittura" per **entità**: se la collaborazione in
  tempo reale diventa il caso d'uso vero, va ripensata (fusione per campo o CRDT).
- La UI segnala i conflitti come conteggio: manca una schermata per **rivederli**.
- I collaboratori sono oggi una lista locale: con gli account diventano inviti veri.

---

## 10. Come riprendere in pratica

1. `npm install` → `npm run web` per vedere lo stato attuale; `npm test` e `npm run typecheck`.
2. Leggere `PRODUCT.md`, `DESIGN.md`, `DATA_PROVIDERS.md` e questo file.
3. Scegliere la fase, implementarla **feature per feature restando verificabile sul web**,
   committare a step logici, poi fermarsi per conferma.
4. Per il design usare la skill **/impeccable** (mondo visivo già definito in `DESIGN.md`).

### Cosa provare per primo nel browser (Fasi 4 e 5, mai viste da una persona)

1. Apri un itinerario con qualche tappa → icona **Condividi** in alto a destra: il QR deve
   comparire (arrivo animato) e i pulsanti copia devono dare conferma.
2. Copia il link e aprilo in una scheda nuova: deve arrivare su `/import` con **l'anteprima**
   dell'itinerario, e "Aggiungi ai miei itinerari" deve creare una copia.
3. Incolla un testo a caso nel campo di import: deve spiegare il perché, non fallire in
   silenzio.
4. Schermata **Mappa**: i marker delle tappe ora devono comparire (era il difetto noto della
   Fase 3).
5. Passa a tema scuro dalle Impostazioni e ricontrolla foglio Condividi, timeline e budget.
6. **Impostazioni → Account e sincronizzazione** (Fase 5): senza backend configurato deve dire
   che i dati restano sul dispositivo e quante modifiche sono in coda. Il modulo di accesso
   compare solo con `EXPO_PUBLIC_USE_API=true`, e per andare oltre serve il server.

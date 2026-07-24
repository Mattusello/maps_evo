# Prompt per Claude Code — App Itinerari "MyMap-like" (React Native)

Sei incaricato di sviluppare **da zero** un'applicazione mobile cross-platform (iOS + Android) in **React Native**. L'app replica e migliora l'esperienza di Google My Maps, ma è **incentrata sulla creazione e gestione di itinerari di viaggio**, con informazioni per ogni tappa su **disponibilità/orari, prezzi e affollamento**. L'app deve essere collaborativa (itinerari condivisibili tra più utenti). UI in **italiano**.

Lavora in modo incrementale: proponi la struttura, crea lo scaffold, poi implementa per milestone. Committa a step logici. Non generare tutto in un unico blocco: procedi a fasi e fermati a chiedere conferma dove indicato.

---

## 1. Stack tecnico (vincolante)

- **Expo con prebuild (workflow ibrido)** — SDK stabile più recente. Rapidità di sviluppo ma con possibilità di moduli nativi.
- **TypeScript** ovunque, strict mode.
- **Mappa: `react-native-maps`** (provider Google) su iOS e Android.
- **Navigazione: `expo-router`** (file-based) o React Navigation se più adatto — motiva la scelta.
- **Stato globale: React Context** (+ `useReducer` dove serve). Niente Redux/Zustand. Organizza i context per dominio (es. `ItinerariesContext`, `AuthContext`, `SettingsContext`), evitando un unico mega-context.
- **Persistenza locale (fase 1): `AsyncStorage`** con un layer repository astratto (vedi §4). Valuta `expo-sqlite` se la struttura dati lo giustifica e spiega perché.
- **Form/validazione**: `react-hook-form` + `zod`.
- **i18n**: `i18next` / `react-i18next` predisposto da subito (una sola lingua caricata, `it`, ma struttura pronta a multilingua). Nessuna stringa hardcoded nei componenti.
- **Testing**: Jest + React Native Testing Library sui moduli core (repository, utility itinerario, provider).

## 2. Obiettivo di prodotto

Un'app dove l'utente:
1. Crea itinerari (mono o multi-giorno).
2. Aggiunge **tappe** cercando POI sulla mappa o toccando un punto.
3. Per ogni tappa vede **orari/disponibilità, fascia di prezzo, affollamento previsto**.
4. Organizza le tappe su una **timeline con orari**, ottimizza il percorso, tiene un **budget**.
5. **Condivide** l'itinerario e collabora con altri.

## 3. Persistenza: locale ora, backend Laravel dopo (CRITICO)

Fase 1 = tutto in locale per velocità. MA l'architettura deve essere pronta per un **backend custom Laravel** in fase 2, **senza riscrivere la UI**.

Per questo:
- Definisci un layer **repository/service** con interfacce (`ItineraryRepository`, `AuthRepository`, ecc.).
- Implementazione fase 1: `LocalItineraryRepository` (AsyncStorage/SQLite).
- Predisponi (senza implementare la logica server) una `ApiItineraryRepository` con la stessa interfaccia, un `apiClient` (axios/fetch) centralizzato con base URL da env, gestione token/errori.
- Modella i dati pensando a un'API REST Laravel: entità con `id` (UUID lato client per merge futuro), timestamps, `ownerId`, `collaborators[]`, `syncStatus`.
- Documenta in un file `BACKEND.md` il contratto REST previsto (endpoint, payload JSON, auth Sanctum) così il backend Laravel potrà essere costruito su misura.
- Prepara un semplice meccanismo di **outbox/sync flag** sulle entità per una futura sincronizzazione.

## 4. Modello dati (indicativo, adatta pure)

- **Itinerary**: id, title, description, coverImage, days[], ownerId, collaborators[], currency, createdAt, updatedAt, syncStatus.
- **Day**: id, date, orderedStops[] (ordine tappe).
- **Stop**: id, poiRef, title, category, location{lat,lng}, plannedArrival, plannedDuration, notes, cost{amount,currency,source}, bookingUrl, order.
- **Poi** (da provider): placeId, name, category, location, openingHours, priceLevel, rating, photos[], contatti.
- **CrowdEstimate**: byHour/byWeekday, livello (basso/medio/alto), source, confidence.

## 5. Strategia dati POI / prezzi / affollamento (IMPORTANTE — implementa con astrazioni)

Non esiste un'unica fonte affidabile per tutto. Implementa **tre provider disaccoppiati dietro interfacce**, così sono sostituibili:

- **`PoiProvider`** → implementazione con **Google Places API** (Autocomplete, Place Details, Photos): fornisce nome, categoria, orari, `priceLevel`, rating, foto, coordinate. Chiave API da variabili d'ambiente (`.env`, `expo-constants`), **mai** hardcoded. Gestisci quota/caching.
- **`PriceProvider`** → strategia ibrida:
  - baseline dal `priceLevel` di Google (€ – €€€€);
  - **prezzi crowdsourced**: gli utenti inseriscono/confermano il prezzo reale di una tappa; ogni dato ha timestamp e "freschezza" e può essere votato. È coerente con la natura collaborativa dell'app.
- **`CrowdProvider`** → i "Popular Times" di Google NON sono disponibili via API ufficiale. Quindi, per l'MVP, implementa un **modello stimato**: funzione `estimateCrowd(category, weekday, hour)` con curve tipiche per categoria (museo, ristorante, attrazione, ecc.). Isola tutto dietro l'interfaccia così in futuro si può collegare un servizio reale (es. BestTime API) senza toccare la UI. Mostra sempre in UI che il dato è **stimato**.

Aggiungi un file `DATA_PROVIDERS.md` che spiega fonti, limiti e come sostituirle.

## 6. Funzionalità MVP (tutte prioritarie)

1. **Creazione/modifica itinerario** multi-giorno.
2. **Mappa interattiva**: ricerca POI, tap per aggiungere tappa, marker custom per tipo tappa, tracciamento percorso tra tappe (polyline / Directions).
3. **Dettaglio tappa**: orari & stato apertura in tempo reale ("Aperto · chiude alle 18:00"), fascia prezzo + prezzo crowdsourced, affollamento stimato per fascia oraria, foto, link prenotazione.
4. **Timeline giornaliera** con orari pianificati, durata, spostamenti tra tappe (drag & drop per riordinare).
5. **Ottimizzazione percorso (TSP)**: riordina le tappe per minimizzare il tragitto (euristica nearest-neighbor + 2-opt su piccoli set; per l'MVP va bene un'euristica locale, senza API a pagamento se non necessario).
6. **Budget tracker**: costo per tappa, totale per giorno e per itinerario, costo per persona, valuta configurabile.
7. **Condivisione/collaborazione**: in fase 1 export/import itinerario (link/JSON/QR) e gestione lista collaboratori a livello di modello; predisponi la collaborazione real-time per la fase backend.

## 7. Idee innovative da integrare (implementa quelle a basso costo subito, predisponi le altre)

- **Smart scheduling**: suggerisci l'ordine/orario di visita incrociando orari di apertura + affollamento stimato ("Visita il museo alle 9:30: meno coda").
- **Avvisi time-aware**: badge "Chiude tra 40 min", "Ora affollamento basso".
- **Budget con split**: divisione costi tra partecipanti.
- **Freschezza del dato prezzo**: indicatore visivo + possibilità di aggiornare/votare.
- **(Fase backend) Presence live**: vedere in tempo reale i collaboratori sull'itinerario.
- **(Fase backend) Suggerimenti "tappe vicine"** in base a categoria e buchi nella timeline.

Chiedimi conferma prima di implementare le idee che aumentano lo scope oltre l'MVP.

## 8. Design & UX (alta priorità)

Deve essere **intuitiva, moderna e accattivante** secondo gli standard 2025/2026:
- Design system coerente: tokens (colori, spacing, tipografia, radius), tema chiaro/scuro, componenti riutilizzabili.
- Preferisci uno stile pulito e spazioso; usa una libreria UI moderna (es. Tamagui, o NativeWind/Tailwind RN, o gluestack) — proponi la scelta e motivala.
- **Bottom sheet** fluidi per dettaglio tappa (`@gorhom/bottom-sheet`), gesti nativi, animazioni con `react-native-reanimated`.
- Micro-interazioni curate, stati di loading con skeleton, empty states illustrati.
- Icone coerenti (`lucide-react-native` o simili).
- Accessibilità: contrasto, dimensioni tap target, label screen reader.
- Rispetta le linee guida iOS (HIG) e Android (Material) dove sensato.

## 9. Struttura progetto & qualità

- Struttura per feature/domini (es. `features/itineraries`, `features/map`, `core/repositories`, `core/providers`, `ui/components`, `theme`).
- ESLint + Prettier + TypeScript strict.
- `.env.example` con le chiavi necessarie (Google Maps/Places).
- `README.md` con setup, come inserire le API key, run iOS/Android, e roadmap fasi (locale → Laravel).
- Codice commentato dove la logica è non ovvia (TSP, stima affollamento, sync).

## 10. Come procedere (fasi — fermati a fine di ognuna per conferma)

1. **Fase 0** — Proponi: scelta navigazione + libreria UI + eventuale SQLite, struttura cartelle, modello dati definitivo. Attendi ok.
2. **Fase 1** — Scaffold Expo + prebuild, TypeScript, theming, i18n, layer repository locale, navigazione base. 
3. **Fase 2** — Mappa + ricerca POI + aggiunta tappe + dettaglio tappa (con orari/prezzi/affollamento tramite i provider).
4. **Fase 3** — Timeline, drag & drop, budget, ottimizzazione percorso.
5. **Fase 4** — Condivisione/export, rifinitura UI/animazioni, empty/loading states.
6. **Fase 5** — `BACKEND.md` + `ApiItineraryRepository` predisposto per Laravel, test sui moduli core.

Inizia dalla **Fase 0**: analizza i requisiti, proponi le scelte aperte con motivazione e mostrami la struttura di cartelle e il modello dati prima di scrivere codice.

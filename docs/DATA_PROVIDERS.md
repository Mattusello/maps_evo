# Provider di dati — POI, prezzi, affollamento

Tre fonti dati distinte, ognuna dietro un'interfaccia in `src/core/providers/contracts`,
così sono **sostituibili senza toccare la UI**. La factory in `src/core/providers/index.ts`
decide l'implementazione attiva.

## 1. POI — `PoiProvider`

**Implementazione attiva:** `OsmPoiProvider` (gratuita, OpenStreetMap via **Photon**,
`https://photon.komoot.io`). Nessuna chiave API.

- `search()` → autocomplete luoghi (usato dalla barra di ricerca in mappa).
- `reverseGeocode()` → dal punto toccato sulla mappa al luogo più vicino (tap-per-aggiungere).
- `details()` → non disponibile su Photon (ritorna `null`).

**Limiti onesti:** Photon/OSM **non forniscono orari di apertura, priceLevel, foto o rating**
in modo affidabile. Questi campi restano indefiniti e la UI li mostra come "non disponibili".
Le tile della mappa (Leaflet) usano il tile server pubblico OSM: va bene in sviluppo/MVP con
attribuzione, ma ha limiti d'uso — in produzione usare un provider di tile dedicato.

**Come sostituirlo:** implementare `PoiProvider` con Google Places (Autocomplete, Place Details,
Photos) in un `GooglePoiProvider`, che riempirebbe orari/prezzo/foto/rating, e restituirlo dalla
factory (es. in base a `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`). La UI non cambia.

## 2. Prezzi — `PriceProvider`

**Implementazione attiva:** `HybridPriceProvider`. Strategia ibrida (§5):

- **baseline**: `priceLevel` (€ – €€€€) quando la fonte POI lo fornisce (oggi assente con OSM);
- **crowdsourced**: prezzi reali inseriti dagli utenti (`PriceReport`), con **timestamp** e
  **voti**. Il provider sceglie il report con punteggio più alto e ne calcola la **freschezza**
  (giorni dall'inserimento). La UI mostra freschezza (verde/giallo/rosso) e permette di votare.

I report sono persistiti da `LocalPriceReportRepository` (locale); in Fase backend diventeranno
condivisi (il valore cresce con la community). Coerente con la natura collaborativa dell'app.

## 3. Affollamento — `CrowdProvider`

**Implementazione attiva:** `EstimatedCrowdProvider`. I "Popular Times" di Google **non** sono
disponibili via API ufficiale, quindi per l'MVP stimiamo l'affollamento con **curve orarie
tipiche per categoria** (museo, ristorante, vita notturna, ecc.), modulate dal giorno della
settimana. `estimateCrowd(category, weekday, hour)` → livello + intensità + confidence.

**Il dato è sempre "stimato"** (`source: 'estimated'`, `confidence < 1`) e in UI è etichettato
come tale. **Come sostituirlo:** collegare un servizio reale (es. BestTime API) implementando
`CrowdProvider`; la UI (badge + istogramma orario) resta invariata.

## Perché questa astrazione

Nessuna fonte è affidabile per tutto e le condizioni (prezzi, quote, disponibilità) cambiano.
Tenendo le tre fonti dietro interfacce, possiamo partire **gratis** con OpenStreetMap e passare
in futuro a fonti a pagamento più ricche, per singolo dominio, senza riscrivere le schermate.

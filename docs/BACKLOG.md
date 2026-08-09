# Backlog — distanza dal brief MVP

Confronto fra le funzionalità richieste in `prompt-claude-code-itinerari.md` (§6 MVP, §7 idee,
§9 qualità) e ciò che l'app fa davvero, verificato sul codice l'8 agosto 2026.
**Cinque MVP su sette sono completi**; qui restano solo le lacune, in ordine di lavoro
consigliato.

## 1. Modifica di un itinerario — mancante

Il brief chiede "creazione/**modifica** itinerario multi-giorno". La creazione c'è
(`src/app/itinerary/new.tsx`), la modifica no: non esiste nessuna schermata per cambiare
titolo, descrizione, valuta o date dopo la creazione. `repo.update` viene invocato solo per i
collaboratori (`itinerary/[id]/index.tsx`) e per il numero di persone (`budget.tsx`).

Serve una schermata di modifica, o la stessa di creazione riusata in modalità modifica.

## 2. Gestione dei giorni — incompleta

Tre metodi del contratto repository non arrivano mai all'interfaccia:

| Metodo | Effetto mancante in UI |
|---|---|
| `removeDay` | non si può eliminare un giorno |
| `updateDay` | non si può rinominare/datare un giorno |
| `reorderDays` | non si possono riordinare i giorni fra loro |

Oggi un giorno si può solo aggiungere. Il lavoro è tutto lato UI: la logica è già scritta e
testata in `LocalItineraryRepository`.

## 3. Dettaglio tappa — orari e foto assenti

- **Orari e stato di apertura**: la logica esiste ed è testata (`features/stops/openingHours.ts`,
  `openingHours.test.ts`), ma `StopDetailSheet.tsx` chiama `getOpenStatus(undefined, now)` —
  nessuna fonte fornisce gli orari, quindi il badge dice sempre "orari non disponibili".
  Di conseguenza l'avviso time-aware "Chiude tra 40 min" (§7) non può mai comparire.
- **Foto**: il modello `Poi` ha il campo `photos`, ma nessuna fonte lo popola e la UI non lo mostra.

**Causa comune, ed è una decisione di costo prima che di codice.** Il progetto usa Photon
(OpenStreetMap), che dà nomi e coordinate ma non orari né foto; il brief le dava per scontate
perché ipotizzava Google Places — la chiave `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.example`
è ancora lì, inutilizzata. L'architettura è già pronta: un `GooglePoiProvider` dietro
l'interfaccia `PoiProvider` esistente accende orari e foto **senza toccare le schermate**.
Da decidere: pagare Places, oppure dichiarare che orari e foto restano fuori dall'MVP.

## 4. Percorso: linea diretta, non stradale

La polyline fra le tappe unisce i punti in linea d'aria. Il brief citava "polyline / Directions":
scelta consapevole per non introdurre un servizio a pagamento. Da rivedere insieme al punto 3,
perché la decisione è la stessa.

## 5. Esplora — segnaposto

`src/app/(tabs)/explore.tsx` mostra solo un empty state "In arrivo". Già dichiarato come tale in
DESIGN.md: la superficie va progettata quando la fase arriva.

## 6. ESLint dichiarato ma assente

Il §9 chiede "ESLint + Prettier + TypeScript strict". Prettier e strict ci sono; ESLint **non è
installato** e `npx expo lint` non è utilizzabile: si auto-configura al primo avvio (crea
`eslint.config.js`, aggiunge le dipendenze) e poi fallisce con `Cannot find module 'eslint'`,
lasciando il working tree sporco. Va installato davvero oppure rimosso dalle aspettative.

---

## Non sono lacune

Segnati per non riaprirli per errore: la collaborazione real-time, la presence live e i
suggerimenti "tappe vicine" sono esplicitamente **di fase backend** nel brief (§7), e il
contratto lato server è già consegnato in `docs/BACKEND.md`.

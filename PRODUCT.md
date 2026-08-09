# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Viaggiatori che pianificano viaggi (city break, itinerari multi-giorno, road trip) da
soli o **in gruppo**. Situazione tipica: prima del viaggio, seduti a organizzare tappe e
orari; durante il viaggio, in mobilità, che consultano la tappa corrente ("è aperto? quanto
costa? quanta coda c'è ora?"). Alcuni sono l'"organizzatore" del gruppo (crea e cura
l'itinerario), altri sono partecipanti che consultano e contribuiscono (prezzi reali, note).

## Product Purpose

mapsEvo permette di **creare, organizzare e condividere itinerari di viaggio** con, per ogni
tappa, informazioni operative su **orari/disponibilità, prezzi e affollamento previsto**.
Migliora l'esperienza di Google My Maps rendendola incentrata sul viaggio: non solo mappe con
segnaposto, ma una **timeline con orari**, un **budget**, l'**ottimizzazione del percorso** e
la **collaborazione** tra più persone. Successo = l'utente costruisce un itinerario che regge
la prova del viaggio reale (arriva alle tappe quando sono aperte, con meno coda, dentro budget).

## Positioning

Il meccanismo distintivo è l'incrocio, per ogni tappa, di **tre segnali** — orari di apertura,
fascia di prezzo (baseline Google + prezzi reali crowdsourced dagli utenti) e affollamento
stimato per fascia oraria — usati per **suggerire quando visitare** ("Vai al museo alle 9:30:
meno coda") e per costruire una timeline realistica. La natura **collaborativa** (i prezzi
reali migliorano con l'uso del gruppo/community) è ciò che un clone di My Maps non può copiare
banalmente.

## Operating Context

- **Due scene d'uso opposte**: pianificazione rilassata (schermo grande d'attenzione, molte
  tappe da manipolare) e consultazione in movimento (una mano, sole, fretta, "cosa faccio
  adesso"). L'interfaccia deve servire entrambe.
- Flusso principale: crea itinerario → aggiungi tappe (ricerca POI o tap su mappa) → organizza
  su timeline con orari → ottimizza percorso → traccia budget → condividi/collabora.
- Superfici principali: lista itinerari, mappa interattiva, dettaglio tappa (bottom sheet),
  timeline giornaliera, budget, condivisione.
- Dato **stimato** (affollamento) va sempre segnalato come tale in UI.

## Capabilities and Constraints

- Cross-platform iOS + Android, React Native (Expo SDK 57, prebuild), `react-native-maps`
  (provider Google).
- **Fase 1 tutto in locale** (AsyncStorage dietro un layer repository astratto); architettura
  pronta a un backend Laravel in Fase 2 senza riscrivere la UI.
- Provider dati disaccoppiati dietro interfacce: POI (Google Places), prezzi (ibrido
  Google priceLevel + crowdsourced), affollamento (modello stimato per categoria).
- UI **in italiano**, struttura i18n pronta al multilingua (nessuna stringa hardcoded).
- Terminologia di dominio: *Itinerario, Giorno, Tappa (Stop), POI, Fascia di prezzo,
  Affollamento, Timeline, Budget, Collaboratore*.

## Brand Commitments

- **Nome**: mapsEvo (nome di lavoro, inferito). *[da confermare]*
- **Voce**: pratica, chiara, incoraggiante ma mai chiassosa; da compagno di viaggio competente.
- Nessun logo o asset di brand fornito finora. *[assente — non inventare come reale]*

## Evidence on Hand

- Brief di prodotto completo in `prompt-claude-code-itinerari.md`.
- Nessun contenuto reale, screenshot, testimonianza o dato utente esistente: ogni itinerario/
  prezzo mostrato in sviluppo è **materiale dimostrativo**, da etichettare come tale.

## Product Principles

1. **Il tempo è il dato di prima classe.** Orari, durate e affollamento guidano le decisioni:
   ogni tappa risponde a "posso andarci adesso e conviene?".
2. **La mappa e la lista sono la stessa cosa.** Ordine delle tappe, percorso e timeline sono
   viste dello stesso itinerario; manipolarne una aggiorna le altre.
3. **Onestà del dato.** Distinguere sempre dato certo (orari Google) da dato stimato
   (affollamento) e da dato crowdsourced con freschezza (prezzi).
4. **Collaborazione senza attrito.** Condividere un itinerario e contribuire deve essere
   leggero; il valore cresce col gruppo.
5. **Pronta al viaggio reale.** Leggibile con una mano, al sole, di fretta; gli stati di
   errore/offline non bloccano la consultazione.

## Accessibility & Inclusion

Contrasto adeguato (usabile all'aperto), tap target ≥ 44pt, label per screen reader,
rispetto di Dynamic Type / font scaling. Nessun requisito normativo specifico dichiarato.

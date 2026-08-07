# Design — MyMappa

<!-- impeccable:design-schema 1 -->

## Contratto di direzione

**THESIS.** MyMappa è un sistema di *segnaletica di viaggio*: il percorso ordinato di tappe —
il meccanismo stesso del prodotto — diventa il linguaggio visivo. Rifiuta la mappa-con-spilli
generica e l'estetica "app di viaggio blu/teal + card tutte uguali".

**OWN-WORLD.** Fondo neutro e spazioso (quasi-bianco di giorno, ink profondo di notte) percorso
da una **linea-percorso indaco elettrico** con fermate (dot) — la firma è il `RouteStrip`.
Accento di brand "route" (`#3A31E0` / dark `#8F87FF`) su azioni, marker e linee, tenuto
**distinto** dalla scala di stato verde→ambra→rosso (aperto/affollamento). Titoli in **Archivo**
(grottesco geometrico da segnaletica); UI e orari in font di sistema con cifre tabellari.
Badge e chip come **legenda** di una rete di trasporti.

**STORY.** L'utente apre la lista, riconosce ogni itinerario dalla sua linea-percorso, entra,
legge le tappe come fermate con orari e stato, e agisce ("aggiungi", "ottimizza") con un'azione
primaria sempre evidente.

**FIRST VIEWPORT (home).** Titolo display "I tuoi itinerari" in alto a sinistra, conteggio
sotto; lista di card ciascuna con `RouteStrip` a sinistra e titolo+badge a destra; FAB
"Crea itinerario" in basso a destra. Vuoto → empty state illustrato con medaglione + CTA.

**FORM.** Mode **Operate** (native-first: HIG + Material). Piattaforma `adaptive`. Colore:
*Committed accent* (neutro + un indaco deciso). Luce: *light-first* (uso all'aperto) con dark
di prima classe.

## Regole di sistema durevoli

- **Token = fonte di verità.** Colori semantici in `src/ui/theme/palette.ts` (JS) rispecchiati
  come variabili CSS in `src/global.css` (NativeWind). Spacing/raggi/tipografia/ombre in
  `src/ui/theme/tokens.ts`. Nessun colore/misura hardcoded nei componenti.
- **Accento ≠ stato.** L'indaco di brand non è mai usato per comunicare stato; verde/ambra/rosso
  sono riservati a apertura e affollamento, così il significato non collide col brand.
- **Tipografia per ruoli.** Solo tramite `<Text variant>`; display = Archivo, resto = sistema.
  Orari e importi con `tabular`. Rispettare Dynamic Type / font scaling.
- **Profondità reale.** Ombre con offset + blur (token `elevation`), mai aloni a offset zero;
  su Android via `elevation` (elevazione tonale).
- **Native affordances.** Tab bar per le sezioni, sheet per sotto-task, Back di sistema sempre
  attivo, tap target ≥ 48, safe-area/edge-to-edge rispettati.
- **Card non annidate.** La `Card` è il contenitore; niente card dentro card.
- **Onestà del dato.** L'affollamento è sempre etichettato "stimato"; il prezzo mostra la
  freschezza.
- **Dark e light entrambi di prima classe**, testati.
- **Contrasto ≥ 4.5:1 anche per il testo piccolo.** Vale per didascalie, placeholder e
  etichette di categoria, non solo per il corpo. Da qui due conseguenze durature: il
  terziario è più scuro/chiaro di quanto sembri necessario, e i **colori-linea delle
  categorie hanno un set per tema** (`categoryPalettes`) — un colore solo non può essere
  leggibile su bianco e su ink. Sopra la mappa si usa sempre il set chiaro
  (`mapCategoryColor`): lì il fondo è la tile di OSM, chiara in entrambi i temi.
- **La profondità esiste anche sul web.** I token `elevation` hanno un ramo `web`
  (`boxShadow`): l'anteprima è la superficie di validazione del progetto e non deve
  risultare piatta.
- **Focus da tastiera sempre visibile.** Sul web lo disegna `:focus-visible` in
  `global.css` (react-native-web non ne fornisce uno).
- **Motion = un mezzo che arriva a una fermata.** Entrata decisa con decelerazione, uscita
  più rapida dell'entrata, mai rimbalzi. **Un solo momento d'autore per superficie**; tutto
  il resto è feedback breve. Ogni animazione rispetta *Riduci movimento*
  (`useReducedMotion`). Sui fogli e sulle transizioni web si usa `Animated` di React Native,
  non Reanimated (vedi HANDOFF §7).

## Superfici e momenti d'autore

| Superficie | Momento d'autore |
|---|---|
| Condividi (Fase 4) | **L'arrivo del QR**: il codice si posa quando il foglio è già fermo. È l'istante in cui l'itinerario esce dal telefono; nient'altro nel foglio si muove. |
| Timeline (Fase 3) | Le righe che scivolano al nuovo posto durante il riordino. |

## Da rivedere nelle fasi successive

- Curve/indicatori di affollamento: visualizzazione del dato stimato, da approfondire.
- **Marchio provvisorio.** Icona, splash e favicon sono generati da
  `scripts/generate-brand-assets.mjs` a partire dal motivo della linea-percorso (fermata
  piena → percorso → fermata d'arrivo) e dai token colore: `npm run assets:brand` li
  rigenera. Coerente col mondo visivo, ma **non è un logo disegnato**: da sostituire con
  l'asset vero quando ci sarà.
- Hover sul web: non implementato di proposito (l'app è native-first, il web è la superficie
  di validazione). Se il web diventasse un target di spedizione, va progettato.
- Esplora: oggi è un segnaposto dichiarato; la superficie va progettata quando la fase
  arriva.

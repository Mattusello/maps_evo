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

## Da rivedere nelle fasi successive

- Marker di mappa e colori-linea per categoria (Fase 2): usare `categoryColors`.
- Curve/indicatori di affollamento (Fase 2–3): visualizzazione del dato stimato.
- Motion orchestrata su transizioni sheet e riordino drag & drop: prima passata fatta in Fase 3
  (entrata dei fogli, righe che scivolano nel riordino). Da rifinire in Fase 4.
- Asset di brand reali (icona app, splash): ora placeholder del template, da sostituire.

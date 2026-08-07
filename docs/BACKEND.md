# MyMappa — Contratto del backend (Laravel)

Questo documento è il **contratto** tra l'app e il backend: chi implementa il server ha qui
tutto ciò che il client si aspetta, senza dover leggere il codice dell'app. Il client di
questa fase è già scritto e testato contro questo contratto (`src/core/sync`, `src/core/api`).

- **Stack previsto:** Laravel 11+, autenticazione **Sanctum** (personal access token), database
  relazionale (MySQL/PostgreSQL).
- **Formato:** JSON, `Accept: application/json`, corpo `application/json`.
- **Fuso e date:** sempre **UTC in ISO 8601 con millisecondi** (`2026-09-12T08:30:00.000Z`).
  Il client confronta le date come stringhe: il formato deve essere stabile.
- **Nomi dei campi:** **camelCase**, identici ai modelli del client (`src/core/models`). Il
  server usa API Resource per convertire da snake_case del database; così il client non ha
  nessun layer di mappatura e i modelli zod validano la risposta così com'è.

---

## 1. Principio architetturale: l'app è locale, il server è la copia condivisa

La sorgente di verità della UI resta il **dispositivo**: l'app si apre, si legge e si modifica
anche senza rete (è un'app da viaggio, vedi `PRODUCT.md`). Il server serve a **conservare** e a
**condividere** con i collaboratori.

Conseguenze vincolanti per chi implementa il server:

1. **Gli id li genera il client.** Ogni entità arriva con il proprio UUID v4 già assegnato: la
   chiave primaria è quella. Il server non deve rigenerarla né restituirne un'altra, altrimenti
   il dispositivo non ritrova più le proprie righe.
2. **Niente cancellazioni vere.** La cancellazione è `deletedAt` valorizzato (soft delete): un
   record eliminato deve continuare a comparire nel *pull*, altrimenti gli altri dispositivi non
   sanno che è sparito.
3. **`updatedAt` è l'orologio del merge.** Ogni scrittura lo aggiorna; è il campo su cui si
   decidono i conflitti (§5).
4. **Le operazioni si ripetono.** Senza rete il client riprova: ogni operazione porta un id e il
   server deve essere **idempotente** su quell'id (§4.1).

---

## 2. Autenticazione (Sanctum)

Token personali, non cookie di sessione: l'app è nativa. Il token viaggia nell'header
`Authorization: Bearer <token>` ed è conservato sul dispositivo
(`src/core/api/tokenStore.ts`).

| Metodo | Endpoint | Corpo | Risposta |
|---|---|---|---|
| POST | `/api/auth/register` | `{ displayName, email, password }` | `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password, deviceName }` | `{ token, user }` |
| POST | `/api/auth/logout` | — | `204` |
| GET | `/api/auth/me` | — | `{ user }` |

```json
// user
{ "id": "9f1c…", "displayName": "Marta", "email": "marta@example.com" }
```

- `deviceName` serve a Sanctum per nominare il token (`createToken($deviceName)`), così l'utente
  può revocare un singolo dispositivo.
- **`user.id` è un UUID**, non un intero autoincrementale: finisce dentro `ownerId` e
  `collaborators[].userId` degli itinerari, che viaggiano tra dispositivi.
- Al `401` il client **cancella il token locale** e torna allo stato "non autenticato" senza
  perdere i dati locali.

---

## 3. Entità e tabelle

I campi sono quelli di `src/core/models` (schemi zod: sono la specifica esatta dei tipi).
Tutte le entità condividono: `id` (UUID, PK), `createdAt`, `updatedAt`, `deletedAt` (nullable).

`syncStatus` **non viaggia**: è uno stato locale del client (`local | pending | synced |
conflict`). Il server lo ignora se lo riceve e non lo restituisce mai.

### itineraries
| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid | PK, generato dal client |
| `title` | string | obbligatorio |
| `description` | string? | |
| `coverImage` | string? | |
| `ownerId` | uuid | utente proprietario |
| `collaborators` | array | `[{ userId, displayName?, role }]`, `role ∈ owner\|editor\|viewer` |
| `currency` | enum | `EUR\|USD\|GBP\|CHF\|JPY` |
| `partySize` | int ≥ 1 | |
| `dayIds` | uuid[] | **ordine dei giorni**: è un dato, non una vista |

`collaborators` è una tabella pivot (`itinerary_user` con `role`); la risposta la serializza
come array. `dayIds` si può derivare da una colonna `position` sui giorni, ma la risposta deve
comunque contenerlo: per il client l'ordine è esplicito.

### days
| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid | PK |
| `itineraryId` | uuid | FK |
| `date` | string? | `YYYY-MM-DD`, senza ora |
| `label` | string? | |
| `orderedStopIds` | uuid[] | ordine delle tappe |

### stops
| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid | PK |
| `dayId` | uuid | FK |
| `poiRef` | string? | id del POI del provider |
| `title` | string | |
| `category` | enum | `cultura\|cibo\|natura\|panorama\|shopping\|notte\|alloggio\|trasporto\|altro` |
| `location` | `{lat, lng}` | due colonne decimali, serializzate come oggetto |
| `plannedArrival` | string? | `HH:MM` **locale della tappa**, non un istante UTC |
| `plannedDurationMin` | int? > 0 | |
| `notes` | string? | |
| `cost` | `{amount, currency}`? | **a persona** |
| `bookingUrl` | string? | URL valido |
| `order` | int ≥ 0 | ridondante con `orderedStopIds`, ma comodo |

### price_reports
| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid | PK |
| `stopId` | uuid? | |
| `placeId` | string? | id del POI (OSM/Google) |
| `price` | `{amount, currency}` | |
| `label` | string? | cosa rappresenta il prezzo |
| `reportedBy` | string | id utente |
| `upvotes` / `downvotes` | int ≥ 0 | |

I prezzi sono **crowdsourced e condivisi**: a differenza delle altre entità non appartengono a
un itinerario, e in lettura vanno serviti a chiunque per `stopId`/`placeId`.

### Autorizzazioni

| Ruolo | Legge | Modifica tappe/giorni | Modifica itinerario | Elimina itinerario | Gestisce collaboratori |
|---|---|---|---|---|---|
| `owner` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `editor` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `viewer` | ✅ | ❌ | ❌ | ❌ | ❌ |

Da implementare con Policy (`ItineraryPolicy`), non con controlli sparsi nei controller. Una
scrittura non autorizzata risponde **403** e il client la scarta senza riprovare (§4.2).

---

## 4. Sincronizzazione

Due endpoint, uno per direzione. Sono la superficie che il client usa davvero
(`src/core/sync/syncEngine.ts`).

### 4.1 Push — `POST /api/sync/push`

Il client svuota la propria coda locale (outbox) mandando le operazioni **nell'ordine in cui
sono state prodotte**.

```json
{
  "operations": [
    {
      "id": "3b2f…",                 // id dell'operazione: chiave di idempotenza
      "entityType": "stop",          // itinerary | day | stop | priceReport
      "entityId": "7c41…",
      "op": "create",                // create | update | delete
      "payload": { "id": "7c41…", "title": "Uffizi", "…": "…" },
      "createdAt": "2026-09-12T08:30:00.000Z"
    }
  ]
}
```

Risposta — **un risultato per operazione, nello stesso ordine**:

```json
{
  "results": [
    { "id": "3b2f…", "status": "applied",  "entity": { "…": "…" } },
    { "id": "9a77…", "status": "conflict", "entity": { "…": "…" } },
    { "id": "1d05…", "status": "rejected", "reason": "validation", "message": "…" }
  ],
  "serverTime": "2026-09-12T08:30:02.000Z"
}
```

| `status` | Significato | Cosa fa il client |
|---|---|---|
| `applied` | scritta accettata | rimuove l'operazione dalla coda, marca l'entità `synced` |
| `conflict` | il server aveva una versione più recente | rimuove l'operazione, **sovrascrive con `entity`** e marca l'entità `conflict` |
| `rejected` | operazione non applicabile (validazione, permessi, entità inesistente) | rimuove l'operazione e **non riprova**: riprovare all'infinito bloccherebbe la coda |

Regole per il server:

- **Idempotenza:** conservare gli `id` delle operazioni già applicate (tabella
  `sync_operations` con `id` PK e TTL, per esempio 30 giorni). Un `id` già visto risponde
  `applied` senza riapplicare nulla.
- **Atomicità per operazione**, non per batch: se la terza fallisce, le prime due restano.
- **`create` di un id già esistente** = `update` (il client può aver perso la risposta e
  riprovato con un id di operazione nuovo).
- **`delete`** valorizza `deletedAt`, non cancella la riga.
- **Batch massimo 200 operazioni**: oltre, rispondere `413`. Il client spezza da solo in
  blocchi da 100.
- Un errore di rete o un `5xx` **non è un rifiuto**: il client tiene la coda e riprova più
  tardi (backoff), quindi il server non deve "consumare" nulla in caso di errore.

### 4.2 Pull — `GET /api/sync/pull?since=<ISO>&limit=<n>`

Restituisce tutto ciò che è cambiato **dopo** `since` (escluso), ordinato per `updatedAt`
crescente. Senza `since` è la prima sincronizzazione: restituisce tutto ciò che l'utente può
vedere.

```json
{
  "itineraries": [ { "…": "…" } ],
  "days":        [ { "…": "…" } ],
  "stops":       [ { "…": "…" } ],
  "priceReports":[ { "…": "…" } ],
  "serverTime":  "2026-09-12T08:30:02.000Z",
  "nextSince":   "2026-09-12T08:29:55.000Z",
  "hasMore":     false
}
```

- Include **anche le entità cancellate** (con `deletedAt` valorizzato): sono le lapidi che
  propagano la cancellazione agli altri dispositivi.
- `nextSince` è l'`updatedAt` dell'ultimo elemento restituito: il client lo rimanda al giro
  successivo. Con `hasMore: true` il client richiama subito.
- **Non usare `serverTime` come nuovo `since`** quando `hasMore` è vero: si perderebbero le
  righe non ancora restituite. Il client segue `nextSince`.
- `limit` predefinito 500, massimo 1000.

### 4.3 Conflitti: ultima scrittura vince, ma dichiarata

La regola v1 è **last-write-wins per entità**, confrontando `updatedAt`:

- se l'`updatedAt` in arrivo è **più recente** di quello sul server → si applica;
- se è **più vecchio o uguale** → il server risponde `conflict` e allega la propria versione.

Il client sovrascrive il locale con la versione del server e marca l'entità `conflict`, così la
UI può dire che qualcosa è stato sovrascritto invece di far sparire il lavoro in silenzio.

È una regola volutamente semplice, ed è una **scelta, non una svista**: una fusione campo per
campo (o CRDT) va decisa quando la collaborazione in tempo reale sarà davvero il caso d'uso.
Fino ad allora l'unità di conflitto è l'entità.

---

## 5. Endpoint REST per risorsa (modalità "solo online")

Oltre alla sincronizzazione, il client ha un repository che parla direttamente REST
(`ApiItineraryRepository`), utile per debug, strumenti interni o un eventuale client web.
Sono già cablati questi percorsi:

| Metodo | Endpoint | Note |
|---|---|---|
| GET | `/api/itineraries` | lista dell'utente (proprie + condivise) |
| GET | `/api/itineraries/{id}` | aggregato completo: itinerario + giorni + tappe |
| POST | `/api/itineraries` | corpo: `{ title, description?, currency, partySize, ownerId }` |
| PATCH | `/api/itineraries/{id}` | campi modificabili, incluso `collaborators` |
| DELETE | `/api/itineraries/{id}` | soft delete |
| POST | `/api/itineraries/{id}/days` | `{ date?, label? }` |
| PATCH | `/api/days/{id}` | |
| DELETE | `/api/days/{id}` | elimina anche le tappe del giorno |
| PUT | `/api/itineraries/{id}/days/order` | `{ orderedDayIds }` |
| POST | `/api/days/{id}/stops` | corpo = tappa senza `id`/timestamp |
| PATCH | `/api/stops/{id}` | |
| DELETE | `/api/stops/{id}` | |
| PUT | `/api/days/{id}/stops/order` | `{ orderedStopIds }` |
| PUT | `/api/stops/{id}/move` | `{ targetDayId, targetIndex }` |
| GET | `/api/itineraries/{id}/export` | aggregato completo (condivisione) |
| POST | `/api/itineraries/import` | aggregato + `ownerId`; il server **rigenera gli id** |

Prezzi crowdsourced:

| Metodo | Endpoint | Note |
|---|---|---|
| GET | `/api/price-reports?stopId=…&placeId=…` | almeno uno dei due parametri |
| POST | `/api/price-reports` | `{ stopId?, placeId?, price, label?, reportedBy }` |
| POST | `/api/price-reports/{id}/vote` | `{ delta: 1 \| -1 }` |

---

## 6. Errori

Formato unico, quello standard di Laravel:

```json
{ "message": "Il titolo è obbligatorio.", "errors": { "title": ["Il titolo è obbligatorio."] } }
```

| Codice | Quando | Comportamento del client |
|---|---|---|
| 401 | token assente, scaduto o revocato | cancella il token, torna non autenticato, **tiene i dati locali** |
| 403 | ruolo insufficiente | operazione scartata, non riprovata |
| 404 | entità inesistente | operazione scartata |
| 409 | conflitto (solo REST per risorsa; nel push si usa `status: conflict`) | ricarica |
| 413 | batch troppo grande | spezza e riprova |
| 422 | validazione | operazione scartata, messaggio mostrato |
| 429 | rate limit | attende `Retry-After` e riprova |
| 5xx / rete | server o connessione | **coda intatta**, riprova con backoff |

Rate limit consigliato: `60/min` per utente sulle rotte REST, `20/min` su `/api/sync/*` (i
batch sono già raggruppati).

---

## 7. Implementazione lato Laravel — promemoria

Migrazioni: chiavi primarie `uuid` (`$table->uuid('id')->primary()`), `softDeletes()`,
`timestamps()`. Sui giorni e sulle tappe una colonna `position` per l'ordine.

```php
Schema::create('stops', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('day_id')->constrained()->cascadeOnDelete();
    $table->string('title');
    $table->string('category');
    $table->decimal('lat', 10, 7);
    $table->decimal('lng', 10, 7);
    $table->string('planned_arrival', 5)->nullable();   // "HH:MM"
    $table->unsignedSmallInteger('planned_duration_min')->nullable();
    $table->decimal('cost_amount', 10, 2)->nullable();
    $table->string('cost_currency', 3)->nullable();
    $table->unsignedSmallInteger('position')->default(0);
    $table->timestamps();
    $table->softDeletes();
    $table->index(['day_id', 'position']);
    $table->index('updated_at');   // il pull filtra e ordina su questo
});
```

Punti da non sbagliare:

- `HasUuids` sui model **senza** rigenerare l'id quando arriva dal client.
- `updated_at` gestito a mano nel push quando si applica il payload del client: il valore che
  conta per il merge è quello del server al momento della scrittura, e va restituito.
- Indice su `updated_at` per tabella: il pull è una query per intervallo.
- API Resource per il camelCase; un solo posto che decide la forma della risposta.
- Test di sicurezza: un `viewer` non deve poter scrivere; un utente non collaboratore non deve
  vedere l'itinerario nemmeno via `/api/sync/pull`.

## 8. Come il client si aggancia

```bash
# .env dell'app
EXPO_PUBLIC_API_URL=https://api.mymappa.app
EXPO_PUBLIC_USE_API=true
```

| Cosa | Dove |
|---|---|
| Client HTTP, token, mappatura errori | `src/core/api/apiClient.ts`, `src/core/api/tokenStore.ts` |
| Login/registrazione | `src/core/repositories/api/ApiAuthRepository.ts` |
| Motore di sincronizzazione | `src/core/sync/syncEngine.ts` |
| Trasporto (push/pull) | `src/core/sync/contracts.ts`, `src/core/sync/ApiSyncTransport.ts` |
| Coda locale | `src/core/sync/outbox.ts` |
| Stato in UI | `src/context/SyncContext.tsx`, sezione in Impostazioni |

I test del client (`syncEngine.test.ts`) girano contro un trasporto finto che rispetta questo
contratto: sono la specifica eseguibile di §4.

/**
 * SyncEngine — porta le modifiche locali sul server e riporta quelle del server in locale.
 *
 * ## L'idea
 * L'app resta **locale**: la UI legge e scrive sul dispositivo e non aspetta mai la rete
 * (è un'app da viaggio). Questo motore lavora di lato, in due tempi:
 *
 * 1. **push** — svuota l'outbox in ordine di inserimento. Una voce esce dalla coda solo se il
 *    server ha detto qualcosa su di lei; se cade la rete la coda resta intatta e si riprova.
 * 2. **pull** — chiede cosa è cambiato dopo l'ultimo cursore e lo scrive nelle stesse
 *    collezioni che usa il repository locale.
 *
 * ## Conflitti
 * Regola v1, dichiarata in `docs/BACKEND.md` §4.3: **vince l'ultima scrittura**, confrontando
 * `updatedAt`. Quando è il server a vincere su una modifica locale non ancora inviata, il
 * locale viene sovrascritto e l'entità marcata `conflict`: la UI può dire che qualcosa è
 * stato sovrascritto invece di far sparire il lavoro in silenzio.
 *
 * ## Cosa questo motore non fa
 * Non fonde campo per campo (l'unità di conflitto è l'entità) e non ha un proprio timer: chi
 * decide *quando* sincronizzare è `SyncContext`.
 */
import {
  daySchema,
  itinerarySchema,
  priceReportSchema,
  stopSchema,
  type BaseEntity,
  type Day,
  type Itinerary,
  type PriceReport,
  type Stop,
} from '../models';
import { LocalCollections } from '../repositories/local/collections';
import { asyncStorageStore, STORAGE_KEYS, type KeyValueStore } from '../storage/keyValueStore';
import { nowIso } from '../utils/time';
import { Outbox } from './outbox';
import {
  pullResponseSchema,
  pushResponseSchema,
  type PushOperation,
  type SyncReport,
  type SyncState,
  type SyncTransport,
} from './contracts';

/** Quante operazioni per richiesta (il contratto ne ammette 200: restiamo sotto). */
const PUSH_CHUNK = 100;

/** Limite di giri del pull: una paginazione impazzita non deve diventare un ciclo infinito. */
const MAX_PULL_PAGES = 20;

const EMPTY_STATE: SyncState = { lastSyncAt: null, since: null };

type EntityKind = 'itinerary' | 'day' | 'stop' | 'priceReport';

export class SyncEngine {
  /** Sincronizzazione in corso: le chiamate concorrenti aspettano la stessa, non ne avviano un'altra. */
  private running: Promise<SyncReport> | null = null;

  constructor(
    private transport: SyncTransport,
    private collections: LocalCollections = new LocalCollections(),
    private outbox: Outbox = new Outbox(),
    private store: KeyValueStore = asyncStorageStore
  ) {}

  async getState(): Promise<SyncState> {
    return (await this.store.getJSON<SyncState>(STORAGE_KEYS.syncState)) ?? EMPTY_STATE;
  }

  private saveState(state: SyncState): Promise<void> {
    return this.store.setJSON(STORAGE_KEYS.syncState, state);
  }

  /** Azzera il cursore: la prossima sincronizzazione riparte da capo (utile dopo un logout). */
  async reset(): Promise<void> {
    await this.saveState(EMPTY_STATE);
  }

  /**
   * Un giro completo: prima manda, poi riceve. Mandare per primo evita che il pull
   * sovrascriva modifiche locali che il server non ha ancora visto.
   */
  sync(): Promise<SyncReport> {
    if (this.running) return this.running;
    this.running = this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<SyncReport> {
    const report: SyncReport = {
      pushed: 0,
      conflicts: 0,
      rejected: 0,
      pulled: 0,
      skipped: 0,
      pending: 0,
    };

    try {
      await this.push(report);
      await this.pull(report);
      await this.saveState({ ...(await this.getState()), lastSyncAt: nowIso() });
    } catch (e) {
      // Rete assente o server in errore: non è un fallimento dell'utente e non si perde nulla.
      report.error = e instanceof Error ? e.message : 'Sincronizzazione non riuscita';
    }

    report.pending = await this.outbox.count();
    return report;
  }

  // --- Push ---

  private async push(report: SyncReport): Promise<void> {
    const entries = await this.outbox.list();
    if (entries.length === 0) return;

    for (let i = 0; i < entries.length; i += PUSH_CHUNK) {
      const chunk = entries.slice(i, i + PUSH_CHUNK);
      const operations: PushOperation[] = chunk.map((entry) => ({
        id: entry.id,
        entityType: entry.entityType,
        entityId: entry.entityId,
        op: entry.op,
        payload: entry.payload,
        createdAt: entry.createdAt,
      }));

      // Un errore qui interrompe il push: le voci non ancora inviate restano in coda.
      const response = pushResponseSchema.parse(await this.transport.push(operations));
      const byId = new Map(response.results.map((r) => [r.id, r]));
      const handled: string[] = [];

      for (const entry of chunk) {
        const result = byId.get(entry.id);
        // Nessun esito per questa voce: la teniamo in coda e riproviamo al giro dopo.
        if (!result) continue;
        handled.push(entry.id);

        if (result.status === 'applied') {
          report.pushed += 1;
          await this.markSynced(entry.entityType, entry.entityId, entry.payload);
        } else if (result.status === 'conflict') {
          report.conflicts += 1;
          if (result.entity) await this.applyEntity(entry.entityType, result.entity, 'conflict');
        } else {
          report.rejected += 1;
        }
      }

      await this.outbox.remove(handled);
    }
  }

  /**
   * Marca l'entità come sincronizzata — ma solo se nel frattempo non è cambiata ancora:
   * se l'utente l'ha modificata dopo aver messo in coda l'operazione, resta `pending`,
   * altrimenti quella modifica sembrerebbe già salvata sul server.
   */
  private async markSynced(kind: EntityKind, entityId: string, payload: unknown): Promise<void> {
    const sentUpdatedAt =
      payload && typeof payload === 'object' && 'updatedAt' in payload
        ? (payload as { updatedAt?: unknown }).updatedAt
        : undefined;

    await this.updateCollection(kind, (list) =>
      list.map((entity) =>
        entity.id === entityId &&
        entity.syncStatus === 'pending' &&
        (sentUpdatedAt === undefined || entity.updatedAt === sentUpdatedAt)
          ? { ...entity, syncStatus: 'synced' as const }
          : entity
      )
    );
  }

  // --- Pull ---

  private async pull(report: SyncReport): Promise<void> {
    let state = await this.getState();

    for (let page = 0; page < MAX_PULL_PAGES; page += 1) {
      const response = pullResponseSchema.parse(await this.transport.pull({ since: state.since }));

      await this.applyIncoming('itinerary', response.itineraries, report);
      await this.applyIncoming('day', response.days, report);
      await this.applyIncoming('stop', response.stops, report);
      await this.applyIncoming('priceReport', response.priceReports, report);

      // Il cursore avanza solo con `nextSince`: usare `serverTime` con `hasMore` attivo
      // salterebbe le righe non ancora restituite (docs/BACKEND.md §4.2).
      if (response.nextSince) {
        state = { ...state, since: response.nextSince };
        await this.saveState(state);
      }
      if (!response.hasMore) return;
      if (!response.nextSince) return; // paginazione senza cursore: meglio fermarsi
    }
  }

  private async applyIncoming(
    kind: EntityKind,
    incoming: unknown[],
    report: SyncReport
  ): Promise<void> {
    for (const raw of incoming) {
      const parsed = this.parseEntity(kind, raw);
      if (!parsed) {
        // Una riga illeggibile non deve far fallire l'intera sincronizzazione.
        report.skipped += 1;
        continue;
      }
      const applied = await this.applyEntity(kind, parsed, 'synced');
      if (applied === 'conflict') report.conflicts += 1;
      if (applied !== 'ignored') report.pulled += 1;
    }
  }

  private parseEntity(kind: EntityKind, raw: unknown): BaseEntity | null {
    const schema =
      kind === 'itinerary'
        ? itinerarySchema
        : kind === 'day'
          ? daySchema
          : kind === 'stop'
            ? stopSchema
            : priceReportSchema;
    const result = schema.safeParse(raw);
    // Lo stato di sync è locale: quello che dice il server (se lo dice) non conta.
    return result.success ? (result.data as BaseEntity) : null;
  }

  /**
   * Scrive un'entità arrivata dal server, applicando la regola dei conflitti.
   * Restituisce cosa è successo, così il riepilogo può dirlo alla UI.
   */
  private async applyEntity(
    kind: EntityKind,
    raw: unknown,
    incomingStatus: 'synced' | 'conflict'
  ): Promise<'written' | 'conflict' | 'ignored'> {
    const entity = this.parseEntity(kind, raw);
    if (!entity) return 'ignored';

    let outcome: 'written' | 'conflict' | 'ignored' = 'written';

    await this.updateCollection(kind, (list) => {
      const index = list.findIndex((e) => e.id === entity.id);
      if (index === -1) {
        return [...list, { ...entity, syncStatus: incomingStatus }];
      }

      const local = list[index];
      const localIsNewer = local.updatedAt > entity.updatedAt;

      if (local.syncStatus === 'pending' && localIsNewer) {
        // La modifica locale è più recente: resta, e partirà al prossimo push.
        outcome = 'ignored';
        return list;
      }

      // Una modifica locale non ancora inviata viene sovrascritta: va detto.
      const overwritingLocalWork = local.syncStatus === 'pending';
      outcome = overwritingLocalWork || incomingStatus === 'conflict' ? 'conflict' : 'written';

      const next = [...list];
      next[index] = { ...entity, syncStatus: outcome === 'conflict' ? 'conflict' : 'synced' };
      return next;
    });

    return outcome;
  }

  /**
   * Legge, trasforma e riscrive una collezione.
   *
   * La trasformazione lavora sui campi comuni (`BaseEntity`), quindi in uscita serve una
   * conversione: è sicura perché le entità scritte sono state validate poco prima con lo
   * schema **di quello stesso `kind`** (`parseEntity`), e le entità già presenti arrivano
   * dalla collezione stessa.
   */
  private async updateCollection(
    kind: EntityKind,
    transform: (list: BaseEntity[]) => BaseEntity[]
  ): Promise<void> {
    switch (kind) {
      case 'itinerary': {
        const list = await this.collections.loadItineraries();
        await this.collections.saveItineraries(transform(list) as Itinerary[]);
        return;
      }
      case 'day': {
        const list = await this.collections.loadDays();
        await this.collections.saveDays(transform(list) as Day[]);
        return;
      }
      case 'stop': {
        const list = await this.collections.loadStops();
        await this.collections.saveStops(transform(list) as Stop[]);
        return;
      }
      case 'priceReport': {
        const list = await this.collections.loadPriceReports();
        await this.collections.savePriceReports(transform(list) as PriceReport[]);
        return;
      }
    }
  }
}

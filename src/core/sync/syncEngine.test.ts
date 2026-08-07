/**
 * Il motore di sincronizzazione provato contro un trasporto finto che rispetta
 * `docs/BACKEND.md` §4: questi test sono la specifica eseguibile del protocollo, e sono
 * l'unica verifica possibile finché il backend non esiste.
 */
import { beforeEach, describe, expect, it } from '@jest/globals';

import { SyncEngine } from './syncEngine';
import { Outbox } from './outbox';
import type { PullResponse, PushOperation, PushResponse, SyncTransport } from './contracts';
import type { Itinerary, Stop } from '../models';
import { LocalCollections } from '../repositories/local/collections';
import { LocalItineraryRepository } from '../repositories/local/LocalItineraryRepository';
import type { KeyValueStore } from '../storage/keyValueStore';
import { createMemoryStore } from '@/test/memoryStore';

/** Trasporto programmabile: ogni test decide cosa risponde il server. */
class FakeTransport implements SyncTransport {
  pushCalls: PushOperation[][] = [];
  pullCalls: { since: string | null }[] = [];

  constructor(
    private onPush: (operations: PushOperation[]) => Promise<PushResponse> | PushResponse = (ops) => ({
      results: ops.map((o) => ({ id: o.id, status: 'applied' as const })),
    }),
    private pullPages: PullResponse[] = [emptyPull()]
  ) {}

  async push(operations: PushOperation[]): Promise<PushResponse> {
    this.pushCalls.push(operations);
    return this.onPush(operations);
  }

  async pull(params: { since: string | null }): Promise<PullResponse> {
    this.pullCalls.push({ since: params.since });
    const page = this.pullPages[Math.min(this.pullCalls.length - 1, this.pullPages.length - 1)];
    return page;
  }
}

function emptyPull(extra: Partial<PullResponse> = {}): PullResponse {
  return {
    itineraries: [],
    days: [],
    stops: [],
    priceReports: [],
    serverTime: '2026-09-12T10:00:00.000Z',
    ...extra,
  };
}

type Harness = {
  store: KeyValueStore;
  repo: LocalItineraryRepository;
  outbox: Outbox;
  collections: LocalCollections;
  engine: (transport: SyncTransport) => SyncEngine;
};

function harness(): Harness {
  const store = createMemoryStore();
  const outbox = new Outbox(store);
  const collections = new LocalCollections(store);
  const repo = new LocalItineraryRepository(store, outbox, collections);
  return {
    store,
    repo,
    outbox,
    collections,
    engine: (transport: SyncTransport) => new SyncEngine(transport, collections, outbox, store),
  };
}

/**
 * Un itinerario con un giorno e una tappa. Sono **cinque** voci in coda, non tre: creare
 * un giorno cambia anche l'ordine dei giorni dell'itinerario, e creare una tappa cambia
 * l'ordine delle tappe del giorno.
 */
async function seed(h: Harness) {
  const itinerary = await h.repo.create({ title: 'Roma', currency: 'EUR', partySize: 2 }, 'user-1');
  const day = await h.repo.addDay(itinerary.id, { label: 'Giorno 1' });
  const stop = await h.repo.addStop(day.id, {
    title: 'Colosseo',
    category: 'cultura',
    location: { lat: 41.8902, lng: 12.4922 },
  });
  return { itinerary, day, stop };
}

describe('SyncEngine — push', () => {
  it('manda le operazioni in ordine, svuota la coda e marca le entità sincronizzate', async () => {
    const h = harness();
    const { itinerary } = await seed(h);
    const transport = new FakeTransport();

    const report = await h.engine(transport).sync();

    expect(transport.pushCalls).toHaveLength(1);
    expect(transport.pushCalls[0].map((o) => [o.entityType, o.op].join(':'))).toEqual([
      'itinerary:create',
      'day:create',
      'itinerary:update',
      'stop:create',
      'day:update',
    ]);
    expect(report.pushed).toBe(5);
    expect(report.pending).toBe(0);
    expect(await h.outbox.list()).toEqual([]);

    const stored = (await h.collections.loadItineraries()).find((i) => i.id === itinerary.id);
    expect(stored?.syncStatus).toBe('synced');
  });

  it('lascia `pending` ciò che l’utente ha modificato dopo aver messo in coda', async () => {
    const h = harness();
    const { itinerary } = await seed(h);

    // Il server accetta, ma nel frattempo l'utente rinomina l'itinerario.
    // La pausa serve a far cadere la modifica in un millisecondo diverso: `updatedAt` è la
    // sola cosa che distingue "già mandato" da "modificato dopo".
    const transport = new FakeTransport(async (ops) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await h.repo.update(itinerary.id, { title: 'Roma in tre giorni' });
      return { results: ops.map((o) => ({ id: o.id, status: 'applied' as const })) };
    });

    await h.engine(transport).sync();

    const stored = (await h.collections.loadItineraries()).find((i) => i.id === itinerary.id);
    expect(stored?.title).toBe('Roma in tre giorni');
    // La modifica nuova non è ancora sul server: deve restare da mandare.
    expect(stored?.syncStatus).toBe('pending');
    expect(await h.outbox.count()).toBe(1);
  });

  it('in conflitto tiene la versione del server e lo dichiara', async () => {
    const h = harness();
    const { itinerary } = await seed(h);
    const serverVersion: Itinerary = {
      ...itinerary,
      title: 'Roma (versione del server)',
      updatedAt: '2099-01-01T00:00:00.000Z',
      syncStatus: 'synced',
    };

    const transport = new FakeTransport((ops) => ({
      results: ops.map((o) => ({
        id: o.id,
        status:
          o.entityType === 'itinerary' && o.op === 'create'
            ? ('conflict' as const)
            : ('applied' as const),
        entity: o.entityType === 'itinerary' && o.op === 'create' ? serverVersion : undefined,
      })),
    }));

    const report = await h.engine(transport).sync();

    expect(report.conflicts).toBe(1);
    const stored = (await h.collections.loadItineraries()).find((i) => i.id === itinerary.id);
    expect(stored?.title).toBe('Roma (versione del server)');
    expect(stored?.syncStatus).toBe('conflict');
    expect(await h.outbox.list()).toEqual([]);
  });

  it('scarta le operazioni rifiutate invece di riprovarle all’infinito', async () => {
    const h = harness();
    await seed(h);
    const transport = new FakeTransport((ops) => ({
      results: ops.map((o) => ({ id: o.id, status: 'rejected' as const, reason: 'validation' })),
    }));

    const report = await h.engine(transport).sync();

    expect(report.rejected).toBe(5);
    expect(report.pushed).toBe(0);
    expect(await h.outbox.list()).toEqual([]);
  });

  it('con la rete caduta tiene la coda intatta e lo dice nel riepilogo', async () => {
    const h = harness();
    await seed(h);
    const transport = new FakeTransport(() => {
      throw new Error('Network request failed');
    });

    const report = await h.engine(transport).sync();

    expect(report.error).toContain('Network');
    expect(report.pushed).toBe(0);
    expect(report.pending).toBe(5);
    expect(await h.outbox.count()).toBe(5);
  });

  it('tiene in coda le voci di cui il server non ha detto nulla', async () => {
    const h = harness();
    await seed(h);
    // Risposta parziale: esito solo per la prima operazione.
    const transport = new FakeTransport((ops) => ({
      results: [{ id: ops[0].id, status: 'applied' as const }],
    }));

    const report = await h.engine(transport).sync();

    expect(report.pushed).toBe(1);
    expect(await h.outbox.count()).toBe(4);
  });

  it('spezza le code lunghe in più richieste', async () => {
    const h = harness();
    const { day } = await seed(h);
    for (let i = 0; i < 120; i += 1) {
      await h.repo.addStop(day.id, {
        title: `Tappa ${i}`,
        category: 'altro',
        location: { lat: 41.9, lng: 12.5 },
      });
    }
    const transport = new FakeTransport();

    await h.engine(transport).sync();

    // 5 iniziali + 120 tappe × 2 operazioni (tappa + ordine del giorno) = 245.
    expect(transport.pushCalls.map((c) => c.length)).toEqual([100, 100, 45]);
    expect(await h.outbox.list()).toEqual([]);
  });

  it('non parte due volte insieme: le chiamate concorrenti condividono lo stesso giro', async () => {
    const h = harness();
    await seed(h);
    const transport = new FakeTransport();
    const engine = h.engine(transport);

    const [a, b] = await Promise.all([engine.sync(), engine.sync()]);

    expect(transport.pushCalls).toHaveLength(1);
    expect(a).toBe(b);
  });
});

describe('SyncEngine — pull', () => {
  /** Itinerario "che arriva dal server", con tutti i campi obbligatori. */
  function remoteItinerary(overrides: Partial<Itinerary> = {}): Itinerary {
    return {
      id: '00000000-0000-4000-8000-00000000e001',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-10T10:00:00.000Z',
      deletedAt: null,
      syncStatus: 'synced',
      title: 'Itinerario condiviso',
      ownerId: 'user-2',
      collaborators: [{ userId: 'user-2', role: 'owner' }],
      currency: 'EUR',
      partySize: 2,
      dayIds: [],
      ...overrides,
    };
  }

  it('scrive in locale ciò che arriva e avanza il cursore', async () => {
    const h = harness();
    const transport = new FakeTransport(undefined, [
      emptyPull({
        itineraries: [remoteItinerary()],
        nextSince: '2026-09-10T10:00:00.000Z',
      }),
    ]);
    const engine = h.engine(transport);

    const report = await engine.sync();

    expect(report.pulled).toBe(1);
    expect((await h.repo.list()).map((i) => i.title)).toEqual(['Itinerario condiviso']);
    expect((await engine.getState()).since).toBe('2026-09-10T10:00:00.000Z');
    expect((await engine.getState()).lastSyncAt).toBeTruthy();
  });

  it('propaga le cancellazioni fatte altrove', async () => {
    const h = harness();
    const engine = h.engine(
      new FakeTransport(undefined, [emptyPull({ itineraries: [remoteItinerary()] })])
    );
    await engine.sync();
    expect(await h.repo.list()).toHaveLength(1);

    const deleted = remoteItinerary({
      deletedAt: '2026-09-11T10:00:00.000Z',
      updatedAt: '2026-09-11T10:00:00.000Z',
    });
    const engine2 = h.engine(new FakeTransport(undefined, [emptyPull({ itineraries: [deleted] })]));
    await engine2.sync();

    expect(await h.repo.list()).toHaveLength(0);
  });

  it('non sovrascrive una modifica locale più recente non ancora inviata', async () => {
    const h = harness();
    const local = await h.repo.create({ title: 'Mio titolo', currency: 'EUR', partySize: 1 }, 'u');
    const older = remoteItinerary({
      id: local.id,
      title: 'Titolo vecchio del server',
      updatedAt: '2020-01-01T00:00:00.000Z',
    });

    const report = await h
      .engine(new FakeTransport(() => ({ results: [] }), [emptyPull({ itineraries: [older] })]))
      .sync();

    const stored = (await h.collections.loadItineraries()).find((i) => i.id === local.id);
    expect(stored?.title).toBe('Mio titolo');
    expect(stored?.syncStatus).toBe('pending');
    expect(report.pulled).toBe(0);
  });

  it('se il server è più recente sovrascrive, ma marca il conflitto', async () => {
    const h = harness();
    const local = await h.repo.create({ title: 'Mio titolo', currency: 'EUR', partySize: 1 }, 'u');
    const newer = remoteItinerary({
      id: local.id,
      title: 'Titolo del server',
      updatedAt: '2099-01-01T00:00:00.000Z',
    });

    const report = await h
      .engine(new FakeTransport(() => ({ results: [] }), [emptyPull({ itineraries: [newer] })]))
      .sync();

    const stored = (await h.collections.loadItineraries()).find((i) => i.id === local.id);
    expect(stored?.title).toBe('Titolo del server');
    expect(stored?.syncStatus).toBe('conflict');
    expect(report.conflicts).toBe(1);
  });

  it('segue la paginazione finché il server dice che c’è altro', async () => {
    const h = harness();
    const transport = new FakeTransport(undefined, [
      emptyPull({
        itineraries: [remoteItinerary()],
        nextSince: '2026-09-10T10:00:00.000Z',
        hasMore: true,
      }),
      emptyPull({
        itineraries: [
          remoteItinerary({
            id: '00000000-0000-4000-8000-00000000e002',
            title: 'Secondo',
            updatedAt: '2026-09-11T10:00:00.000Z',
          }),
        ],
        nextSince: '2026-09-11T10:00:00.000Z',
        hasMore: false,
      }),
    ]);
    const engine = h.engine(transport);

    const report = await engine.sync();

    expect(transport.pullCalls.map((c) => c.since)).toEqual([null, '2026-09-10T10:00:00.000Z']);
    expect(report.pulled).toBe(2);
    expect((await engine.getState()).since).toBe('2026-09-11T10:00:00.000Z');
  });

  it('salta una riga illeggibile invece di far fallire tutto', async () => {
    const h = harness();
    const transport = new FakeTransport(undefined, [
      emptyPull({
        itineraries: [{ id: 'non-un-uuid', title: 42 }, remoteItinerary()],
      }),
    ]);

    const report = await h.engine(transport).sync();

    expect(report.skipped).toBe(1);
    expect(report.pulled).toBe(1);
    expect(report.error).toBeUndefined();
  });

  it('riparte da capo dopo un reset del cursore', async () => {
    const h = harness();
    const transport = new FakeTransport(undefined, [
      emptyPull({ nextSince: '2026-09-10T10:00:00.000Z' }),
    ]);
    const engine = h.engine(transport);
    await engine.sync();
    expect((await engine.getState()).since).toBe('2026-09-10T10:00:00.000Z');

    await engine.reset();

    expect(await engine.getState()).toEqual({ lastSyncAt: null, since: null });
  });
});

describe('SyncEngine — le tappe ricevute restano leggibili dal repository', () => {
  let h: Harness;
  beforeEach(() => {
    h = harness();
  });

  it('un itinerario completo arrivato dal server si apre come uno locale', async () => {
    const itineraryId = '00000000-0000-4000-8000-0000000000a1';
    const dayId = '00000000-0000-4000-8000-0000000000d1';
    const stopId = '00000000-0000-4000-8000-0000000000f1';
    const iso = '2026-09-10T10:00:00.000Z';

    const stop: Stop = {
      id: stopId,
      createdAt: iso,
      updatedAt: iso,
      deletedAt: null,
      syncStatus: 'synced',
      dayId,
      title: 'Pantheon',
      category: 'cultura',
      location: { lat: 41.8986, lng: 12.4769 },
      order: 0,
    };

    await h
      .engine(
        new FakeTransport(undefined, [
          emptyPull({
            itineraries: [
              {
                id: itineraryId,
                createdAt: iso,
                updatedAt: iso,
                deletedAt: null,
                title: 'Roma condivisa',
                ownerId: 'user-2',
                collaborators: [{ userId: 'user-2', role: 'owner' }],
                currency: 'EUR',
                partySize: 2,
                dayIds: [dayId],
              },
            ],
            days: [
              {
                id: dayId,
                createdAt: iso,
                updatedAt: iso,
                deletedAt: null,
                itineraryId,
                orderedStopIds: [stopId],
              },
            ],
            stops: [stop],
          }),
        ])
      )
      .sync();

    const detail = await h.repo.get(itineraryId);
    expect(detail?.title).toBe('Roma condivisa');
    expect(detail?.days[0].stops.map((s) => s.title)).toEqual(['Pantheon']);
  });
});

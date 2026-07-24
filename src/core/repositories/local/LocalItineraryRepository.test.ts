import { LocalItineraryRepository } from './LocalItineraryRepository';
import { Outbox } from '../../sync/outbox';
import type { KeyValueStore } from '../../storage/keyValueStore';

/** Store in-memory che implementa il contratto KeyValueStore (niente AsyncStorage nei test). */
function createMemoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    async getJSON<T>(key: string) {
      const raw = data.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    },
    async setJSON<T>(key: string, value: T) {
      data.set(key, JSON.stringify(value));
    },
    async remove(key: string) {
      data.delete(key);
    },
  };
}

function makeRepo() {
  const store = createMemoryStore();
  return new LocalItineraryRepository(store, new Outbox(store));
}

describe('LocalItineraryRepository', () => {
  it('crea un itinerario con il proprietario come collaboratore owner', async () => {
    const repo = makeRepo();
    const it = await repo.create({ title: 'Roma', currency: 'EUR', partySize: 2 }, 'user-1');

    expect(it.title).toBe('Roma');
    expect(it.ownerId).toBe('user-1');
    expect(it.collaborators).toEqual([{ userId: 'user-1', role: 'owner' }]);
    expect(it.syncStatus).toBe('pending');
    expect(await repo.list()).toHaveLength(1);
  });

  it('compone itinerario → giorni → tappe rispettando l’ordine', async () => {
    const repo = makeRepo();
    const it = await repo.create({ title: 'Firenze', currency: 'EUR', partySize: 1 }, 'u');
    const day = await repo.addDay(it.id, { label: 'Giorno 1' });

    const a = await repo.addStop(day.id, {
      title: 'Duomo',
      category: 'cultura',
      location: { lat: 43.77, lng: 11.25 },
    });
    const b = await repo.addStop(day.id, {
      title: 'Uffizi',
      category: 'cultura',
      location: { lat: 43.768, lng: 11.255 },
    });

    const full = await repo.get(it.id);
    expect(full?.days).toHaveLength(1);
    expect(full?.days[0].stops.map((s) => s.title)).toEqual(['Duomo', 'Uffizi']);

    // Riordino: inverte le tappe.
    await repo.reorderStops(day.id, [b.id, a.id]);
    const reordered = await repo.get(it.id);
    expect(reordered?.days[0].stops.map((s) => s.title)).toEqual(['Uffizi', 'Duomo']);
  });

  it('soft-delete: l’itinerario eliminato sparisce dalla lista', async () => {
    const repo = makeRepo();
    const it = await repo.create({ title: 'Milano', currency: 'EUR', partySize: 1 }, 'u');
    await repo.remove(it.id);
    expect(await repo.list()).toHaveLength(0);
    expect(await repo.get(it.id)).toBeNull();
  });

  it('registra le mutazioni nell’outbox per il sync futuro', async () => {
    const store = createMemoryStore();
    const outbox = new Outbox(store);
    const repo = new LocalItineraryRepository(store, outbox);
    await repo.create({ title: 'Napoli', currency: 'EUR', partySize: 1 }, 'u');
    const entries = await outbox.list();
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0]).toMatchObject({ entityType: 'itinerary', op: 'create' });
  });
});

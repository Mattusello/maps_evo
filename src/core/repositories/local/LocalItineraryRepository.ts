/**
 * LocalItineraryRepository — implementazione Fase 1 (AsyncStorage).
 *
 * I dati sono normalizzati in tre collezioni (itineraries, days, stops), come farebbe un DB
 * relazionale: questo rende naturale il futuro passaggio a expo-sqlite o al backend REST.
 * Ogni mutazione registra una voce nell'outbox e marca l'entità `pending` per il sync futuro.
 */
import type {
  CreateDayInput,
  CreateStopInput,
  DayPatch,
  ItineraryPatch,
  ItineraryRepository,
  StopPatch,
} from '../contracts';
import {
  daySchema,
  itinerarySchema,
  stopSchema,
  type CreateItineraryInput,
  type Day,
  type Itinerary,
  type ItineraryWithDetails,
  type Stop,
} from '../../models';
import { Outbox } from '../../sync/outbox';
import { asyncStorageStore, STORAGE_KEYS, type KeyValueStore } from '../../storage/keyValueStore';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/time';

export class LocalItineraryRepository implements ItineraryRepository {
  constructor(
    private store: KeyValueStore = asyncStorageStore,
    private outbox: Outbox = new Outbox(asyncStorageStore)
  ) {}

  // --- Helper di collezione ---
  private async loadItineraries(): Promise<Itinerary[]> {
    const raw = (await this.store.getJSON<unknown[]>(STORAGE_KEYS.itineraries)) ?? [];
    return raw.map((i) => itinerarySchema.parse(i));
  }
  private async loadDays(): Promise<Day[]> {
    const raw = (await this.store.getJSON<unknown[]>(STORAGE_KEYS.days)) ?? [];
    return raw.map((d) => daySchema.parse(d));
  }
  private async loadStops(): Promise<Stop[]> {
    const raw = (await this.store.getJSON<unknown[]>(STORAGE_KEYS.stops)) ?? [];
    return raw.map((s) => stopSchema.parse(s));
  }
  private saveItineraries(v: Itinerary[]) {
    return this.store.setJSON(STORAGE_KEYS.itineraries, v);
  }
  private saveDays(v: Day[]) {
    return this.store.setJSON(STORAGE_KEYS.days, v);
  }
  private saveStops(v: Stop[]) {
    return this.store.setJSON(STORAGE_KEYS.stops, v);
  }

  // --- Itinerari ---
  async list(): Promise<Itinerary[]> {
    const all = await this.loadItineraries();
    return all
      .filter((i) => !i.deletedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<ItineraryWithDetails | null> {
    const itinerary = (await this.loadItineraries()).find((i) => i.id === id && !i.deletedAt);
    if (!itinerary) return null;
    const days = (await this.loadDays()).filter((d) => d.itineraryId === id && !d.deletedAt);
    const stops = (await this.loadStops()).filter((s) => !s.deletedAt);

    const orderedDays = itinerary.dayIds
      .map((dayId) => days.find((d) => d.id === dayId))
      .filter((d): d is Day => Boolean(d))
      .map((day) => ({
        ...day,
        stops: day.orderedStopIds
          .map((stopId) => stops.find((s) => s.id === stopId))
          .filter((s): s is Stop => Boolean(s)),
      }));

    return { ...itinerary, days: orderedDays };
  }

  async create(input: CreateItineraryInput, ownerId: string): Promise<Itinerary> {
    const now = nowIso();
    const itinerary: Itinerary = itinerarySchema.parse({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      title: input.title,
      description: input.description,
      ownerId,
      collaborators: [{ userId: ownerId, role: 'owner' }],
      currency: input.currency ?? 'EUR',
      partySize: input.partySize ?? 1,
      dayIds: [],
    });
    const all = await this.loadItineraries();
    all.push(itinerary);
    await this.saveItineraries(all);
    await this.outbox.enqueue('itinerary', itinerary.id, 'create', itinerary);
    return itinerary;
  }

  async update(id: string, patch: ItineraryPatch): Promise<Itinerary> {
    const all = await this.loadItineraries();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error(`Itinerario ${id} non trovato`);
    const updated: Itinerary = { ...all[idx], ...patch, updatedAt: nowIso(), syncStatus: 'pending' };
    all[idx] = itinerarySchema.parse(updated);
    await this.saveItineraries(all);
    await this.outbox.enqueue('itinerary', id, 'update', all[idx]);
    return all[idx];
  }

  async remove(id: string): Promise<void> {
    const all = await this.loadItineraries();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return;
    // Soft-delete per coerenza col sync futuro.
    all[idx] = { ...all[idx], deletedAt: nowIso(), syncStatus: 'pending' };
    await this.saveItineraries(all);
    await this.outbox.enqueue('itinerary', id, 'delete', { id });
  }

  // --- Giorni ---
  async addDay(itineraryId: string, input: CreateDayInput = {}): Promise<Day> {
    const now = nowIso();
    const day: Day = daySchema.parse({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      itineraryId,
      date: input.date,
      label: input.label,
      orderedStopIds: [],
    });
    const days = await this.loadDays();
    days.push(day);
    await this.saveDays(days);

    const itineraries = await this.loadItineraries();
    const idx = itineraries.findIndex((i) => i.id === itineraryId);
    if (idx === -1) throw new Error(`Itinerario ${itineraryId} non trovato`);
    itineraries[idx] = {
      ...itineraries[idx],
      dayIds: [...itineraries[idx].dayIds, day.id],
      updatedAt: now,
      syncStatus: 'pending',
    };
    await this.saveItineraries(itineraries);
    await this.outbox.enqueue('day', day.id, 'create', day);
    return day;
  }

  async updateDay(dayId: string, patch: DayPatch): Promise<Day> {
    const days = await this.loadDays();
    const idx = days.findIndex((d) => d.id === dayId);
    if (idx === -1) throw new Error(`Giorno ${dayId} non trovato`);
    days[idx] = daySchema.parse({ ...days[idx], ...patch, updatedAt: nowIso(), syncStatus: 'pending' });
    await this.saveDays(days);
    await this.outbox.enqueue('day', dayId, 'update', days[idx]);
    return days[idx];
  }

  async removeDay(dayId: string): Promise<void> {
    const days = await this.loadDays();
    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    // Soft-delete del giorno e delle sue tappe.
    const now = nowIso();
    const nextDays = days.map((d) => (d.id === dayId ? { ...d, deletedAt: now, syncStatus: 'pending' as const } : d));
    await this.saveDays(nextDays);

    const stops = await this.loadStops();
    await this.saveStops(
      stops.map((s) => (s.dayId === dayId ? { ...s, deletedAt: now, syncStatus: 'pending' as const } : s))
    );

    const itineraries = await this.loadItineraries();
    const idx = itineraries.findIndex((i) => i.id === day.itineraryId);
    if (idx !== -1) {
      itineraries[idx] = {
        ...itineraries[idx],
        dayIds: itineraries[idx].dayIds.filter((id) => id !== dayId),
        updatedAt: now,
        syncStatus: 'pending',
      };
      await this.saveItineraries(itineraries);
    }
    await this.outbox.enqueue('day', dayId, 'delete', { id: dayId });
  }

  async reorderDays(itineraryId: string, orderedDayIds: string[]): Promise<void> {
    const itineraries = await this.loadItineraries();
    const idx = itineraries.findIndex((i) => i.id === itineraryId);
    if (idx === -1) throw new Error(`Itinerario ${itineraryId} non trovato`);
    itineraries[idx] = { ...itineraries[idx], dayIds: orderedDayIds, updatedAt: nowIso(), syncStatus: 'pending' };
    await this.saveItineraries(itineraries);
    await this.outbox.enqueue('itinerary', itineraryId, 'update', itineraries[idx]);
  }

  // --- Tappe ---
  async addStop(dayId: string, input: CreateStopInput): Promise<Stop> {
    const days = await this.loadDays();
    const dayIdx = days.findIndex((d) => d.id === dayId);
    if (dayIdx === -1) throw new Error(`Giorno ${dayId} non trovato`);

    const now = nowIso();
    const order = days[dayIdx].orderedStopIds.length;
    const stop: Stop = stopSchema.parse({
      ...input,
      id: newId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      dayId,
      order,
    });
    const stops = await this.loadStops();
    stops.push(stop);
    await this.saveStops(stops);

    days[dayIdx] = {
      ...days[dayIdx],
      orderedStopIds: [...days[dayIdx].orderedStopIds, stop.id],
      updatedAt: now,
      syncStatus: 'pending',
    };
    await this.saveDays(days);
    await this.outbox.enqueue('stop', stop.id, 'create', stop);
    return stop;
  }

  async updateStop(stopId: string, patch: StopPatch): Promise<Stop> {
    const stops = await this.loadStops();
    const idx = stops.findIndex((s) => s.id === stopId);
    if (idx === -1) throw new Error(`Tappa ${stopId} non trovata`);
    stops[idx] = stopSchema.parse({ ...stops[idx], ...patch, updatedAt: nowIso(), syncStatus: 'pending' });
    await this.saveStops(stops);
    await this.outbox.enqueue('stop', stopId, 'update', stops[idx]);
    return stops[idx];
  }

  async removeStop(stopId: string): Promise<void> {
    const stops = await this.loadStops();
    const stop = stops.find((s) => s.id === stopId);
    if (!stop) return;
    const now = nowIso();
    await this.saveStops(
      stops.map((s) => (s.id === stopId ? { ...s, deletedAt: now, syncStatus: 'pending' as const } : s))
    );
    const days = await this.loadDays();
    const idx = days.findIndex((d) => d.id === stop.dayId);
    if (idx !== -1) {
      days[idx] = {
        ...days[idx],
        orderedStopIds: days[idx].orderedStopIds.filter((id) => id !== stopId),
        updatedAt: now,
        syncStatus: 'pending',
      };
      await this.saveDays(days);
    }
    await this.outbox.enqueue('stop', stopId, 'delete', { id: stopId });
  }

  async reorderStops(dayId: string, orderedStopIds: string[]): Promise<void> {
    const days = await this.loadDays();
    const idx = days.findIndex((d) => d.id === dayId);
    if (idx === -1) throw new Error(`Giorno ${dayId} non trovato`);
    days[idx] = { ...days[idx], orderedStopIds, updatedAt: nowIso(), syncStatus: 'pending' };
    await this.saveDays(days);

    // Riallinea il campo `order` delle tappe.
    const stops = await this.loadStops();
    const orderMap = new Map(orderedStopIds.map((id, i) => [id, i]));
    await this.saveStops(
      stops.map((s) => (orderMap.has(s.id) ? { ...s, order: orderMap.get(s.id)! } : s))
    );
    await this.outbox.enqueue('day', dayId, 'update', days[idx]);
  }

  async moveStop(stopId: string, targetDayId: string, targetIndex: number): Promise<void> {
    const stops = await this.loadStops();
    const stop = stops.find((s) => s.id === stopId);
    if (!stop) throw new Error(`Tappa ${stopId} non trovata`);
    const sourceDayId = stop.dayId;

    const days = await this.loadDays();
    const now = nowIso();

    // Rimuovi dalla giornata di origine.
    const srcIdx = days.findIndex((d) => d.id === sourceDayId);
    if (srcIdx !== -1) {
      days[srcIdx] = {
        ...days[srcIdx],
        orderedStopIds: days[srcIdx].orderedStopIds.filter((id) => id !== stopId),
        updatedAt: now,
        syncStatus: 'pending',
      };
    }
    // Inserisci nella giornata di destinazione all'indice richiesto.
    const dstIdx = days.findIndex((d) => d.id === targetDayId);
    if (dstIdx === -1) throw new Error(`Giorno ${targetDayId} non trovato`);
    const nextOrder = [...days[dstIdx].orderedStopIds];
    nextOrder.splice(Math.max(0, Math.min(targetIndex, nextOrder.length)), 0, stopId);
    days[dstIdx] = { ...days[dstIdx], orderedStopIds: nextOrder, updatedAt: now, syncStatus: 'pending' };
    await this.saveDays(days);

    await this.saveStops(
      stops.map((s) => (s.id === stopId ? { ...s, dayId: targetDayId, updatedAt: now, syncStatus: 'pending' as const } : s))
    );
    await this.outbox.enqueue('stop', stopId, 'update', { id: stopId, dayId: targetDayId });
  }

  // --- Import / Export ---
  async exportItinerary(id: string): Promise<ItineraryWithDetails> {
    const full = await this.get(id);
    if (!full) throw new Error(`Itinerario ${id} non trovato`);
    return full;
  }

  async importItinerary(data: ItineraryWithDetails, ownerId: string): Promise<Itinerary> {
    // Rigenera gli id per evitare collisioni con eventuali entità esistenti.
    const now = nowIso();
    const dayIdMap = new Map<string, string>();
    const newItineraryId = newId();

    const days: Day[] = [];
    const stops: Stop[] = [];
    for (const day of data.days) {
      const newDayId = newId();
      dayIdMap.set(day.id, newDayId);
      const stopIds: string[] = [];
      for (const stop of day.stops) {
        const newStopId = newId();
        stopIds.push(newStopId);
        stops.push(
          stopSchema.parse({
            ...stop,
            id: newStopId,
            dayId: newDayId,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            syncStatus: 'pending',
          })
        );
      }
      days.push(
        daySchema.parse({
          ...day,
          id: newDayId,
          itineraryId: newItineraryId,
          orderedStopIds: stopIds,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          syncStatus: 'pending',
        })
      );
    }

    const itinerary: Itinerary = itinerarySchema.parse({
      ...data,
      id: newItineraryId,
      ownerId,
      collaborators: [{ userId: ownerId, role: 'owner' }],
      dayIds: days.map((d) => d.id),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
    });

    await this.saveItineraries([...(await this.loadItineraries()), itinerary]);
    await this.saveDays([...(await this.loadDays()), ...days]);
    await this.saveStops([...(await this.loadStops()), ...stops]);
    await this.outbox.enqueue('itinerary', itinerary.id, 'create', itinerary);
    return itinerary;
  }
}

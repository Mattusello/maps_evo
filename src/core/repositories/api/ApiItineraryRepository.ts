/**
 * ApiItineraryRepository — PREDISPOSTO per la Fase 2 (backend Laravel).
 *
 * Implementa la stessa interfaccia di `LocalItineraryRepository` mappandola sugli endpoint
 * REST previsti (documentati in `docs/BACKEND.md`). Non richiede modifiche alla UI: basterà
 * impostare `EXPO_PUBLIC_USE_API=true` e avere il backend attivo. La logica server non è
 * inclusa in Fase 1; qui c'è solo il client, già pronto.
 */
import { apiClient } from '../../api/apiClient';
import type {
  CreateDayInput,
  CreateStopInput,
  DayPatch,
  ItineraryPatch,
  ItineraryRepository,
  StopPatch,
} from '../contracts';
import type {
  CreateItineraryInput,
  Day,
  Itinerary,
  ItineraryWithDetails,
  Stop,
} from '../../models';

export class ApiItineraryRepository implements ItineraryRepository {
  list() {
    return apiClient.get<Itinerary[]>('/api/itineraries');
  }
  get(id: string) {
    return apiClient.get<ItineraryWithDetails | null>(`/api/itineraries/${id}`);
  }
  create(input: CreateItineraryInput, ownerId: string) {
    return apiClient.post<Itinerary>('/api/itineraries', { ...input, ownerId });
  }
  update(id: string, patch: ItineraryPatch) {
    return apiClient.patch<Itinerary>(`/api/itineraries/${id}`, patch);
  }
  remove(id: string) {
    return apiClient.delete<void>(`/api/itineraries/${id}`);
  }

  addDay(itineraryId: string, input: CreateDayInput = {}) {
    return apiClient.post<Day>(`/api/itineraries/${itineraryId}/days`, input);
  }
  updateDay(dayId: string, patch: DayPatch) {
    return apiClient.patch<Day>(`/api/days/${dayId}`, patch);
  }
  removeDay(dayId: string) {
    return apiClient.delete<void>(`/api/days/${dayId}`);
  }
  reorderDays(itineraryId: string, orderedDayIds: string[]) {
    return apiClient.put<void>(`/api/itineraries/${itineraryId}/days/order`, { orderedDayIds });
  }

  addStop(dayId: string, input: CreateStopInput) {
    return apiClient.post<Stop>(`/api/days/${dayId}/stops`, input);
  }
  updateStop(stopId: string, patch: StopPatch) {
    return apiClient.patch<Stop>(`/api/stops/${stopId}`, patch);
  }
  removeStop(stopId: string) {
    return apiClient.delete<void>(`/api/stops/${stopId}`);
  }
  reorderStops(dayId: string, orderedStopIds: string[]) {
    return apiClient.put<void>(`/api/days/${dayId}/stops/order`, { orderedStopIds });
  }
  moveStop(stopId: string, targetDayId: string, targetIndex: number) {
    return apiClient.put<void>(`/api/stops/${stopId}/move`, { targetDayId, targetIndex });
  }

  exportItinerary(id: string) {
    return apiClient.get<ItineraryWithDetails>(`/api/itineraries/${id}/export`);
  }
  importItinerary(data: ItineraryWithDetails, ownerId: string) {
    return apiClient.post<Itinerary>('/api/itineraries/import', { ...data, ownerId });
  }
}

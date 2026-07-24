/**
 * CONTRATTO del repository degli itinerari.
 *
 * Questa interfaccia è il confine tra la UI e la persistenza. La UI dipende SOLO da qui,
 * mai da AsyncStorage o da un client HTTP. Fase 1: `LocalItineraryRepository`. Fase 2:
 * `ApiItineraryRepository` (backend Laravel) con la stessa identica interfaccia → nessuna
 * riscrittura della UI.
 */
import type {
  CreateItineraryInput,
  Day,
  Itinerary,
  ItineraryWithDetails,
  Stop,
} from '../../models';

/** Campi modificabili di un itinerario. */
export type ItineraryPatch = Partial<
  Pick<Itinerary, 'title' | 'description' | 'coverImage' | 'currency' | 'partySize' | 'collaborators'>
>;

/** Input per creare un giorno. */
export type CreateDayInput = { date?: string; label?: string };
export type DayPatch = Partial<Pick<Day, 'date' | 'label'>>;

/** Input per creare una tappa (id/timestamps li assegna il repository). */
export type CreateStopInput = Omit<
  Stop,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncStatus' | 'dayId' | 'order'
>;
export type StopPatch = Partial<
  Pick<
    Stop,
    | 'title'
    | 'category'
    | 'location'
    | 'plannedArrival'
    | 'plannedDurationMin'
    | 'notes'
    | 'cost'
    | 'bookingUrl'
    | 'poiRef'
  >
>;

export interface ItineraryRepository {
  // --- Itinerari ---
  list(): Promise<Itinerary[]>;
  get(id: string): Promise<ItineraryWithDetails | null>;
  create(input: CreateItineraryInput, ownerId: string): Promise<Itinerary>;
  update(id: string, patch: ItineraryPatch): Promise<Itinerary>;
  remove(id: string): Promise<void>;

  // --- Giorni ---
  addDay(itineraryId: string, input?: CreateDayInput): Promise<Day>;
  updateDay(dayId: string, patch: DayPatch): Promise<Day>;
  removeDay(dayId: string): Promise<void>;
  reorderDays(itineraryId: string, orderedDayIds: string[]): Promise<void>;

  // --- Tappe ---
  addStop(dayId: string, input: CreateStopInput): Promise<Stop>;
  updateStop(stopId: string, patch: StopPatch): Promise<Stop>;
  removeStop(stopId: string): Promise<void>;
  /** Riordina le tappe di un giorno (drag & drop / ottimizzazione percorso). */
  reorderStops(dayId: string, orderedStopIds: string[]): Promise<void>;
  /** Sposta una tappa in un altro giorno. */
  moveStop(stopId: string, targetDayId: string, targetIndex: number): Promise<void>;

  // --- Import/Export (condivisione Fase 1) ---
  exportItinerary(id: string): Promise<ItineraryWithDetails>;
  importItinerary(data: ItineraryWithDetails, ownerId: string): Promise<Itinerary>;
}

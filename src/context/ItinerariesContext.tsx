/**
 * ItinerariesContext: stato della lista itinerari (dominio). Usa useReducer per gestire
 * loading/errore/dati in modo esplicito. Delega ogni persistenza al repository astratto.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

import { getItineraryRepository } from '../core/repositories';
import type { CreateItineraryInput, Itinerary } from '../core/models';
import { sharedToItineraryDetails, type SharedItinerary } from '../core/sharing/shareCode';
import { useAuth } from './AuthContext';

type State = {
  itineraries: Itinerary[];
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: 'load/start' }
  | { type: 'load/success'; items: Itinerary[] }
  | { type: 'load/error'; error: string }
  | { type: 'upsert'; item: Itinerary }
  | { type: 'remove'; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load/start':
      return { ...state, loading: true, error: null };
    case 'load/success':
      return { itineraries: action.items, loading: false, error: null };
    case 'load/error':
      return { ...state, loading: false, error: action.error };
    case 'upsert': {
      const others = state.itineraries.filter((i) => i.id !== action.item.id);
      return { ...state, itineraries: [action.item, ...others] };
    }
    case 'remove':
      return { ...state, itineraries: state.itineraries.filter((i) => i.id !== action.id) };
    default:
      return state;
  }
}

type ItinerariesContextValue = State & {
  refresh: () => Promise<void>;
  createItinerary: (input: CreateItineraryInput) => Promise<Itinerary>;
  deleteItinerary: (id: string) => Promise<void>;
  /** Aggiunge alla lista un itinerario ricevuto (codice, link o QR) come copia locale. */
  importShared: (shared: SharedItinerary) => Promise<Itinerary>;
};

const ItinerariesContext = createContext<ItinerariesContextValue | null>(null);

export function ItinerariesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { itineraries: [], loading: true, error: null });
  const repo = useMemo(() => getItineraryRepository(), []);
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    dispatch({ type: 'load/start' });
    try {
      dispatch({ type: 'load/success', items: await repo.list() });
    } catch (e) {
      dispatch({ type: 'load/error', error: e instanceof Error ? e.message : 'Errore di caricamento' });
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createItinerary = useCallback(
    async (input: CreateItineraryInput) => {
      const ownerId = user?.id ?? 'local';
      const item = await repo.create(input, ownerId);
      dispatch({ type: 'upsert', item });
      return item;
    },
    [repo, user]
  );

  const deleteItinerary = useCallback(
    async (id: string) => {
      await repo.remove(id);
      dispatch({ type: 'remove', id });
    },
    [repo]
  );

  const importShared = useCallback(
    async (shared: SharedItinerary) => {
      const ownerId = user?.id ?? 'local';
      // La scrittura passa sempre dal repository (outbox + syncStatus): qui si traduce
      // soltanto la forma compatta nell'aggregato che il repository sa importare.
      const item = await repo.importItinerary(sharedToItineraryDetails(shared, ownerId), ownerId);
      dispatch({ type: 'upsert', item });
      return item;
    },
    [repo, user]
  );

  const value = useMemo<ItinerariesContextValue>(
    () => ({ ...state, refresh, createItinerary, deleteItinerary, importShared }),
    [state, refresh, createItinerary, deleteItinerary, importShared]
  );

  return <ItinerariesContext.Provider value={value}>{children}</ItinerariesContext.Provider>;
}

export function useItineraries(): ItinerariesContextValue {
  const ctx = useContext(ItinerariesContext);
  if (!ctx) throw new Error('useItineraries deve essere usato dentro <ItinerariesProvider>.');
  return ctx;
}

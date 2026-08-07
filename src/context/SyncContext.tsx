/**
 * SyncContext: **quando** sincronizzare, e come raccontarlo alla UI.
 *
 * Il come sta nel `SyncEngine` (core). Qui c'è solo la politica: si sincronizza all'avvio,
 * quando l'app torna in primo piano e quando l'utente lo chiede. Nessun timer che gira in
 * sottofondo: consuma batteria e in viaggio la batteria è un bene serio.
 *
 * Se il backend non è configurato il contesto esiste lo stesso, ma dichiara `enabled:
 * false`: la UI dice che i dati restano sul dispositivo invece di mostrare una
 * sincronizzazione che non avverrà mai.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { getSyncEngine } from '../core/repositories';
import { Outbox } from '../core/sync/outbox';
import type { SyncReport } from '../core/sync/contracts';
import { useAuth } from './AuthContext';
import { useItineraries } from './ItinerariesContext';

/** Distanza minima tra due sincronizzazioni automatiche. */
const AUTO_SYNC_INTERVAL_MS = 60_000;

type SyncContextValue = {
  /** Il backend è configurato (`EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_USE_API`). */
  enabled: boolean;
  syncing: boolean;
  /** Fine dell'ultima sincronizzazione riuscita (ISO), o null se non è mai avvenuta. */
  lastSyncAt: string | null;
  /** Modifiche locali ancora da mandare. */
  pending: number;
  /** Esito dell'ultimo tentativo: serve a mostrare conflitti ed errori. */
  lastReport: SyncReport | null;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => getSyncEngine(), []);
  const outbox = useMemo(() => new Outbox(), []);
  const { signedIn, ready } = useAuth();
  const { refresh } = useItineraries();

  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);
  const lastAttemptAt = useRef(0);

  const refreshPending = useCallback(async () => {
    setPending(await outbox.count());
  }, [outbox]);

  const syncNow = useCallback(async () => {
    if (!engine) {
      await refreshPending();
      return;
    }
    setSyncing(true);
    lastAttemptAt.current = Date.now();
    try {
      const report = await engine.sync();
      setLastReport(report);
      setPending(report.pending);
      setLastSyncAt((await engine.getState()).lastSyncAt);
      // Il pull può aver portato itinerari nuovi: la lista deve accorgersene.
      if (report.pulled > 0 || report.conflicts > 0) await refresh();
    } finally {
      setSyncing(false);
    }
  }, [engine, refresh, refreshPending]);

  // Stato iniziale: quante modifiche aspettano e quando è andata bene l'ultima volta.
  useEffect(() => {
    void refreshPending();
    if (engine) void engine.getState().then((state) => setLastSyncAt(state.lastSyncAt));
  }, [engine, refreshPending]);

  // All'avvio (a sessione risolta) e a ogni accesso.
  useEffect(() => {
    if (!engine || !ready || !signedIn) return;
    void syncNow();
    // `syncNow` cambia identità a ogni render: dipendere da lui farebbe ripartire il ciclo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, ready, signedIn]);

  // Ritorno in primo piano: è il momento in cui la rete di solito è tornata.
  useEffect(() => {
    if (!engine || !signedIn) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (Date.now() - lastAttemptAt.current < AUTO_SYNC_INTERVAL_MS) return;
      void syncNow();
    });
    return () => subscription.remove();
  }, [engine, signedIn, syncNow]);

  const value = useMemo<SyncContextValue>(
    () => ({ enabled: engine !== null, syncing, lastSyncAt, pending, lastReport, syncNow }),
    [engine, syncing, lastSyncAt, pending, lastReport, syncNow]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync deve essere usato dentro <SyncProvider>.');
  return ctx;
}

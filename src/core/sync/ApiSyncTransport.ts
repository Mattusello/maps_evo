/**
 * Trasporto di sincronizzazione sul backend Laravel: le due chiamate di
 * `docs/BACKEND.md` §4, niente altro. Tutta la logica sta nel SyncEngine; qui c'è solo
 * la traduzione in HTTP.
 */
import { apiClient } from '../api/apiClient';
import type { PullResponse, PushOperation, PushResponse, SyncTransport } from './contracts';

/** Quante entità chiedere per pagina nel pull (il contratto ammette fino a 1000). */
const PULL_LIMIT = 500;

export class ApiSyncTransport implements SyncTransport {
  push(operations: PushOperation[]): Promise<PushResponse> {
    return apiClient.post<PushResponse>('/api/sync/push', { operations });
  }

  pull(params: { since: string | null; limit?: number }): Promise<PullResponse> {
    const query = new URLSearchParams({ limit: String(params.limit ?? PULL_LIMIT) });
    if (params.since) query.set('since', params.since);
    return apiClient.get<PullResponse>(`/api/sync/pull?${query.toString()}`);
  }
}

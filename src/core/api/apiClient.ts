/**
 * Client HTTP verso il backend Laravel (contratto in `docs/BACKEND.md`).
 *
 * Un solo posto che sa: base URL, header, token Bearer, timeout e — soprattutto — **come si
 * legge un errore**. Distinguere "non c'è rete" da "il server ha rifiutato" è ciò che
 * permette al SyncEngine di decidere se riprovare o scartare: quella distinzione vive qui,
 * in `ApiError.isNetwork`.
 */
import { env } from '../config/env';
import { getAuthToken, setAuthToken } from './tokenStore';

/** Oltre questo tempo la richiesta è considerata persa: in mobilità la rete resta appesa. */
const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    message: string,
    /** Codice HTTP, oppure 0 quando la richiesta non è mai arrivata a destinazione. */
    readonly status: number,
    readonly body?: unknown,
    /** Errori di validazione per campo (formato Laravel). */
    readonly validationErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Vero quando il problema è la connessione, non la richiesta: si riprova più tardi. */
  get isNetwork(): boolean {
    return this.status === 0 || this.status >= 500;
  }

  /** La sessione non è più valida: il chiamante deve tornare allo stato non autenticato. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Non allegare il token (login e registrazione). */
  anonymous?: boolean;
};

/** Chiamata quando il server risponde 401: la registra `SyncContext` per fare logout. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Un 502 di un proxy risponde HTML: non è JSON e non deve far esplodere il client.
    return text;
  }
}

function messageOf(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return `Richiesta fallita (${status})`;
}

function validationErrorsOf(data: unknown): Record<string, string[]> | undefined {
  if (data && typeof data === 'object' && 'errors' in data) {
    const errors = (data as { errors?: unknown }).errors;
    if (errors && typeof errors === 'object') return errors as Record<string, string[]>;
  }
  return undefined;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!env.apiUrl) {
    throw new ApiError('EXPO_PUBLIC_API_URL non configurato', 0);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token && !options.anonymous) headers.Authorization = `Bearer ${token}`;

  // Timeout proprio, combinato con l'eventuale annullamento del chiamante.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller);

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (e) {
    // fetch fallisce solo per rete/timeout: qualunque altra cosa è già una risposta HTTP.
    throw new ApiError(
      e instanceof Error && e.name === 'AbortError'
        ? 'Il server non ha risposto in tempo'
        : 'Nessuna connessione al server',
      0
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }

  const data = parseBody(await response.text());

  if (!response.ok) {
    if (response.status === 401) {
      // Token scaduto o revocato: si esce dalla sessione, i dati locali restano.
      await setAuthToken(null);
      onUnauthorized?.();
    }
    throw new ApiError(
      messageOf(data, response.status),
      response.status,
      data,
      validationErrorsOf(data)
    );
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { getAuthToken, loadAuthToken, setAuthToken } from './tokenStore';

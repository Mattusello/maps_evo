/**
 * Il client HTTP conta soprattutto per **come classifica gli errori**: il SyncEngine decide
 * se riprovare o scartare in base a quella classificazione, quindi sbagliarla significa
 * perdere modifiche o intasare la coda per sempre.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { apiClient, ApiError, setUnauthorizedHandler } from './apiClient';
import { configureTokenStore, getAuthToken, setAuthToken } from './tokenStore';
import { createMemoryStore } from '@/test/memoryStore';

jest.mock('@/core/config/env', () => ({
  env: { apiUrl: 'https://api.example.test', googleMapsApiKey: '', useApiBackend: true },
  isGoogleMapsConfigured: () => false,
}));

type FetchArgs = [string, RequestInit];
const fetchMock = jest.fn<(...args: FetchArgs) => Promise<Response>>();

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as Response;
}

beforeEach(async () => {
  configureTokenStore(createMemoryStore());
  await setAuthToken(null);
  fetchMock.mockReset();
  setUnauthorizedHandler(null);
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  setUnauthorizedHandler(null);
});

describe('apiClient', () => {
  it('allega il token alle richieste autenticate e non a quelle anonime', async () => {
    await setAuthToken('token-123');
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await apiClient.get('/api/auth/me');
    await apiClient.post('/api/auth/login', { email: 'a@b.c' }, { anonymous: true });

    const [, authenticated] = fetchMock.mock.calls[0];
    const [, anonymous] = fetchMock.mock.calls[1];
    expect((authenticated.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
    expect((anonymous.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('senza connessione produce un errore riconoscibile come "di rete"', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const error = await apiClient.get('/api/sync/pull').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).isNetwork).toBe(true);
  });

  it('considera "di rete" anche un 500: si riprova, non si scarta', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'Server error' }));

    const error = (await apiClient.get('/api/sync/pull').catch((e: unknown) => e)) as ApiError;

    expect(error.isNetwork).toBe(true);
    expect(error.status).toBe(500);
  });

  it('un 422 non è di rete e porta gli errori per campo', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        message: 'Il titolo è obbligatorio.',
        errors: { title: ['Il titolo è obbligatorio.'] },
      })
    );

    const error = (await apiClient.post('/api/itineraries', {}).catch((e: unknown) => e)) as ApiError;

    expect(error.isNetwork).toBe(false);
    expect(error.message).toBe('Il titolo è obbligatorio.');
    expect(error.validationErrors?.title).toEqual(['Il titolo è obbligatorio.']);
  });

  it('al 401 butta il token e avvisa chi gestisce la sessione', async () => {
    await setAuthToken('token-scaduto');
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthenticated.' }));

    const error = (await apiClient.get('/api/auth/me').catch((e: unknown) => e)) as ApiError;

    expect(error.isUnauthorized).toBe(true);
    expect(getAuthToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('non esplode se il server risponde qualcosa che non è JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '<html>Bad gateway</html>',
    } as Response);

    const error = (await apiClient.get('/api/sync/pull').catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(502);
    expect(error.message).toContain('502');
  });
});

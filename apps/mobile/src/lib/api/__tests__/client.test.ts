import { z } from 'zod';
import {
  ApiError,
  apiRequest,
  configureApiClient,
  setAuthToken,
  setUnauthorizedHandler,
  type FetchLike,
} from '..';

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(respond: (call: Call) => Response): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: async (url, init) => {
      const call = { url, init };
      calls.push(call);
      return respond(call);
    },
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PingSchema = z.object({ ok: z.literal(true) });

afterEach(() => {
  setAuthToken(null);
  setUnauthorizedHandler(null);
  configureApiClient({});
});

describe('apiRequest', () => {
  it('sends the Bearer token, JSON body and query, and validates the response', async () => {
    const f = fakeFetch(() => json(200, { ok: true }));
    configureApiClient({ fetch: f.fetch, baseUrl: 'http://api.test' });
    setAuthToken('tok-123');

    const result = await apiRequest('/api/ping', {
      method: 'POST',
      body: { a: 1 },
      query: { q: 'ok computer', skip: undefined },
      schema: PingSchema,
    });

    expect(result).toEqual({ ok: true });
    expect(f.calls[0]?.url).toBe('http://api.test/api/ping?q=ok%20computer');
    const headers = f.calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-123');
    expect(headers['Content-Type']).toBe('application/json');
    expect(f.calls[0]?.init.credentials).toBe('omit');
    expect(f.calls[0]?.init.body).toBe('{"a":1}');
  });

  it('omits Authorization when signed out', async () => {
    const f = fakeFetch(() => json(200, { ok: true }));
    configureApiClient({ fetch: f.fetch });
    await apiRequest('/api/ping', { schema: PingSchema });
    const headers = f.calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('maps an ApiErrorBody to ApiError with field errors', async () => {
    configureApiClient({
      fetch: fakeFetch(() =>
        json(400, {
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Dati non validi',
          fieldErrors: { password: ['La password deve avere almeno 10 caratteri'] },
        })
      ).fetch,
    });
    const error = await apiRequest('/api/auth/register', { method: 'POST', body: {} }).catch(
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.code).toBe('VALIDATION_ERROR');
    expect(apiError.status).toBe(400);
    expect(apiError.fieldError('password')).toBe('La password deve avere almeno 10 caratteri');
  });

  it('calls the unauthorized handler once when the current token is rejected', async () => {
    configureApiClient({
      fetch: fakeFetch(() =>
        json(401, { statusCode: 401, code: 'UNAUTHORIZED', message: 'Sessione scaduta' })
      ).fetch,
    });
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    setAuthToken('expired');

    await expect(apiRequest('/api/auth/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not treat a wrong-password 401 without a token as a dead session', async () => {
    configureApiClient({
      fetch: fakeFetch(() =>
        json(401, { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Credenziali errate' })
      ).fetch,
    });
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    await expect(apiRequest('/api/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject(
      {
        code: 'INVALID_CREDENTIALS',
      }
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('reports network failures and contract mismatches as client error codes', async () => {
    configureApiClient({
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    });
    await expect(apiRequest('/api/ping')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    configureApiClient({ fetch: fakeFetch(() => json(200, { ok: 'yes' })).fetch });
    await expect(apiRequest('/api/ping', { schema: PingSchema })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

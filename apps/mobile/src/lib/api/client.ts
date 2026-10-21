import type { ZodType, ZodTypeDef } from 'zod';
import { API_URL, REQUEST_TIMEOUT_MS } from './config';
import { ApiError } from './errors';

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Serialised as JSON. */
  body?: unknown;
  /** `undefined`/`null` values are omitted. */
  query?: Record<string, QueryValue>;
  /** Shared Zod schema the response is validated against. Omit for 204 responses. */
  schema?: ZodType<T, ZodTypeDef, unknown>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

interface ClientState {
  token: string | null;
  fetch: FetchLike;
  baseUrl: string;
  onUnauthorized: (() => void) | null;
}

const state: ClientState = {
  token: null,
  fetch: (input, init) => fetch(input, init),
  baseUrl: API_URL,
  onUnauthorized: null,
};

/**
 * Bearer token sent as `Authorization` on every request. The `AuthProvider` owns it: it loads it
 * from expo-secure-store at start-up and calls this after login/logout. Never log it.
 */
export function setAuthToken(token: string | null): void {
  state.token = token;
}

export function getAuthToken(): string | null {
  return state.token;
}

/**
 * Called once when an authenticated request comes back 401 UNAUTHORIZED (token expired or
 * revoked by a password change elsewhere). The `AuthProvider` uses it to drop the session.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  state.onUnauthorized = handler;
}

/** Test seam: inject a fake `fetch` and/or base URL. Pass `{}` to restore the defaults. */
export function configureApiClient(options: { fetch?: FetchLike; baseUrl?: string }): void {
  state.fetch = options.fetch ?? ((input, init) => fetch(input, init));
  state.baseUrl = options.baseUrl ?? API_URL;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params: string[] = [];
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return `${state.baseUrl}${path}${params.length > 0 ? `?${params.join('&')}` : ''}`;
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * Low-level fetch wrapper for the native app: JSON in/out, `Authorization: Bearer <token>` when
 * signed in (no cookies), response validated with the shared Zod schema. Throws `ApiError` on
 * network failures, timeouts, non-2xx responses and responses that do not match `schema`.
 * A caller-provided `signal` that aborts rethrows the original AbortError.
 */
export async function apiRequest<T = void>(
  path: string,
  options: RequestOptions<T> = {}
): Promise<T> {
  const { method = 'GET', body, query, schema, signal, headers } = options;
  const token = state.token;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => timeout.abort();
  signal?.addEventListener('abort', onCallerAbort);

  let res: Response;
  try {
    res = await state.fetch(buildUrl(path, query), {
      method,
      signal: timeout.signal,
      // Native clients authenticate with the Bearer header only; never send/keep cookies.
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (signal?.aborted && isAbortError(err)) throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Impossibile contattare il server OpenMusic');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  if (!res.ok) {
    const error = await ApiError.fromResponse(res);
    // Only a request that carried the current token can prove that token is dead.
    if (error.status === 401 && token !== null && token === state.token) state.onUnauthorized?.();
    throw error;
  }
  if (!schema || res.status === 204) return undefined as T;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, 'INVALID_RESPONSE', 'Risposta del server non valida');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    if (__DEV__) {
      console.error(`[api] ${method} ${path} response does not match its contract`, parsed.error);
    }
    throw new ApiError(res.status, 'INVALID_RESPONSE', 'Risposta del server non valida');
  }
  return parsed.data;
}

import type { ZodType, ZodTypeDef } from 'zod';
import { apiUrl } from './config';
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
  /** Extra headers (e.g. `cookie` when calling from a Server Component). */
  headers?: Record<string, string>;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = apiUrl(path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Low-level fetch wrapper. In the browser it calls the web app's own `/api` proxy, which forwards
 * the httpOnly session cookie to the API (`credentials: 'include'` is kept for same-site setups),
 * so no token ever lives in JS. Throws `ApiError` on network failures, non-2xx responses and responses
 * that do not match `schema`.
 */
export async function apiRequest<T = void>(
  path: string,
  options: RequestOptions<T> = {}
): Promise<T> {
  const { method = 'GET', body, query, schema, signal, headers } = options;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Impossibile contattare il server OpenMusic');
  }

  if (!res.ok) throw await ApiError.fromResponse(res);
  if (!schema || res.status === 204) return undefined as T;

  const json: unknown = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[api] ${method} ${path} response does not match its contract`, parsed.error);
    }
    throw new ApiError(res.status, 'INVALID_RESPONSE', 'Risposta del server non valida');
  }
  return parsed.data;
}

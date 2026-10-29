import { z } from 'zod';

/** Machine-readable error codes returned by every API error response. */
export const ApiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR', // 400: body/query/params failed the shared Zod schema
  'BAD_REQUEST', // 400
  'UNAUTHORIZED', // 401: missing/invalid/expired session
  'INVALID_CREDENTIALS', // 401: wrong email or password
  'FORBIDDEN', // 403: authenticated but not allowed (role/ownership)
  'NOT_FOUND', // 404
  'CONFLICT', // 409: e.g. email/username already taken
  'RATE_LIMITED', // 429
  'UPSTREAM_ERROR', // 502: Spotify/Last.fm/Deezer failure
  'NOT_CONFIGURED', // 503: optional integration without credentials on this server
  'INTERNAL_ERROR', // 500: never carries internal details
]);

/**
 * Body of every non-2xx response. `fieldErrors` is present only for VALIDATION_ERROR and maps a
 * dotted field path (e.g. `"password"`, `"vibeTags.0"`) to human-readable messages.
 */
export const ApiErrorBodySchema = z.object({
  statusCode: z.number().int(),
  code: ApiErrorCodeSchema,
  message: z.string(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
});

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

import { z } from 'zod';

/**
 * ADR-013: the API reads Spotify and Last.fm in the background ("automatic sync").
 * - `ACTIVE`: the account is polled;
 * - `ERROR`: the provider refused the account (token revoked, access denied, private profile):
 *   polling stopped until the user links it again;
 * - `PAUSED`: the user has not opened OpenMusic for a while; polling resumes on the next visit.
 */
export const ProviderSyncStatusSchema = z.enum(['ACTIVE', 'ERROR', 'PAUSED']);

/** Why the last read failed. Messages for people are in `PROVIDER_SYNC_ERROR_MESSAGES`. */
export const ProviderSyncErrorCodeSchema = z.enum([
  'TOKEN_REVOKED', // Spotify refresh token refused: the user must link the account again
  'ACCESS_DENIED', // Spotify 403 (e.g. app in Development Mode and user not allowlisted)
  'ACCOUNT_NOT_FOUND', // Last.fm user no longer exists
  'PRIVATE_PROFILE', // Last.fm "recent listening" hidden by the user's privacy settings
  'RATE_LIMITED', // provider asked us to slow down (temporary)
  'UPSTREAM_ERROR', // provider unreachable or 5xx (temporary)
  'NOT_CONFIGURED', // missing/invalid API credentials on the server (temporary for the user)
]);

export const PROVIDER_SYNC_ERROR_MESSAGES: Record<ProviderSyncErrorCode, string> = {
  TOKEN_REVOKED: 'L’autorizzazione è scaduta o è stata revocata: ricollega l’account.',
  ACCESS_DENIED: 'Il servizio ha rifiutato l’accesso a questo account: ricollegalo per riprovare.',
  ACCOUNT_NOT_FOUND: 'L’account non esiste più sul servizio: ricollegalo.',
  PRIVATE_PROFILE: 'I tuoi ascolti recenti sono privati: rendili pubblici e ricollega l’account.',
  RATE_LIMITED: 'Il servizio ci ha chiesto di rallentare: riproviamo tra poco.',
  UPSTREAM_ERROR: 'Il servizio non risponde: riproviamo tra poco.',
  NOT_CONFIGURED: 'La sincronizzazione non è configurata su questo server.',
};

export const SyncedProviderSchema = z.enum(['SPOTIFY', 'LASTFM']);

export const ProviderSyncInfoSchema = z.object({
  provider: SyncedProviderSchema,
  linked: z.boolean(),
  /** null when not linked. */
  status: ProviderSyncStatusSchema.nullable(),
  /** Last successful read (ISO), null if never. */
  lastSyncedAt: z.string().nullable(),
  lastErrorCode: ProviderSyncErrorCodeSchema.nullable(),
  /** Italian, ready to show; null when the last read succeeded. */
  lastError: z.string().nullable(),
  /** Seconds until the next background read; null when nothing is scheduled. */
  nextPollInSeconds: z.number().int().nonnegative().nullable(),
});

/** `GET /api/now-playing/sync-status` */
export const NowPlayingSyncStatusSchema = z.object({
  /** false when the server runs with NOW_PLAYING_POLLER_ENABLED=false (manual sync only). */
  autoSyncEnabled: z.boolean(),
  providers: z.object({
    SPOTIFY: ProviderSyncInfoSchema,
    LASTFM: ProviderSyncInfoSchema,
  }),
});

export type ProviderSyncStatus = z.infer<typeof ProviderSyncStatusSchema>;
export type ProviderSyncErrorCode = z.infer<typeof ProviderSyncErrorCodeSchema>;
export type SyncedProvider = z.infer<typeof SyncedProviderSchema>;
export type ProviderSyncInfo = z.infer<typeof ProviderSyncInfoSchema>;
export type NowPlayingSyncStatus = z.infer<typeof NowPlayingSyncStatusSchema>;

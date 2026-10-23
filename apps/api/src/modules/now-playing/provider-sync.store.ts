import type { PrismaClient, ProviderSyncStatus as DbSyncStatus } from '@openmusic/db';
import {
  PROVIDER_SYNC_ERROR_MESSAGES,
  ProviderSyncErrorCodeSchema,
  type NowPlayingSyncStatus,
  type ProviderSyncErrorCode,
  type ProviderSyncInfo,
  type SyncedProvider,
} from '@openmusic/shared';
import { systemClock, type Clock } from '../../lib/upstream';

export const SYNCED_PROVIDERS: readonly SyncedProvider[] = ['SPOTIFY', 'LASTFM'];

/** `lastSyncedAt` is rewritten at most this often while nothing else changes (DB load). */
const SUCCESS_WRITE_INTERVAL_MS = 60_000;

/** The account columns the poller reads and compares before writing. */
export interface SyncedAccount {
  id: string;
  provider: string;
  providerId: string;
  syncStatus: DbSyncStatus;
  lastSyncedAt: Date | null;
  syncError: string | null;
}

/**
 * Per-account sync state in `ConnectedAccount` (ADR-013): `syncStatus` ACTIVE / ERROR / PAUSED,
 * `lastSyncedAt`, `syncError` (a `ProviderSyncErrorCode`). Writes are skipped when nothing
 * changed, so a poll every 25 s does not mean a DB write every 25 s.
 */
export class ProviderSyncStore {
  private readonly clock: Clock;

  constructor(
    private readonly prisma: PrismaClient,
    clock?: Clock
  ) {
    this.clock = clock ?? systemClock;
  }

  async markSuccess(account: SyncedAccount): Promise<void> {
    const now = this.clock.now();
    const fresh =
      account.lastSyncedAt !== null &&
      now - account.lastSyncedAt.getTime() < SUCCESS_WRITE_INTERVAL_MS;
    if (fresh && account.syncError === null && account.syncStatus === 'ACTIVE') return;
    await this.prisma.connectedAccount.updateMany({
      // Never resurrect an account the user unlinked or that failed meanwhile.
      where: { id: account.id, syncStatus: 'ACTIVE' },
      data: { lastSyncedAt: new Date(now), syncError: null },
    });
  }

  /**
   * Records a failure. `stop` = the account cannot be read again until it is linked again
   * (status ERROR, polling stops); otherwise the status stays ACTIVE and only the code changes.
   */
  async markError(
    account: Pick<SyncedAccount, 'id' | 'syncStatus' | 'syncError'>,
    code: ProviderSyncErrorCode,
    stop: boolean
  ): Promise<void> {
    const status: DbSyncStatus = stop ? 'ERROR' : account.syncStatus;
    if (account.syncError === code && account.syncStatus === status) return;
    // Compare-and-set on the status the caller read: a poll that started before the account
    // was revoked by the manual sync, paused by the sweep or unlinked must not write a stale
    // status (ERROR/PAUSED -> ACTIVE) or overwrite a more precise code (TOKEN_REVOKED).
    await this.prisma.connectedAccount.updateMany({
      where: { id: account.id, syncStatus: account.syncStatus },
      data: { syncError: code, syncStatus: status },
    });
  }

  /** Stops polling `provider` for the user (used by the manual sync on a revoked token). */
  async markErrorFor(
    userId: string,
    provider: SyncedProvider,
    code: ProviderSyncErrorCode
  ): Promise<void> {
    await this.prisma.connectedAccount.updateMany({
      where: { userId, provider },
      data: { syncStatus: 'ERROR', syncError: code },
    });
  }

  async markSuccessFor(userId: string, provider: SyncedProvider): Promise<void> {
    await this.prisma.connectedAccount.updateMany({
      where: { userId, provider, syncStatus: 'ACTIVE' },
      data: { lastSyncedAt: new Date(this.clock.now()), syncError: null },
    });
  }

  /** User idle for too long: stop reading their accounts until they come back. */
  async pauseUser(userId: string): Promise<void> {
    await this.prisma.connectedAccount.updateMany({
      where: { userId, syncStatus: 'ACTIVE', provider: { in: [...SYNCED_PROVIDERS] } },
      data: { syncStatus: 'PAUSED' },
    });
  }

  /** User is back: resume accounts paused for inactivity. Returns how many were resumed. */
  async resumeUser(userId: string): Promise<number> {
    const { count } = await this.prisma.connectedAccount.updateMany({
      where: { userId, syncStatus: 'PAUSED' },
      data: { syncStatus: 'ACTIVE' },
    });
    return count;
  }

  /** `GET /api/now-playing/sync-status` */
  async getStatus(
    userId: string,
    options: { autoSyncEnabled: boolean; nextDueAt: number | null }
  ): Promise<NowPlayingSyncStatus> {
    const accounts = await this.prisma.connectedAccount.findMany({
      where: { userId, provider: { in: [...SYNCED_PROVIDERS] } },
      select: { provider: true, syncStatus: true, lastSyncedAt: true, syncError: true },
    });
    const now = this.clock.now();
    const info = (provider: SyncedProvider): ProviderSyncInfo => {
      const account = accounts.find((a) => a.provider === provider);
      if (!account) {
        return {
          provider,
          linked: false,
          status: null,
          lastSyncedAt: null,
          lastErrorCode: null,
          lastError: null,
          nextPollInSeconds: null,
        };
      }
      const code = ProviderSyncErrorCodeSchema.safeParse(account.syncError);
      const polled = options.autoSyncEnabled && account.syncStatus === 'ACTIVE';
      return {
        provider,
        linked: true,
        status: account.syncStatus,
        lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
        lastErrorCode: code.success ? code.data : null,
        lastError: code.success ? PROVIDER_SYNC_ERROR_MESSAGES[code.data] : null,
        nextPollInSeconds:
          polled && options.nextDueAt !== null
            ? Math.max(0, Math.ceil((options.nextDueAt - now) / 1000))
            : null,
      };
    };
    return {
      autoSyncEnabled: options.autoSyncEnabled,
      providers: { SPOTIFY: info('SPOTIFY'), LASTFM: info('LASTFM') },
    };
  }
}

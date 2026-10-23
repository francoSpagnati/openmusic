import { Prisma, type PrismaClient } from '@openmusic/db';
import type {
  ChangePasswordInput,
  ConnectedAccountInfo,
  ConnectedProvider,
  MeResponse,
  UpdateProfileSchema,
} from '@openmusic/shared';
import type { RegisterInputSchema, LoginInputSchema } from '@openmusic/shared';
import type { z } from 'zod';
import {
  BadRequestError,
  ConflictError,
  InvalidCredentialsError,
  NotFoundError,
} from '../../lib/errors';
import { toAuthUser } from '../../lib/mappers';
import { getDummyHash, hashPassword, verifyPassword } from '../../lib/password';
import type { SpotifyService } from './spotify.service';
import type { LastFmService } from './lastfm.service';

type RegisterData = z.output<typeof RegisterInputSchema>;
type LoginData = z.output<typeof LoginInputSchema>;
/** Ghost Mode is excluded: it goes through `NowPlayingService.setGhostMode` (presence + flag). */
type UpdateProfileData = Omit<z.output<typeof UpdateProfileSchema>, 'isGhostMode'>;

const PROVIDERS: readonly ConnectedProvider[] = ['SPOTIFY', 'LASTFM', 'APPLE_MUSIC'];

function isProvider(value: string): value is ConnectedProvider {
  return (PROVIDERS as readonly string[]).includes(value);
}

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly spotifyService: SpotifyService,
    private readonly lastFmService: LastFmService
  ) {}

  // ---------------------------------------------------------------------------
  // Local accounts (email + password)
  // ---------------------------------------------------------------------------

  async register(input: RegisterData): Promise<MeResponse> {
    const passwordHash = await hashPassword(input.password);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          username: input.username,
          displayName: input.displayName ?? null,
          favoriteGenres: input.favoriteGenres,
          passwordHash,
        },
      });
      return this.getUserSessionData(user.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = String(err.meta?.target ?? '');
        throw new ConflictError(
          target.includes('username') ? 'Username già in uso' : 'Email già registrata'
        );
      }
      throw err;
    }
  }

  /** Verifies credentials in constant-ish time whether or not the email exists. */
  async login(input: LoginData): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true },
    });
    const hash = user?.passwordHash ?? (await getDummyHash());
    const valid = await verifyPassword(input.password, hash);
    if (!user || !user.passwordHash || !valid) throw new InvalidCredentialsError();
    return this.getUserSessionData(user.id);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundError('Utente non trovato');
    // OAuth-only accounts may set a first password without a current one.
    if (user.passwordHash && !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new InvalidCredentialsError();
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(input.newPassword),
        sessionVersion: { increment: 1 },
      },
    });
  }

  async updateProfile(userId: string, input: UpdateProfileData): Promise<MeResponse> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName,
        bio: input.bio,
        avatarUrl: input.avatarUrl,
        favoriteGenres: input.favoriteGenres,
      },
    });
    return this.getUserSessionData(userId);
  }

  // ---------------------------------------------------------------------------
  // Optional linked accounts (Spotify / Last.fm)
  // ---------------------------------------------------------------------------

  getSpotifyAuthUrl(state?: string): string {
    return this.spotifyService.getAuthorizationUrl(state);
  }

  getLastFmAuthUrl(state?: string): string {
    return this.lastFmService.getAuthorizationUrl(state);
  }

  /**
   * Links Spotify to the signed-in user, signs in the owner of an already linked Spotify account,
   * or creates a new OAuth-only user. It never auto-links to an existing account by email:
   * that would let anyone controlling a Spotify account with the same address take it over.
   */
  async handleSpotifyCallback(code: string, currentUserId?: string): Promise<MeResponse> {
    const tokens = await this.spotifyService.exchangeCode(code);
    const profile = await this.spotifyService.fetchUserProfile(tokens.accessToken);
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    const tokenData = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      // (Re)linking resets the automatic sync (ADR-013): a revoked account becomes ACTIVE again.
      syncStatus: 'ACTIVE' as const,
      syncError: null,
    };

    const existing = await this.prisma.connectedAccount.findUnique({
      where: { provider_providerId: { provider: 'SPOTIFY', providerId: profile.id } },
    });

    if (existing) {
      if (currentUserId && existing.userId !== currentUserId) {
        throw new ConflictError('Questo account Spotify è già collegato a un altro utente');
      }
      await this.prisma.connectedAccount.update({ where: { id: existing.id }, data: tokenData });
      return this.getUserSessionData(existing.userId);
    }

    if (currentUserId) {
      await this.prisma.connectedAccount.create({
        data: { userId: currentUserId, provider: 'SPOTIFY', providerId: profile.id, ...tokenData },
      });
      return this.getUserSessionData(currentUserId);
    }

    const emailTaken = await this.prisma.user.findUnique({
      where: { email: profile.email.toLowerCase() },
      select: { id: true },
    });
    if (emailTaken) {
      throw new ConflictError(
        'Esiste già un account con questa email: accedi e collega Spotify dalle impostazioni'
      );
    }

    const baseUsername = (profile.displayName ?? profile.id)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20);
    const username = `${baseUsername || 'listener'}_${Math.floor(1000 + Math.random() * 9000)}`;

    const user = await this.prisma.user.create({
      data: {
        username,
        displayName: profile.displayName,
        email: profile.email.toLowerCase(),
        avatarUrl: profile.avatarUrl,
        connectedAccounts: {
          create: { provider: 'SPOTIFY', providerId: profile.id, ...tokenData },
        },
      },
    });
    return this.getUserSessionData(user.id);
  }

  /** Links a Last.fm account to the signed-in user. */
  async handleLastFmCallback(token: string, userId: string): Promise<MeResponse> {
    const session = await this.lastFmService.getSession(token);

    const existing = await this.prisma.connectedAccount.findUnique({
      where: { provider_providerId: { provider: 'LASTFM', providerId: session.name } },
      select: { userId: true },
    });
    if (existing && existing.userId !== userId) {
      // Never move a link silently: scrobbles drive verified listens for its current owner.
      throw new ConflictError('Questo account Last.fm è già collegato a un altro utente');
    }

    await this.prisma.connectedAccount.upsert({
      where: { provider_providerId: { provider: 'LASTFM', providerId: session.name } },
      update: { accessToken: session.sessionKey, syncStatus: 'ACTIVE', syncError: null },
      create: {
        userId,
        provider: 'LASTFM',
        providerId: session.name,
        accessToken: session.sessionKey,
      },
    });

    return this.getUserSessionData(userId);
  }

  async disconnectProvider(userId: string, provider: ConnectedProvider): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, _count: { select: { connectedAccounts: true } } },
    });
    if (!user) throw new NotFoundError('Utente non trovato');
    if (!user.passwordHash && user._count.connectedAccounts <= 1) {
      throw new BadRequestError(
        'Imposta una password prima di scollegare il tuo unico metodo di accesso'
      );
    }
    await this.prisma.connectedAccount.deleteMany({ where: { userId, provider } });
    return this.getUserSessionData(userId);
  }

  /** Full profile (private fields included) plus linked accounts, for the session owner. */
  async getUserSessionData(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        connectedAccounts: {
          select: { id: true, provider: true, providerId: true, expiresAt: true },
        },
      },
    });

    if (!user) throw new NotFoundError('Utente non trovato');

    const connectedAccounts: ConnectedAccountInfo[] = user.connectedAccounts.flatMap((acc) =>
      isProvider(acc.provider)
        ? [
            {
              id: acc.id,
              provider: acc.provider,
              providerId: acc.providerId,
              expiresAt: acc.expiresAt?.toISOString() ?? null,
            },
          ]
        : []
    );

    return { user: toAuthUser(user), connectedAccounts };
  }
}

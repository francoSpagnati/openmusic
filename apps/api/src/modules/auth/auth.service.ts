import type { PrismaClient } from '@prisma/client';
import type { AuthUser, ConnectedAccountInfo } from '@openmusic/shared';
import type { SpotifyService } from './spotify.service';
import type { LastFmService } from './lastfm.service';

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly spotifyService: SpotifyService,
    private readonly lastFmService: LastFmService
  ) {}

  getSpotifyAuthUrl(state?: string): string {
    return this.spotifyService.getAuthorizationUrl(state);
  }

  getLastFmAuthUrl(callbackUrl?: string): string {
    return this.lastFmService.getAuthorizationUrl(callbackUrl);
  }

  /**
   * Connette o registra un utente tramite Spotify OAuth.
   * Se l'account Spotify è già collegato, autentica l'utente esistente.
   * Altrimenti associa l'account o crea un nuovo utente.
   */
  async handleSpotifyCallback(
    code: string,
    currentUserId?: string
  ): Promise<{ user: AuthUser; connectedAccounts: ConnectedAccountInfo[] }> {
    const tokens = await this.spotifyService.exchangeCode(code);
    const profile = await this.spotifyService.fetchUserProfile(tokens.accessToken);

    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    // 1. Controlla se l'account Spotify è già collegato
    const existingConnection = await this.prisma.connectedAccount.findUnique({
      where: {
        provider_providerId: {
          provider: 'SPOTIFY',
          providerId: profile.id,
        },
      },
      include: { user: true },
    });

    let userId: string;

    if (existingConnection) {
      userId = existingConnection.userId;
      // Aggiorna i token
      await this.prisma.connectedAccount.update({
        where: { id: existingConnection.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt,
        },
      });
    } else if (currentUserId) {
      // L'utente è già loggato e sta collegando Spotify al suo profilo
      userId = currentUserId;
      await this.prisma.connectedAccount.create({
        data: {
          userId,
          provider: 'SPOTIFY',
          providerId: profile.id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt,
        },
      });
    } else {
      // 2. Cerca per email o crea un nuovo utente
      let user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (!user) {
        // Genera uno username univoco basato sul display name o sull'id Spotify
        const baseUsername = (profile.displayName ?? profile.id)
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 20);
        const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
        const username = `${baseUsername || 'listener'}_${uniqueSuffix}`;

        user = await this.prisma.user.create({
          data: {
            username,
            displayName: profile.displayName,
            email: profile.email,
            avatarUrl: profile.avatarUrl,
          },
        });
      }

      userId = user.id;

      await this.prisma.connectedAccount.create({
        data: {
          userId,
          provider: 'SPOTIFY',
          providerId: profile.id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt,
        },
      });
    }

    return this.getUserSessionData(userId);
  }

  /**
   * Collega un account Last.fm all'utente specificato
   */
  async handleLastFmCallback(
    token: string,
    userId: string
  ): Promise<{ user: AuthUser; connectedAccounts: ConnectedAccountInfo[] }> {
    const session = await this.lastFmService.getSession(token);

    const existing = await this.prisma.connectedAccount.findUnique({
      where: {
        provider_providerId: {
          provider: 'LASTFM',
          providerId: session.name,
        },
      },
    });

    if (existing) {
      await this.prisma.connectedAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: session.sessionKey,
          userId,
        },
      });
    } else {
      await this.prisma.connectedAccount.create({
        data: {
          userId,
          provider: 'LASTFM',
          providerId: session.name,
          accessToken: session.sessionKey,
        },
      });
    }

    return this.getUserSessionData(userId);
  }

  /**
   * Recupera il profilo completo e gli account collegati per la sessione
   */
  async getUserSessionData(
    userId: string
  ): Promise<{ user: AuthUser; connectedAccounts: ConnectedAccountInfo[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        connectedAccounts: {
          select: {
            id: true,
            provider: true,
            providerId: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      isGhostMode: user.isGhostMode,
      createdAt: user.createdAt.toISOString(),
    };

    const connectedAccounts: ConnectedAccountInfo[] = user.connectedAccounts.map((acc) => ({
      id: acc.id,
      provider: acc.provider as 'SPOTIFY' | 'LASTFM' | 'APPLE_MUSIC',
      providerId: acc.providerId,
      expiresAt: acc.expiresAt?.toISOString() ?? null,
    }));

    return { user: authUser, connectedAccounts };
  }
}

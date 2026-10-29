import type { ApiErrorCode } from '@openmusic/shared';

/**
 * Expected, client-facing failures. The central error handler turns these into
 * `{ statusCode, code, message }`; anything else becomes an opaque 500.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Richiesta non valida') {
    super(400, 'BAD_REQUEST', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Autenticazione richiesta') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(401, 'INVALID_CREDENTIALS', 'Email o password non corretti');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Operazione non consentita') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Risorsa non trovata') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

/**
 * A third-party provider (Spotify, Last.fm) failed. `detail` is logged server-side only; the
 * client sees a generic message.
 */
/** An optional integration (Spotify, Last.fm) has no credentials on this server. */
export class NotConfiguredError extends AppError {
  constructor(provider: string) {
    super(503, 'NOT_CONFIGURED', `${provider} non è configurato su questo server`);
  }
}

export class UpstreamError extends AppError {
  constructor(
    readonly provider: string,
    readonly detail: string
  ) {
    super(502, 'UPSTREAM_ERROR', `Il servizio ${provider} non è al momento raggiungibile`);
  }
}

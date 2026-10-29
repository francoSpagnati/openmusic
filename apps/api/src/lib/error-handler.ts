import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@openmusic/db';
import type { ApiErrorBody, ApiErrorCode } from '@openmusic/shared';
import { AppError, NotConfiguredError, UpstreamError } from './errors';

function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  return 'BAD_REQUEST';
}

function isFastifyError(error: unknown): error is FastifyError {
  return error instanceof Error && typeof (error as FastifyError).statusCode === 'number';
}

/** Maps any thrown error to a typed `ApiErrorBody`. Never leaks internals on 5xx. */
export function toApiError(error: unknown): ApiErrorBody {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dati non validi',
      fieldErrors: zodFieldErrors(error),
    };
  }
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, code: error.code, message: error.message };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2025':
        return { statusCode: 404, code: 'NOT_FOUND', message: 'Risorsa non trovata' };
      case 'P2002':
        return { statusCode: 409, code: 'CONFLICT', message: 'Risorsa già esistente' };
      case 'P2003':
        return {
          statusCode: 400,
          code: 'BAD_REQUEST',
          message: 'Riferimento a una risorsa inesistente',
        };
    }
  }
  if (isFastifyError(error)) {
    const status = error.statusCode ?? 500;
    if (status === 401) {
      // @fastify/jwt errors (missing/expired/malformed token)
      return { statusCode: 401, code: 'UNAUTHORIZED', message: 'Sessione non valida o scaduta' };
    }
    if (status === 429) {
      return {
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Troppe richieste, riprova tra poco',
      };
    }
    if (status >= 400 && status < 500) {
      // Fastify's own 4xx (invalid JSON, unsupported media type, body too large) are safe to show.
      return { statusCode: status, code: codeForStatus(status), message: error.message };
    }
  }
  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Errore interno del server' };
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const body = toApiError(error);
    if (error instanceof NotConfiguredError) {
      // Expected on servers without optional credentials: not a crash.
      request.log.warn(error.message);
    } else if (body.statusCode >= 500) {
      request.log.error({ err: error }, 'Unhandled error');
    } else if (error instanceof UpstreamError) {
      request.log.warn({ provider: error.provider, detail: error.detail }, 'Upstream error');
    }
    return reply.status(body.statusCode).send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    const body: ApiErrorBody = {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url.split('?')[0]} non trovata`,
    };
    return reply.status(404).send(body);
  });
}

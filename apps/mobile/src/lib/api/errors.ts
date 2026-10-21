import { ApiErrorBodySchema, type ApiErrorCode } from '@openmusic/shared';

/** Client-side failures that never reached (or never came back from) the API. */
export type ClientErrorCode = 'NETWORK_ERROR' | 'INVALID_RESPONSE';

/**
 * Every failed API call rejects with an `ApiError` (same shape as the web client). `status` is 0
 * for network errors and timeouts. `fieldErrors` maps a field path (e.g. `"password"`) to
 * messages for VALIDATION_ERROR.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | ClientErrorCode;
  readonly fieldErrors: Record<string, string[]>;

  constructor(
    status: number,
    code: ApiErrorCode | ClientErrorCode,
    message: string,
    fieldErrors: Record<string, string[]> = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** First message for a form field, for inline errors. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      // Non-JSON error (proxy, crash page): fall through to a generic error.
    }
    const parsed = ApiErrorBodySchema.safeParse(payload);
    if (parsed.success) {
      const { statusCode, code, message, fieldErrors } = parsed.data;
      return new ApiError(statusCode, code, message, fieldErrors);
    }
    return new ApiError(
      res.status,
      res.status === 401 ? 'UNAUTHORIZED' : res.status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
      res.statusText || 'Richiesta non riuscita'
    );
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

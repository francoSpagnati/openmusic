import type { ZodError } from 'zod';
import { isApiError } from '@/lib/api';
import { errorMessage } from './format';

/** Field name → first message. `_form` holds errors that belong to no single field. */
export type FormErrors = Record<string, string>;

export const FORM_ERROR = '_form';

export function zodFormErrors(error: ZodError): FormErrors {
  const out: FormErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : FORM_ERROR;
    out[key] ??= issue.message;
  }
  return out;
}

/** Maps an API failure to inline errors; anything without a field becomes a form error. */
export function apiFormErrors(error: unknown, fallback?: string): FormErrors {
  if (isApiError(error) && Object.keys(error.fieldErrors).length > 0) {
    const out: FormErrors = {};
    for (const [path, messages] of Object.entries(error.fieldErrors)) {
      const key = path.split('.')[0] || FORM_ERROR;
      if (messages[0]) out[key] ??= messages[0];
    }
    return out;
  }
  return { [FORM_ERROR]: errorMessage(error, fallback) };
}

/** Moves focus to the first invalid control so keyboard and screen-reader users land on it. */
export function focusFirstError(
  form: HTMLFormElement | null,
  errors: FormErrors,
  /** Error keys in visual order; `[key, inputName]` when the input's name differs. */
  order: ReadonlyArray<string | readonly [string, string]>
) {
  if (!form) return;
  for (const entry of order) {
    const [key, name] = typeof entry === 'string' ? [entry, entry] : entry;
    if (errors[key]) {
      form.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();
      return;
    }
  }
}

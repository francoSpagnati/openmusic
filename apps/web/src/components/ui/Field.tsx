'use client';

import React from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { cn } from './cn';

/** Props a Field hands to its control so label, hint and error are wired for AT. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

export interface FieldProps {
  label: React.ReactNode;
  /** Help text shown under the control. */
  hint?: React.ReactNode;
  /** Error message: human, actionable ("Serve almeno 8 caratteri"), never a code. */
  error?: React.ReactNode;
  required?: boolean;
  /** Visually hide the label (still announced). Use only when context makes it obvious. */
  hideLabel?: boolean;
  /** Provide to control the generated id. */
  id?: string;
  className?: string;
  /** Optional counter or action shown on the label row (e.g. "120/3000"). */
  aside?: React.ReactNode;
  children: (control: FieldControlProps) => React.ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required,
  hideLabel,
  id,
  className,
  aside,
  children,
}: FieldProps) {
  const generated = React.useId();
  const controlId = id ?? `field-${generated}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className={cn('flex items-baseline justify-between gap-2', hideLabel && 'sr-only')}>
        <label htmlFor={controlId} className="text-sm font-medium text-fg">
          {label}
          {required && (
            <span className="ml-0.5 text-fg-subtle" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {aside && <span className="font-mono text-xs tabular-nums text-fg-subtle">{aside}</span>}
      </div>
      {children({
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-rotten">
          <WarningCircle aria-hidden="true" weight="fill" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-sm text-fg-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Shared look for text-like controls; exported for selects or custom inputs.
 * Paper field, 3:1 boundary, and on focus a 2px clay edge (border + 1px ring) instead of an
 * offset outline, so the ring hugs the field.
 */
export const controlClasses =
  'w-full rounded-md border border-line-strong bg-surface-raised px-3 text-fg placeholder:text-fg-subtle ' +
  'transition-[border-color,box-shadow] duration-fast ease-out ' +
  'hover:border-fg-subtle focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus ' +
  'aria-[invalid=true]:border-rotten aria-[invalid=true]:focus:ring-rotten ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

type FieldOwnProps = Omit<FieldProps, 'children' | 'className'> & { fieldClassName?: string };

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'>, FieldOwnProps {
  leadingIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    required,
    hideLabel,
    id,
    aside,
    fieldClassName,
    leadingIcon,
    className,
    ...rest
  },
  ref
) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      hideLabel={hideLabel}
      id={id}
      aside={aside}
      className={fieldClassName}
    >
      {(control) => (
        <div className="relative">
          {leadingIcon && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle"
            >
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            required={required}
            className={cn(
              controlClasses,
              'h-11 text-base sm:text-sm',
              leadingIcon ? 'pl-10' : undefined,
              className
            )}
            {...control}
            {...rest}
          />
        </div>
      )}
    </Field>
  );
});

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>, FieldOwnProps {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hint,
    error,
    required,
    hideLabel,
    id,
    aside,
    fieldClassName,
    className,
    rows = 4,
    ...rest
  },
  ref
) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      hideLabel={hideLabel}
      id={id}
      aside={aside}
      className={fieldClassName}
    >
      {(control) => (
        <textarea
          ref={ref}
          rows={rows}
          required={required}
          className={cn(
            controlClasses,
            'resize-y py-2.5 text-base leading-relaxed sm:text-sm [field-sizing:content] min-h-[6rem]',
            className
          )}
          {...control}
          {...rest}
        />
      )}
    </Field>
  );
});

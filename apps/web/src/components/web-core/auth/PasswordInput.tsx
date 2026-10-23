'use client';

import React, { useState } from 'react';
import { Eye, EyeSlash, LockKey } from '@phosphor-icons/react';
import { Field, cn, controlClasses } from '@/components/ui';

export interface PasswordInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'id'
> {
  /** Stable id/name: `current-password` or `new-password` so password managers understand it. */
  id: 'current-password' | 'new-password';
  label: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  aside?: React.ReactNode;
}

/** Password field with a "show password" toggle. Pasting is always allowed. */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ id, label, hint, error, aside, required, className, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <Field id={id} label={label} hint={hint} error={error} required={required} aside={aside}>
        {(control) => (
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle"
            >
              <LockKey />
            </span>
            <input
              ref={ref}
              name={id}
              type={visible ? 'text' : 'password'}
              required={required}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={cn(controlClasses, 'h-11 pl-10 pr-12 text-base sm:text-sm', className)}
              {...control}
              {...rest}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-pressed={visible}
              aria-controls={id}
              aria-label={visible ? 'Nascondi password' : 'Mostra password'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-fg-subtle hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            >
              {visible ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
        )}
      </Field>
    );
  }
);

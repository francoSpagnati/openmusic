'use client';

import React from 'react';
import { Desktop, Moon, Sun } from '@phosphor-icons/react';
import { useTheme, type ThemePreference } from '../../lib/theme';
import { cn } from './cn';
import { IconButton, type IconButtonSize } from './IconButton';

export type ThemeToggleVariant = 'segmented' | 'icon';

export interface ThemeToggleProps {
  /**
   * `segmented` (default): three explicit options (Chiaro / Scuro / Sistema), for settings.
   * `icon`: a single two-state button for crowded chrome (header, sidebar footer). It flips
   * to the opposite of what is painted; flipping back to the OS value clears the choice.
   */
  variant?: ThemeToggleVariant;
  /** Size of the `icon` variant. */
  size?: IconButtonSize;
  /** Accessible group name of the `segmented` variant. */
  label?: string;
  className?: string;
}

const names: Record<'light' | 'dark', string> = { light: 'chiaro', dark: 'scuro' };

const options: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Chiaro', Icon: Sun },
  { value: 'dark', label: 'Scuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Desktop },
];

/** Light / dark / system switch. Needs <ThemeProvider> (mounted in the root layout). */
export function ThemeToggle({
  variant = 'segmented',
  size = 'md',
  label = 'Tema',
  className,
}: ThemeToggleProps) {
  const { preference, resolved, system, setPreference } = useTheme();
  const name = React.useId();

  if (variant === 'icon') {
    const target = resolved === 'dark' ? 'light' : 'dark';
    return (
      <IconButton
        label={`Passa al tema ${names[target]}`}
        icon={resolved === 'dark' ? <Moon weight="regular" /> : <Sun weight="regular" />}
        size={size}
        className={className}
        onClick={() => setPreference(target === system ? 'system' : target)}
      />
    );
  }

  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="sr-only">{label}</legend>
      <div className="inline-flex rounded-lg border border-line bg-sunken p-1">
        {options.map(({ value, label: optionLabel, Icon }) => {
          const checked = preference === value;
          return (
            <label
              key={value}
              className={cn(
                'relative inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-md px-3 text-sm font-medium',
                'transition-[background-color,color,box-shadow] duration-fast ease-out',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                checked
                  ? 'bg-surface-raised text-fg shadow-hairline forced-colors:border forced-colors:border-[Highlight]'
                  : 'text-fg-muted hover:text-fg'
              )}
            >
              <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                onChange={() => setPreference(value)}
                className="sr-only"
              />
              <Icon aria-hidden="true" weight={checked ? 'fill' : 'regular'} className="h-4 w-4" />
              <span>
                {optionLabel}
                {value === 'system' && <span className="sr-only">{`, ora ${names[system]}`}</span>}
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-fg-subtle">
        {preference === 'system'
          ? `Segue il sistema, ora ${names[system]}.`
          : `Tema ${names[preference]} scelto per questo dispositivo.`}
      </p>
    </fieldset>
  );
}

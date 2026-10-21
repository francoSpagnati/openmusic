import React from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold ' +
  'transition-[background-color,border-color,color,box-shadow,translate] duration-fast ease-standard ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress active:translate-y-px';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-on-accent hover:bg-accent-strong ' +
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.18),inset_0_-2px_0_rgb(0_0_0/0.12)]',
  secondary: 'bg-elevated text-ink border border-line hover:border-line-strong hover:bg-surface',
  outline: 'border border-line-strong text-ink hover:border-ink hover:bg-ink/5',
  ghost: 'text-ink-secondary hover:bg-ink/5 hover:text-ink',
  danger: 'border border-rotten/60 text-rotten hover:bg-rotten/10',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-md px-3 text-sm',
  md: 'h-10 rounded-md px-4 text-sm',
  lg: 'h-12 rounded-lg px-6 text-base',
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** Button classes, for styling a Next `<Link>` or `<a>` as a button. */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, Omit<ButtonStyleOptions, 'className'> {
  /** Shows a spinner, sets aria-busy and blocks clicks while keeping the label for layout. */
  loading?: boolean;
  /** Text announced while loading (defaults to the visible label). */
  loadingLabel?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth,
    loading = false,
    loadingLabel,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    type = 'button',
    onClick,
    ...rest
  },
  ref
) {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      onClick={handleClick}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size={size === 'lg' ? 'md' : 'sm'} label={null} />
        </span>
      )}
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {leadingIcon && (
          <span aria-hidden="true" className="inline-flex">
            {leadingIcon}
          </span>
        )}
        {children}
        {trailingIcon && (
          <span aria-hidden="true" className="inline-flex">
            {trailingIcon}
          </span>
        )}
      </span>
      {loading && loadingLabel && <span className="sr-only">{loadingLabel}</span>}
    </button>
  );
});

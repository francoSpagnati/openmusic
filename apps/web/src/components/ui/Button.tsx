import React from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'om-press relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-sans font-medium ' +
  'transition-[background-color,border-color,color,text-decoration-color] duration-fast ease-out ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress ' +
  // Windows High Contrast drops fills: keep a visible boundary on every variant.
  'forced-colors:border forced-colors:border-solid';

/* One clay fill per view (primary). Everything else is ink on paper with hairlines. */
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-hover',
  secondary:
    'border border-line bg-surface-raised text-fg hover:border-line-strong hover:bg-surface',
  outline: 'border border-line-strong text-fg hover:bg-fg/[0.04]',
  ghost: 'text-fg-muted hover:bg-fg/[0.05] hover:text-fg',
  danger: 'border border-rotten/50 text-rotten hover:border-rotten hover:bg-rotten/[0.06]',
  link: 'text-accent underline decoration-accent/35 underline-offset-4 hover:decoration-current',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-md px-3 text-sm',
  md: 'h-10 rounded-md px-4 text-sm',
  lg: 'h-12 rounded-lg px-5 text-base',
};

/* The link variant sits inline with text: no box, no fixed height. */
const linkSizes: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-base',
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
  return cn(
    base,
    variants[variant],
    variant === 'link' ? linkSizes[size] : sizes[size],
    fullWidth && 'w-full',
    className
  );
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

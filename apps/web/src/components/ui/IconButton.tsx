import React from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type IconButtonVariant = 'solid' | 'subtle' | 'ghost' | 'outline';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> {
  /** Required accessible name (also used as tooltip). */
  label: string;
  icon: React.ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  /** For toggle buttons (play/pause, like, ghost mode). */
  pressed?: boolean;
}

const variants: Record<IconButtonVariant, string> = {
  solid: 'bg-accent text-on-accent hover:bg-accent-strong shadow-om-sm',
  subtle: 'bg-elevated text-ink border border-line hover:border-line-strong',
  ghost: 'text-ink-secondary hover:bg-ink/5 hover:text-ink',
  outline: 'border border-line-strong text-ink hover:border-ink',
};

/* Minimum 32px; md/lg meet the 44px touch-target recommendation with padding */
const sizes: Record<IconButtonSize, string> = {
  sm: 'h-8 w-8 text-base',
  md: 'h-10 w-10 text-lg',
  lg: 'h-12 w-12 text-xl',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    variant = 'ghost',
    size = 'md',
    loading = false,
    pressed,
    className,
    type = 'button',
    title,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      aria-pressed={pressed}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'transition-[background-color,border-color,color] duration-fast ease-standard',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        'disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px',
        'aria-pressed:text-accent',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" label={null} />
      ) : (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      )}
    </button>
  );
});

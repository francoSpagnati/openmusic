import React from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type IconButtonVariant = 'solid' | 'subtle' | 'ghost' | 'outline';
export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonShape = 'round' | 'square';

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
  /** `round` for play/pause and avatars-adjacent actions; default: round for solid, else square. */
  shape?: IconButtonShape;
}

const variants: Record<IconButtonVariant, string> = {
  solid: 'bg-accent text-accent-contrast hover:bg-accent-hover',
  subtle: 'border border-line bg-surface-raised text-fg hover:border-line-strong',
  ghost: 'text-fg-muted hover:bg-fg/[0.05] hover:text-fg',
  outline: 'border border-line-strong text-fg hover:bg-fg/[0.04]',
};

/* sm is 32px (dense rows only); md 40px and lg 48px meet the touch-target guidance. */
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
    shape,
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
        'om-press inline-flex shrink-0 items-center justify-center',
        (shape ?? (variant === 'solid' ? 'round' : 'square')) === 'round'
          ? 'rounded-full'
          : 'rounded-md',
        'transition-[background-color,border-color,color] duration-fast ease-out',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        'disabled:cursor-not-allowed disabled:opacity-50 forced-colors:border forced-colors:border-solid',
        variant !== 'solid' && 'aria-pressed:bg-accent/[0.08] aria-pressed:text-accent',
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

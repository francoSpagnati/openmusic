'use client';

import React from 'react';
import { X } from '@phosphor-icons/react';
import { cn } from './cn';
import { IconButton } from './IconButton';

export type DialogSize = 'sm' | 'md' | 'lg';

export interface DialogProps {
  open: boolean;
  /** Called for every close path: Esc, back gesture, backdrop click, close button. */
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Action row, e.g. <Button variant="ghost">Annulla</Button><Button>Salva</Button>. */
  footer?: React.ReactNode;
  size?: DialogSize;
  /** Close when clicking the backdrop (light dismiss). Default true. */
  dismissible?: boolean;
  closeLabel?: string;
  className?: string;
}

const sizes: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

/**
 * Native modal <dialog>: top layer, focus trap, Esc and inert background come
 * from the platform. Light dismiss uses `closedby="any"` with a click fallback
 * for browsers that lack it (Safari).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  closeLabel = 'Chiudi',
  className,
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.setAttribute('closedby', dismissible ? 'any' : 'closerequest');

    const handleClose = () => onCloseRef.current();
    dialog.addEventListener('close', handleClose);

    const supportsClosedBy = 'closedBy' in HTMLDialogElement.prototype;
    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!inside) dialog.close();
    };
    if (dismissible && !supportsClosedBy) dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [dismissible]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-xl border border-line p-0 text-fg shadow-om-lg open:animate-dialog-in',
        'max-h-[calc(100dvh-2rem)] bg-surface-raised',
        sizes[size],
        className
      )}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
            <div className="min-w-0">
              <h2 id={titleId} className="om-headline text-2xl text-fg">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1.5 text-sm text-fg-muted">
                  {description}
                </p>
              )}
            </div>
            <IconButton
              label={closeLabel}
              icon={<X weight="bold" />}
              size="sm"
              onClick={() => ref.current?.close()}
            />
          </header>
          {children && <div className="overflow-y-auto px-6 py-4">{children}</div>}
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}

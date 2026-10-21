'use client';

import React from 'react';
import { cn } from './cn';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Small counter after the label (tabular). */
  count?: number;
  disabled?: boolean;
  content: React.ReactNode;
}

export type TabsVariant = 'underline' | 'pill';

export interface TabsProps {
  items: TabItem[];
  /** Controlled value. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Accessible name of the tab list. */
  label: string;
  variant?: TabsVariant;
  className?: string;
  panelClassName?: string;
}

/**
 * WAI-ARIA tabs with automatic activation: Arrow keys move and select,
 * Home/End jump, only the active tab is in the Tab order.
 */
export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  label,
  variant = 'underline',
  className,
  panelClassName,
}: TabsProps) {
  const baseId = React.useId();
  const enabled = items.filter((item) => !item.disabled);
  const [internal, setInternal] = React.useState<string | undefined>(
    defaultValue ?? enabled[0]?.id
  );
  const active = value ?? internal;
  const tabRefs = React.useRef(new Map<string, HTMLButtonElement>());

  const select = (id: string) => {
    if (value === undefined) setInternal(id);
    onValueChange?.(id);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = enabled.findIndex((item) => item.id === active);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % enabled.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = enabled.length - 1;
    if (next === null) return;
    event.preventDefault();
    const target = enabled[next];
    if (!target) return;
    select(target.id);
    tabRefs.current.get(target.id)?.focus();
  };

  const activeItem = items.find((item) => item.id === active);

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn(
          'flex gap-1 overflow-x-auto',
          variant === 'underline' ? 'border-b border-line' : 'rounded-lg bg-sunken p-1'
        )}
      >
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) tabRefs.current.set(item.id, node);
                else tabRefs.current.delete(item.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold',
                'transition-[color,background-color,border-color] duration-fast ease-standard',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                'disabled:cursor-not-allowed disabled:opacity-40',
                variant === 'underline'
                  ? cn(
                      '-mb-px h-11 border-b-2 px-3',
                      selected
                        ? 'border-accent text-ink'
                        : 'border-transparent text-ink-muted hover:text-ink'
                    )
                  : cn(
                      'h-9 rounded-md px-3',
                      selected
                        ? 'bg-elevated text-ink shadow-om-sm'
                        : 'text-ink-muted hover:text-ink'
                    )
              )}
            >
              {item.icon && (
                <span aria-hidden="true" className="inline-flex">
                  {item.icon}
                </span>
              )}
              {item.label}
              {item.count !== undefined && (
                <span className="font-mono text-xs tabular-nums text-ink-muted">{item.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {activeItem && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeItem.id}`}
          aria-labelledby={`${baseId}-tab-${activeItem.id}`}
          tabIndex={0}
          className={cn('pt-4 focus-visible:outline-none', panelClassName)}
        >
          {activeItem.content}
        </div>
      )}
    </div>
  );
}

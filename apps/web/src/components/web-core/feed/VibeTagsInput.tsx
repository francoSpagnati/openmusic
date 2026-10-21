'use client';

import React, { useId, useState } from 'react';
import { Hash, X } from '@phosphor-icons/react';
import { cn, controlClasses } from '@/components/ui';

export const MAX_VIBE_TAGS = 5;
const MAX_TAG_LENGTH = 30;

function normalise(raw: string): string {
  return raw.replace(/^#+/, '').trim().replace(/\s+/g, '').slice(0, MAX_TAG_LENGTH);
}

/** Free-form mood tags ("#AscoltoNotturno"): Enter or comma adds, Backspace on empty removes. */
export function VibeTagsInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState('');
  const full = value.length >= MAX_VIBE_TAGS;

  function commit(raw: string = draft) {
    const tag = normalise(raw);
    setDraft('');
    if (!tag || full || value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  }

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        Vibe{' '}
        <span className="font-mono text-xs font-normal text-ink-muted tabular-nums">
          {value.length}/{MAX_VIBE_TAGS}
        </span>
      </label>
      <div
        className={cn(
          controlClasses,
          'flex min-h-10 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-accent'
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-accent/15 py-0.5 pl-2.5 pr-1 font-mono text-xs text-ink"
          >
            #{tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              disabled={disabled}
              aria-label={`Rimuovi #${tag}`}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-secondary hover:bg-ink/10 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              <X aria-hidden="true" weight="bold" className="h-3 w-3" />
            </button>
          </span>
        ))}
        <span className="flex min-w-[8rem] flex-1 items-center gap-1">
          <Hash aria-hidden="true" className="text-ink-muted" />
          <input
            id={inputId}
            value={draft}
            disabled={disabled || full}
            maxLength={MAX_TAG_LENGTH + 1}
            autoComplete="off"
            enterKeyHint="enter"
            aria-describedby={hintId}
            placeholder={full ? 'Massimo raggiunto' : 'AscoltoNotturno'}
            onChange={(e) => {
              const next = e.target.value;
              if (next.endsWith(',')) commit(next.slice(0, -1));
              else setDraft(next);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={() => commit()}
            className="h-7 w-full min-w-0 bg-transparent text-base text-ink placeholder:text-ink-muted focus:outline-none sm:text-sm"
          />
        </span>
      </div>
      <p id={hintId} className="text-xs text-ink-muted">
        Premi Invio o la virgola per aggiungere un tag.
      </p>
    </div>
  );
}

'use client';

import React, { useId, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { controlClasses, cn } from '../../../components/ui';

const MAX_TAGS = 5;
const MAX_LENGTH = 30;

function normalise(raw: string): string {
  return raw.trim().replace(/^#+/, '').replace(/\s+/g, '-').slice(0, MAX_LENGTH);
}

/** Up to five short "vibe" tags; Enter or comma adds, Backspace on empty removes the last. */
export function VibeTagsInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const full = value.length >= MAX_TAGS;

  const add = () => {
    const tag = normalise(draft);
    if (!tag || full) return;
    if (!value.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft('');
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        Vibe <span className="font-normal text-ink-muted">(facoltativo)</span>
      </label>
      <p id={`${id}-hint`} className="text-xs text-ink-secondary">
        Fino a {MAX_TAGS} parole chiave, es. notturno, malinconico. Premi Invio per aggiungerle.
      </p>
      <div
        className={cn(
          controlClasses,
          'flex min-h-11 flex-wrap items-center gap-1.5 py-1.5 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgb(var(--om-focus)/0.35)]'
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 font-mono text-xs text-ink"
          >
            #{tag}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Rimuovi ${tag}`}
              className="rounded-full p-0.5 text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              <X aria-hidden="true" className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          aria-describedby={`${id}-hint`}
          value={draft}
          disabled={disabled || full}
          maxLength={MAX_LENGTH + 1}
          placeholder={full ? 'Massimo raggiunto' : 'Aggiungi…'}
          onChange={(e) => {
            if (e.target.value.endsWith(',')) {
              setDraft(e.target.value.slice(0, -1));
              requestAnimationFrame(add);
            } else setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            } else if (e.key === 'Backspace' && !draft && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={add}
          className="min-w-[8ch] flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted sm:text-sm"
        />
      </div>
    </div>
  );
}

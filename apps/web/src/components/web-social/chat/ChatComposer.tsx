'use client';

import React, { useId, useRef, useState } from 'react';
import { MusicNotesPlus, PaperPlaneTilt } from '@phosphor-icons/react';
import { IconButton, controlClasses, cn } from '@/components/ui';
import { ShareSongModal, type ShareSongPayload } from '@/components/ShareSongModal';

const MAX_LENGTH = 1000;

/** Message box: Enter sends, Shift+Enter adds a line, the disc button recommends a track. */
export function ChatComposer({
  peerName,
  onSend,
  onShareTrack,
}: {
  peerName: string;
  onSend: (text: string) => void;
  onShareTrack: (payload: ShareSongPayload) => void;
}) {
  const [text, setText] = useState('');
  const [sharing, setSharing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const counterId = useId();
  const trimmed = text.trim();
  const nearLimit = text.length > MAX_LENGTH * 0.8;

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    inputRef.current?.focus();
  }

  return (
    <>
      <form
        onSubmit={submit}
        className="flex items-end gap-2 border-t border-line bg-surface px-3 py-3 sm:px-4"
      >
        <IconButton
          label={`Consiglia un brano a ${peerName}`}
          icon={<MusicNotesPlus />}
          variant="subtle"
          onClick={() => setSharing(true)}
        />
        <label htmlFor={inputId} className="sr-only">
          Messaggio per {peerName}
        </label>
        <textarea
          ref={inputRef}
          id={inputId}
          rows={1}
          value={text}
          maxLength={MAX_LENGTH}
          placeholder="Scrivi un consiglio musicale…"
          aria-describedby={nearLimit ? counterId : undefined}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          className={cn(
            controlClasses,
            'max-h-40 min-h-10 flex-1 resize-none py-2 text-base leading-snug [field-sizing:content] sm:text-sm'
          )}
        />
        <IconButton
          type="submit"
          label="Invia messaggio"
          icon={<PaperPlaneTilt weight="bold" />}
          variant="solid"
          disabled={!trimmed}
        />
      </form>
      {nearLimit && (
        <p
          id={counterId}
          className="bg-surface px-4 pb-2 text-right font-mono text-xs tabular-nums text-ink-muted"
        >
          {text.length}/{MAX_LENGTH}
        </p>
      )}
      <ShareSongModal
        open={sharing}
        onClose={() => setSharing(false)}
        recipientName={peerName}
        onShare={onShareTrack}
      />
    </>
  );
}

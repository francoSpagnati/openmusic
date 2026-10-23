'use client';

import React, { useId, useRef, useState } from 'react';
import { MusicNotesPlus, PaperPlaneTilt } from '@phosphor-icons/react';
import { IconButton, cn } from '@/components/ui';
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
      <div className="bg-canvas px-3 pb-4 pt-2 sm:px-6">
        <form
          onSubmit={submit}
          className={cn(
            'mx-auto w-full max-w-2xl rounded-xl border border-line-strong bg-surface-raised',
            'transition-[border-color,box-shadow] duration-fast ease-out',
            'has-[textarea:focus-visible]:border-focus has-[textarea:focus-visible]:ring-1 has-[textarea:focus-visible]:ring-focus'
          )}
        >
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
              'block max-h-40 min-h-[3rem] w-full resize-none bg-transparent px-4 pb-1 pt-3 text-base leading-relaxed text-fg [field-sizing:content]',
              'placeholder:text-fg-subtle focus:outline-none'
            )}
          />
          <div className="flex items-center gap-2 px-2 pb-2">
            <IconButton
              label={`Consiglia un brano a ${peerName}`}
              icon={<MusicNotesPlus />}
              variant="ghost"
              onClick={() => setSharing(true)}
            />
            <span className="flex-1" />
            {nearLimit && (
              <span id={counterId} className="font-mono text-xs tabular-nums text-fg-subtle">
                {text.length}/{MAX_LENGTH}
              </span>
            )}
            <IconButton
              type="submit"
              label="Invia messaggio"
              icon={<PaperPlaneTilt weight="bold" />}
              variant="solid"
              disabled={!trimmed}
            />
          </div>
        </form>
      </div>
      <ShareSongModal
        open={sharing}
        onClose={() => setSharing(false)}
        recipientName={peerName}
        onShare={onShareTrack}
      />
    </>
  );
}

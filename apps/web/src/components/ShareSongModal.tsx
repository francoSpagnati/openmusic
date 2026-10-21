'use client';

import React, { useEffect, useId, useState } from 'react';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import type { CatalogTrack } from '@openmusic/shared';
import { Button, Dialog, Textarea } from '@/components/ui';
import { TrackSearch } from '@/components/web-social/TrackSearch';

const NOTE_MAX = 1000;

export interface ShareSongPayload {
  track: CatalogTrack;
  /** Optional note sent with the track (trimmed, may be empty). */
  note: string;
}

interface ShareSongModalProps {
  open: boolean;
  onClose: () => void;
  /** Who receives the recommendation (used in the copy). */
  recipientName: string;
  /**
   * Called with the chosen track; the caller sends it (the chat shows it optimistically and
   * offers a retry), so the dialog closes immediately.
   */
  onShare: (payload: ShareSongPayload) => void;
}

/** Pick a catalog track (with 30s previews) and recommend it to a friend in chat. */
export const ShareSongModal: React.FC<ShareSongModalProps> = ({
  open,
  onClose,
  recipientName,
  onShare,
}) => {
  const [track, setTrack] = useState<CatalogTrack | null>(null);
  const [note, setNote] = useState('');
  const [triedEmpty, setTriedEmpty] = useState(false);
  const formId = useId();

  // Every opening starts from a clean slate.
  useEffect(() => {
    if (!open) return;
    setTrack(null);
    setNote('');
    setTriedEmpty(false);
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!track) {
      setTriedEmpty(true);
      return;
    }
    onShare({ track, note: note.trim() });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="Consiglia un brano"
      description={`${recipientName} riceverà il brano con l’anteprima di 30 secondi e i link per ascoltarlo ovunque.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button
            type="submit"
            form={formId}
            leadingIcon={<PaperPlaneTilt aria-hidden="true" weight="bold" />}
          >
            {track ? `Invia a ${recipientName}` : 'Invia'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
        {open && <TrackSearch value={track} onChange={setTrack} autoFocus />}
        {triedEmpty && !track && (
          <p role="alert" className="text-sm text-rotten">
            Scegli prima un brano dai risultati.
          </p>
        )}
        <Textarea
          label="Due parole sul perché"
          hint="Facoltativo. Il momento giusto, il dettaglio da non perdere…"
          rows={2}
          maxLength={NOTE_MAX}
          aside={`${note.length}/${NOTE_MAX}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[4.5rem]"
        />
      </form>
    </Dialog>
  );
};

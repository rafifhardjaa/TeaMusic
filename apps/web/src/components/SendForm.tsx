import { useRef, useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, PaperPlaneTilt } from '@phosphor-icons/react';
import { useMessagesStore } from '../store/messages';
import { MESSAGE_MAX, RECIPIENT_MAX, useComposer } from '../store/composer';
import { useAudioStore } from '../store/audio';
import { pushHistory } from '../lib/history';
import type { Message } from '../lib/types';
import { TrackPicker } from './TrackPicker';
import type { TrackPickerHandle } from './TrackPicker';
import { Button } from './ui/Button';
import { MetaLabel } from './ui/Card';
import { Input, Textarea } from './ui/Field';

interface Props {
  onSent: (message: Message) => void;
}

interface Errors {
  recipient?: string;
  message?: string;
  track?: string;
  form?: string;
}

export function SendForm({ onSent }: Props) {
  const send = useMessagesStore((state) => state.send);
  const draft = useComposer();
  const stopAudio = useAudioStore((state) => state.stop);

  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const trackPicker = useRef<TrackPickerHandle>(null);

  // Stop any playing audio when SendForm unmounts (e.g. navigating away)
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  function validate(): Errors {
    const next: Errors = {};
    if (!draft.recipient.trim()) next.recipient = 'Required';
    if (!draft.message.trim()) next.message = 'Required';
    if (!draft.track) next.track = 'Pick a track first';
    return next;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !draft.track?.previewUrl) return;

    setSubmitting(true);
    try {
      const created = await send({
        recipient: draft.recipient.trim(),
        message: draft.message.trim(),
        trackId: draft.track.id,
        trackName: draft.track.name,
        artistName: draft.track.artist,
        coverUrl: draft.track.coverUrl,
        previewUrl: draft.track.previewUrl ?? '',
        zodiac: draft.zodiac,
        mood: draft.mood,
      });

      // Stop preview audio before resetting form state
      stopAudio();
      draft.reset();
      // The picker keeps its own query and results, so it has to be told the
      // draft is gone; otherwise the sent track's search list stays on screen.
      trackPicker.current?.reset();
      // Local-only: the row is already persisted when this resolves, so the
      // copyable link the user gets later cannot point at a missing record.
      pushHistory({
        id: created.id,
        recipient: created.recipient,
        timestamp: Date.parse(created.createdAt),
        track_name: created.trackName,
      });
      onSent(created);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Could not send the message' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-9">
      <Input
        label="Recipient"
        value={draft.recipient}
        maxLength={RECIPIENT_MAX}
        onChange={(event) => draft.setRecipient(event.target.value)}
        placeholder="Who is this for"
        error={errors.recipient}
        counter={`${draft.recipient.length}/${RECIPIENT_MAX}`}
        autoComplete="off"
      />

      <Textarea
        label="Your note"
        value={draft.message}
        rows={3}
        maxLength={MESSAGE_MAX}
        onChange={(event) => draft.setMessage(event.target.value)}
        placeholder="Say the thing you keep not saying"
        error={errors.message}
        counter={`${draft.message.length}/${MESSAGE_MAX}`}
      />

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <MetaLabel>The track</MetaLabel>
          {errors.track ? (
            <span className="font-mono text-[10px] tracking-widest text-accent uppercase">{errors.track}</span>
          ) : null}
        </div>
        <TrackPicker ref={trackPicker} selected={draft.track} onSelect={draft.setTrack} />
      </div>

      {errors.form ? <MetaLabel className="block text-accent">{errors.form}</MetaLabel> : null}

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitting ? 'Sending' : 'Send it anonymously'}
        <ArrowRight size={16} weight="light" />
      </Button>

      <p className="flex items-start gap-2 text-xs text-ink-soft">
        <PaperPlaneTilt size={14} weight="light" className="mt-0.5 shrink-0" />
        <span>No sender is stored. The recipient only sees the name you type here.</span>
      </p>
    </form>
  );
}

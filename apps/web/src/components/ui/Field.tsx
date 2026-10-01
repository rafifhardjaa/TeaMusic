import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { MetaLabel } from './Card';

const CONTROL = 'field rounded-xl p-4 text-base';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string | null;
  counter?: string;
  children: (id: string) => ReactNode;
}

function FieldShell({ label, hint, error, counter, children }: FieldShellProps) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="mb-3 flex items-baseline justify-between gap-3">
        <MetaLabel>{label}</MetaLabel>
        {counter ? <span className="font-mono text-[10px] text-[#B4B0A8]">{counter}</span> : null}
      </span>
      {children(id)}
      {error ? (
        <span className="mt-2 block font-mono text-[10px] uppercase tracking-widest text-accent">{error}</span>
      ) : hint ? (
        <span className="mt-2 block text-xs text-ink-soft">{hint}</span>
      ) : null}
    </label>
  );
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string | null;
  counter?: string;
}

export function Input({ label, hint, error, counter, ...rest }: InputProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} counter={counter}>
      {(id) => <input id={id} className={CONTROL} aria-invalid={Boolean(error)} {...rest} />}
    </FieldShell>
  );
}

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string | null;
  counter?: string;
}

export function Textarea({ label, hint, error, counter, ...rest }: TextareaProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} counter={counter}>
      {(id) => (
        <textarea
          id={id}
          className={`${CONTROL} resize-none font-handwriting text-lg`}
          aria-invalid={Boolean(error)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

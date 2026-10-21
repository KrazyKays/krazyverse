import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';

interface TextFieldProps {
  label: string;
  value: string;
  multiline?: boolean;
  rows?: number;
  type?: 'text' | 'number';
  autoFocus?: boolean;
  onCommit: (value: string) => void;
}

export function TextField({
  label,
  value,
  multiline = false,
  rows = 3,
  type = 'text',
  autoFocus = false,
  onCommit,
}: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const saved = useRef(value);
  const cancelled = useRef(false);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    saved.current = value;
    if (!focused.current) setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    fieldRef.current?.focus();
    fieldRef.current?.select();
  }, [autoFocus]);

  const commit = () => {
    focused.current = false;
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (draft === saved.current) return;
    saved.current = draft;
    onCommit(draft);
  };

  const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value);
  const onFocus = () => {
    focused.current = true;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !multiline) {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelled.current = true;
      setDraft(saved.current);
      event.currentTarget.blur();
    }
  };

  const shared = {
    value: draft,
    onChange,
    onFocus,
    onBlur: commit,
    onKeyDown,
    ref: (element: HTMLInputElement | HTMLTextAreaElement | null) => {
      fieldRef.current = element;
    },
  };

  return (
    <label className="setup-field">
      <span>{label}</span>
      {multiline ? <textarea rows={rows} {...shared} /> : <input type={type} {...shared} />}
    </label>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  const [current, setCurrent] = useState(value);
  useEffect(() => setCurrent(value), [value]);

  return (
    <label className="setup-field">
      <span>{label}</span>
      <select
        value={current}
        onChange={(event) => {
          setCurrent(event.target.value);
          onChange(event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface CheckboxFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CheckboxField({ label, description, checked, onChange }: CheckboxFieldProps) {
  const [current, setCurrent] = useState(checked);
  const descriptionId = useId();
  useEffect(() => setCurrent(checked), [checked]);

  return (
    <label className="setup-check">
      <input
        type="checkbox"
        checked={current}
        aria-describedby={description ? descriptionId : undefined}
        onChange={(event) => {
          setCurrent(event.target.checked);
          onChange(event.target.checked);
        }}
      />
      <span className="setup-check-body">
        <span>{label}</span>
        {description && (
          <span id={descriptionId} className="setup-check-desc">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

interface SectionProps {
  title: string;
  count?: number;
  level?: 2 | 3;
  defaultOpen?: boolean;
  tone?: 'danger';
  children: ReactNode;
}

export function Section({ title, count, level = 3, defaultOpen = true, tone, children }: SectionProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <details className={tone === 'danger' ? 'setup-section setup-section--danger' : 'setup-section'} open={defaultOpen}>
      <summary>
        <Heading>
          {title}
          {count !== undefined && <span className="setup-count"> ({count})</span>}
        </Heading>
      </summary>
      <div className="setup-section-body">{children}</div>
    </details>
  );
}

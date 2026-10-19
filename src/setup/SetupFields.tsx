import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

interface TextFieldProps {
  label: string;
  value: string;
  multiline?: boolean;
  type?: 'text' | 'number';
  onCommit: (value: string) => void;
}

export function TextField({ label, value, multiline = false, type = 'text', onCommit }: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const saved = useRef(value);

  useEffect(() => {
    saved.current = value;
    if (!focused.current) setDraft(value);
  }, [value]);

  const commit = () => {
    focused.current = false;
    if (draft === saved.current) return;
    saved.current = draft;
    onCommit(draft);
  };

  const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value);
  const onFocus = () => {
    focused.current = true;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
  };

  return (
    <label className="setup-field">
      <span>{label}</span>
      {multiline ? (
        <textarea rows={3} value={draft} onChange={onChange} onFocus={onFocus} onBlur={commit} />
      ) : (
        <input
          type={type}
          value={draft}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
      )}
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
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  const [current, setCurrent] = useState(checked);
  useEffect(() => setCurrent(checked), [checked]);

  return (
    <label className="setup-check">
      <input
        type="checkbox"
        checked={current}
        onChange={(event) => {
          setCurrent(event.target.checked);
          onChange(event.target.checked);
        }}
      />
      <span>{label}</span>
    </label>
  );
}

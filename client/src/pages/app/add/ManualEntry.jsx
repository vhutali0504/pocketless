import { useId, useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.jsx';
import { inferFormat, looksLikeSaId, normaliseValue, validateValue } from '../../../lib/barcode.js';

/** @typedef {import('../../../lib/barcode.js').BarcodeFormat} BarcodeFormat */

/** Shared with the scan path: a typed or scanned value that looks like an SA ID number. */
export const SA_ID_DIALOG = {
  title: 'Is this your ID number?',
  body: "This looks like an SA ID number. Loyalty cards don't need your ID number. Only save it if it's really your card number.",
  confirmLabel: 'Save anyway',
  cancelLabel: 'Cancel',
};

const ERROR_COPY = {
  empty: 'Enter the number from your card',
  bad_chars: "That number has characters a card number can't have.",
  too_long: "That's longer than a card number can be.",
  bad_checksum: "That number doesn't look right. Check it against your card.",
};

/** Room for spaces and dashes typed between digit groups; the value itself is limited to 64. */
const INPUT_MAX_LENGTH = 128;

/**
 * Works out what the user meant. Digits typed in groups ("4006 3813 33931") lose their spaces and
 * dashes; anything else is only trimmed, because spaces can be part of a Code 128 value.
 * @param {string} raw
 * @param {BarcodeFormat[]|null} expected
 * @returns {{ ok: true, value: string, format: BarcodeFormat } | { ok: false, reason: string }}
 */
export function readTypedValue(raw, expected) {
  const digits = normaliseValue(raw, 'EAN_13');
  const candidate = /^\d+$/.test(digits) ? digits : raw.trim();
  const format = inferFormat(candidate, expected ?? undefined);
  const value = normaliseValue(candidate, format);
  const result = validateValue(value, format);
  if (!result.ok) return result;
  // A store that expects particular formats: block characters none of them can carry. Other
  // mismatches (length, check digit) are only a soft warning on the confirm screen.
  if (expected && !expected.includes(format)) {
    const impossible = expected.every((f) => validateValue(value, f).reason === 'bad_chars');
    if (impossible) return { ok: false, reason: 'bad_chars' };
  }
  return { ok: true, value, format };
}

/**
 * Type the card number instead of scanning it.
 * @param {{ store: import('../../../lib/stores.js').Store, initialValue?: string,
 *   onSubmit(read: { value: string, format: BarcodeFormat }): void, onCancel(): void,
 *   cancelLabel?: string, onChange?(raw: string): void }} props
 */
export default function ManualEntry({
  store, initialValue = '', onSubmit, onCancel, cancelLabel = 'Cancel', onChange,
}) {
  const [raw, setRaw] = useState(initialValue);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(/** @type {{value: string, format: BarcodeFormat}|null} */ (null));
  const inputId = useId();
  const errorId = useId();
  const hintId = useId();

  const submit = (event) => {
    event.preventDefault();
    const read = readTypedValue(raw, store.expectedFormats);
    if (!read.ok) {
      setError(ERROR_COPY[read.reason] ?? ERROR_COPY.bad_chars);
      return;
    }
    setError('');
    const picked = { value: read.value, format: read.format };
    if (looksLikeSaId(read.value)) {
      setPending(picked);
      return;
    }
    onSubmit(picked);
  };

  const numericOnly = Array.isArray(store.expectedFormats)
    && store.expectedFormats.every((f) => ['EAN_13', 'EAN_8', 'UPC_A', 'ITF'].includes(f));

  return (
    <form className="add-body add-form" onSubmit={submit} noValidate>
      <div className="add-field">
        <label htmlFor={inputId} className="add-field__label">Card number</label>
        <p id={hintId} className="add-hint">Type it exactly as it is printed under the barcode.</p>
        <input
          id={inputId}
          className="add-field__input add-field__input--number"
          type="text"
          inputMode={numericOnly ? 'numeric' : 'text'}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={INPUT_MAX_LENGTH}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            onChange?.(e.target.value);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        />
        {error && <p id={errorId} className="add-error" role="alert">{error}</p>}
      </div>
      <Button type="submit" className="add-form__submit">Continue</Button>
      <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>

      <ConfirmDialog
        open={pending !== null}
        {...SA_ID_DIALOG}
        onConfirm={() => {
          const picked = pending;
          setPending(null);
          onSubmit(picked);
        }}
        onCancel={() => setPending(null)}
      />
    </form>
  );
}

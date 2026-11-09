import { useNavigate } from 'react-router-dom';
import BarcodeView from '../../../components/barcode/BarcodeView.jsx';
import Button from '../../../components/ui/Button.jsx';
import { CardLimitError, DuplicateCardError } from '../../../lib/cards.js';

/** @typedef {import('../../../lib/barcode.js').BarcodeFormat} BarcodeFormat */
/** @typedef {{ store: import('../../../lib/stores.js').Store, displayName: string, programme: string,
 *   colour: string, value: string, format: BarcodeFormat }} Draft */

/** True when the store lists what its numbers look like and this one doesn't fit. */
function looksWrongForStore({ store, value, format }) {
  if (store.expectedLength != null && value.length !== store.expectedLength) return true;
  if (store.expectedFormats != null && !store.expectedFormats.includes(format)) return true;
  return false;
}

function SaveError({ error }) {
  const navigate = useNavigate();
  if (error instanceof DuplicateCardError) {
    return (
      <div className="confirm__problem" role="alert">
        <p className="confirm__problem-title">You already have this card</p>
        <Button
          variant="secondary"
          onClick={() => navigate('/app', { state: { expandId: error.existingId } })}
        >
          Open it
        </Button>
      </div>
    );
  }
  const message = error instanceof CardLimitError
    ? "You've reached the 200-card limit. Delete a card you don't use to add a new one."
    : "Pocketless couldn't save the card. Try again.";
  return <p className="confirm__problem" role="alert">{message}</p>;
}

/**
 * Step 3: show the card as it will look and ask the user to check the number against the card.
 * Nothing is saved until "Yes, save card".
 * @param {{ draft: Draft, onConfirm(): void, onRetry(): void, error: Error|null,
 *   busy?: boolean, retryLabel?: string }} props
 */
export default function ConfirmStep({ draft, onConfirm, onRetry, error, busy = false, retryLabel = 'No, scan again' }) {
  const duplicate = error instanceof DuplicateCardError;
  return (
    <div className="add-body confirm">
      <div className="confirm__card" style={{ '--card-colour': draft.colour }}>
        <p className="confirm__name">{draft.displayName}</p>
        {draft.programme && <p className="confirm__programme">{draft.programme}</p>}
        <div className="confirm__barcode">
          <BarcodeView value={draft.value} format={draft.format} />
        </div>
      </div>

      <p className="confirm__question">Does this number match the one printed on your card?</p>

      {looksWrongForStore(draft) && (
        <p className="confirm__warning">
          That doesn&apos;t look like a {draft.store.name} card number. Check it against your card.
        </p>
      )}

      {error && <SaveError error={error} />}

      <div className="confirm__actions">
        {!duplicate && (
          <Button onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>
            Yes, save card
          </Button>
        )}
        <Button variant="secondary" onClick={onRetry} disabled={busy}>{retryLabel}</Button>
      </div>
    </div>
  );
}

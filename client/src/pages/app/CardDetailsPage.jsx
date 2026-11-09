import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { useCards } from '../../context/CardsContext.jsx';
import { ValidationError } from '../../lib/cards.js';
import { OTHER_PALETTE, OTHER_STORE_KEY, getStore } from '../../lib/stores.js';
import ConfirmStep from './add/ConfirmStep.jsx';
import ManualEntry from './add/ManualEntry.jsx';
import '../../styles/add-card.css';
import '../../styles/card-details.css';

const NAME_MAX = 40;
const SAVE_FAILED = "Pocketless couldn't save that. Try again.";

function BackLink({ to = '/app', children = 'Back to wallet' }) {
  return (
    <Link to={to} className="btn btn--quiet details__back">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </Link>
  );
}

/** The colours a card can take: the store's own first (built-in stores), then the shared palette. */
function colourOptions(card, store) {
  const own = store && store.key !== OTHER_STORE_KEY ? [{ hex: store.colour, label: `${store.name} colour` }] : [];
  const palette = OTHER_PALETTE.filter((hex) => !own.some((o) => o.hex.toLowerCase() === hex.toLowerCase()));
  const all = [...own, ...palette.map((hex) => ({ hex, label: '' }))];
  return all.map((o, i) => ({ ...o, label: o.label || `Colour ${i + 1} of ${all.length}` }));
}

function Details({ card }) {
  const { update, remove } = useCards();
  const navigate = useNavigate();
  const store = getStore(card.storeKey) ?? getStore(OTHER_STORE_KEY);

  const [view, setView] = useState(/** @type {'main'|'number'|'confirm'} */ ('main'));
  const [name, setName] = useState(card.displayName);
  const [nameError, setNameError] = useState('');
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');
  const [draftRead, setDraftRead] = useState(null);
  const [confirmError, setConfirmError] = useState(/** @type {Error|null} */ (null));
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  /** Runs one update; shows "Saved" or a problem. Resolves true on success. */
  const save = async (patch) => {
    setMessage('');
    setProblem('');
    try {
      await update(card.id, patch);
      setMessage('Saved');
      return true;
    } catch (err) {
      setProblem(err instanceof ValidationError && err.field === 'displayName'
        ? 'Enter a name for this card'
        : SAVE_FAILED);
      return false;
    }
  };

  if (leaving) return null;

  if (view === 'number') {
    return (
      <div className="add-page">
        <header className="add-header">
          <h1 className="add-header__title">Change card number</h1>
        </header>
        <ManualEntry
          store={store}
          initialValue={card.value}
          onSubmit={(read) => {
            setDraftRead(read);
            setConfirmError(null);
            setView('confirm');
          }}
          onCancel={() => setView('main')}
        />
      </div>
    );
  }

  if (view === 'confirm') {
    const confirm = async () => {
      if (busy) return;
      setBusy(true);
      setConfirmError(null);
      try {
        await update(card.id, { value: draftRead.value, format: draftRead.format });
        setMessage('Saved');
        setView('main');
      } catch (err) {
        setConfirmError(err);
      }
      setBusy(false);
    };
    return (
      <div className="add-page">
        <header className="add-header">
          <h1 className="add-header__title">Check your card</h1>
        </header>
        <ConfirmStep
          draft={{
            store,
            displayName: card.displayName,
            programme: card.programme,
            colour: card.colour,
            value: draftRead.value,
            format: draftRead.format,
          }}
          error={confirmError}
          busy={busy}
          retryLabel="No, type it again"
          onConfirm={confirm}
          onRetry={() => {
            setConfirmError(null);
            setView('number');
          }}
        />
      </div>
    );
  }

  const saveName = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') {
      setMessage('');
      setNameError('Enter a name for this card');
      return;
    }
    setNameError('');
    if (await save({ displayName: trimmed })) setName(trimmed);
  };

  const options = colourOptions(card, store);

  return (
    <div className="add-page">
      <header className="add-header">
        <BackLink />
      </header>

      <div className="add-body">
        <div className="details__preview" style={{ '--card-colour': card.colour }}>
          <h1 className="details__name">{card.displayName}</h1>
          {card.programme && <p className="details__programme">{card.programme}</p>}
        </div>

        <form className="add-field" onSubmit={saveName} noValidate>
          <label htmlFor="card-name" className="add-field__label">Card name</label>
          <input
            id="card-name"
            className="add-field__input"
            type="text"
            autoComplete="off"
            maxLength={NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'card-name-error' : undefined}
          />
          {nameError && <p id="card-name-error" className="add-error">{nameError}</p>}
          <Button type="submit" variant="secondary" className="details__save">Save</Button>
        </form>

        <fieldset className="add-palette">
          <legend className="add-field__label">Colour</legend>
          <div className="add-palette__swatches">
            {options.map((o) => (
              <label key={o.hex} className="add-palette__option" style={{ '--swatch': o.hex }}>
                <input
                  type="radio"
                  name="colour"
                  value={o.hex}
                  checked={card.colour.toLowerCase() === o.hex.toLowerCase()}
                  onChange={() => save({ colour: o.hex })}
                  aria-label={o.label}
                />
                <span className="add-palette__swatch" aria-hidden="true" />
              </label>
            ))}
          </div>
        </fieldset>

        <label className="details__pin">
          <input
            type="checkbox"
            role="switch"
            aria-checked={card.pinned}
            checked={card.pinned}
            onChange={() => save({ pinned: !card.pinned })}
          />
          Pin to top
        </label>

        {message && <p className="details__status" role="status">{message}</p>}
        {problem && <p className="add-error" role="alert">{problem}</p>}

        <Button variant="secondary" onClick={() => setView('number')}>Change number</Button>
        <Button variant="secondary" className="details__delete" onClick={() => setDeleting(true)}>Delete card</Button>
      </div>

      <ConfirmDialog
        open={deleting}
        title="Delete this card?"
        body="You can add it again later."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          setDeleting(false);
          setLeaving(true);
          try {
            await remove(card.id);
            navigate('/app', { replace: true });
          } catch {
            setLeaving(false);
            setProblem("Pocketless couldn't delete the card. Try again.");
          }
        }}
      />
    </div>
  );
}

/** Edit one card: rename, colour, pin, change the number, or delete it. */
export default function CardDetailsPage() {
  const { id } = useParams();
  const { status, cards } = useCards();

  if (status === 'loading') return <p className="details__loading">Loading…</p>;
  const card = cards.find((c) => c.id === id && !c.deletedAt);
  if (!card) {
    return (
      <div className="add-page">
        <div className="add-body">
          <h1 className="add-header__title">We couldn&apos;t find that card</h1>
          <BackLink>Back to your cards</BackLink>
        </div>
      </div>
    );
  }
  return <Details key={card.id} card={card} />;
}

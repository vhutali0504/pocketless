import { useId, useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import { LIMITS } from '../../../lib/cards.js';
import { OTHER_PALETTE, OTHER_STORE_KEY, searchStores } from '../../../lib/stores.js';
import StepHeader from './StepHeader.jsx';

/** @typedef {import('../../../lib/stores.js').Store} Store */
/** @typedef {{ store: Store, displayName: string, programme: string, colour: string }} Picked */

/** "Other store": a name and a colour from the fixed palette, both required. */
function OtherStoreForm({ store, onPick, onBack }) {
  const [name, setName] = useState('');
  const [colour, setColour] = useState('');
  const [errors, setErrors] = useState({ name: '', colour: '' });
  const nameId = useId();
  const nameErrorId = useId();
  const colourErrorId = useId();

  const onSubmit = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    const next = {
      name: trimmed === '' ? "Enter the store's name" : '',
      colour: OTHER_PALETTE.includes(colour) ? '' : 'Choose a colour',
    };
    setErrors(next);
    if (next.name || next.colour) return;
    onPick({ store, displayName: trimmed.slice(0, LIMITS.displayName), programme: '', colour });
  };

  return (
    <>
      <StepHeader key="other" title="Other store" onBack={onBack} />
      <form className="add-body add-form" onSubmit={onSubmit} noValidate>
        <div className="add-field">
          <label htmlFor={nameId} className="add-field__label">Store name</label>
          <input
            id={nameId}
            className="add-field__input"
            type="text"
            autoComplete="off"
            maxLength={LIMITS.displayName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? nameErrorId : undefined}
          />
          {errors.name && <p id={nameErrorId} className="add-error">{errors.name}</p>}
        </div>

        <fieldset
          className="add-palette"
          aria-describedby={errors.colour ? colourErrorId : undefined}
        >
          <legend className="add-field__label">Card colour</legend>
          <div className="add-palette__swatches">
            {OTHER_PALETTE.map((hex, i) => (
              <label key={hex} className="add-palette__option" style={{ '--swatch': hex }}>
                <input
                  type="radio"
                  name="colour"
                  value={hex}
                  checked={colour === hex}
                  onChange={() => setColour(hex)}
                  aria-label={`Colour ${i + 1} of ${OTHER_PALETTE.length}`}
                />
                <span className="add-palette__swatch" aria-hidden="true" />
              </label>
            ))}
          </div>
          {errors.colour && <p id={colourErrorId} className="add-error">{errors.colour}</p>}
        </fieldset>

        <Button type="submit" className="add-form__submit">Continue</Button>
      </form>
    </>
  );
}

/**
 * Step 1: pick the store. Built-in stores carry their own name, programme and colour.
 * @param {{ onPick(picked: Picked): void, onBack(): void }} props
 */
export default function StorePicker({ onPick, onBack }) {
  const [query, setQuery] = useState('');
  const [other, setOther] = useState(/** @type {Store|null} */ (null));
  const searchId = useId();

  if (other) return <OtherStoreForm store={other} onPick={onPick} onBack={() => setOther(null)} />;

  const results = searchStores(query);
  const onlyOther = results.length === 1;

  const choose = (store) => {
    if (store.key === OTHER_STORE_KEY) {
      setOther(store);
      return;
    }
    onPick({ store, displayName: store.name, programme: store.programme, colour: store.colour });
  };

  return (
    <>
      <StepHeader key="list" title="Add a card" onBack={onBack} />
      <div className="add-body">
        <label htmlFor={searchId} className="add-field__label">Search stores</label>
        <input
          id={searchId}
          className="add-field__input"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {onlyOther && (
          <p className="add-hint" role="status">
            No store matches that. Choose Other store to add it.
          </p>
        )}
        <ul className="store-list">
          {results.map((store) => (
            <li key={store.key}>
              <button type="button" className="store-list__item" onClick={() => choose(store)}>
                <span className="store-list__swatch" style={{ background: store.colour }} aria-hidden="true" />
                <span className="store-list__name">{store.name}</span>
                {store.programme && <span className="store-list__programme">{store.programme}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

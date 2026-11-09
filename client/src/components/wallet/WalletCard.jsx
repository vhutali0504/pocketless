import { memo } from 'react';
import { Link } from 'react-router-dom';
import BarcodeView from '../barcode/BarcodeView.jsx';
import { inertProps } from '../ui/inert.js';

/** @typedef {import('../../lib/cards.js').Card} Card */

function cardLabel(card) {
  return card.programme ? `${card.displayName}, ${card.programme}` : card.displayName;
}

function TillView({ card, closing, onPutBack }) {
  return (
    // Tapping anywhere on the till view puts the card back, like the hint says. Keyboard users
    // have the card button itself and Escape.
    <div
      id={`till-${card.id}`}
      className={`wallet-till${closing ? ' is-closing' : ''}`}
      aria-hidden={closing || undefined}
      onClick={closing ? undefined : onPutBack}
    >
      <BarcodeView value={card.value} format={card.format} />
      <p className="wallet-till__hint">Tap to put back</p>
      <Link
        to={`/app/cards/${card.id}`}
        className="wallet-till__edit"
        tabIndex={closing ? -1 : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        Edit
      </Link>
    </div>
  );
}

/**
 * One card in the stack. Position and motion come from the stack; this only renders.
 * @param {{ card: Card, index: number, state: 'rest'|'out'|'away', offsetY: number,
 *   till: 'none'|'open'|'closing', tabbable: boolean, onToggle(id: string): void }} props
 */
function WalletCard({ card, index, state, offsetY, till, tabbable, onToggle }) {
  const style = {
    top: `${index * 62}px`,
    zIndex: state === 'out' || till === 'closing' ? 1000 : index + 1,
    '--card-colour': card.colour,
  };
  if (offsetY !== 0) style.transform = `translateY(${offsetY}px)`;

  return (
    // A card that is away (another one is out) leaves the tab order and the accessibility tree.
    <li className={`wallet-card${state === 'out' ? ' is-out' : ''}`} style={style} {...inertProps(state === 'away')}>
      <div className="wallet-card__sheet" aria-hidden="true" />
      <button
        type="button"
        className="wallet-card__face"
        data-card-id={card.id}
        aria-label={cardLabel(card)}
        aria-expanded={state === 'out'}
        aria-controls={till === 'open' ? `till-${card.id}` : undefined}
        tabIndex={tabbable ? undefined : -1}
        onClick={() => onToggle(card.id)}
      >
        <span className="wallet-card__name">{card.displayName}</span>
        {card.programme ? <span className="wallet-card__programme">{card.programme}</span> : null}
      </button>
      {till !== 'none' ? (
        <TillView card={card} closing={till === 'closing'} onPutBack={() => onToggle(card.id)} />
      ) : null}
    </li>
  );
}

export default memo(WalletCard);

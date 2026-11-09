import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WalletCard from './WalletCard.jsx';

/** @typedef {import('../../lib/cards.js').Card} Card */

const OFFSET = 62; // visible strip of each stacked card (approved prototype)
const CARD_H = 160; // resting card height
const TARGET_TOP = 48; // where a pulled-out card settles, in viewport px
const RADIUS = 16;

function useViewportHeight() {
  const [height, setHeight] = useState(() => window.innerHeight || 640);
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight || 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return height;
}

/**
 * The stacked wallet. Only `transform` and `opacity` change when a card comes out: the picked card
 * is translated to the top, the cards that are on screen are translated below the fold, and the
 * card "grows" by un-scaling a colour sheet that sits behind its face. Nothing moves in layout.
 *
 * @param {{ cards: Card[], expandedId: string|null, closingId: string|null,
 *   reducedMotion: boolean, onToggle(id: string): void, onClose(): void }} props
 */
export default function CardStack({ cards, expandedId, closingId, reducedMotion, onToggle, onClose }) {
  const stackRef = useRef(/** @type {HTMLOListElement|null} */ (null));
  const viewportH = useViewportHeight();
  const sheetH = Math.max(320, Math.min(520, viewportH - TARGET_TOP - 16));
  const sheetRest = (CARD_H - 2 * RADIUS) / (sheetH - RADIUS);

  // Measured when a card comes out (scroll is locked while it is out, so this stays valid).
  const offsets = useMemo(() => {
    const map = new Map();
    if (expandedId === null) return map;
    const stackTop = stackRef.current ? stackRef.current.getBoundingClientRect().top : 0;
    cards.forEach((card, i) => {
      const restTop = stackTop + i * OFFSET;
      if (card.id === expandedId) {
        map.set(card.id, TARGET_TOP - restTop);
      } else if (restTop < viewportH && restTop + CARD_H > 0) {
        map.set(card.id, viewportH - restTop + 24);
      }
    });
    return map;
  }, [expandedId, cards, viewportH]);

  const focusCard = useCallback((id) => {
    const buttons = stackRef.current?.querySelectorAll('button[data-card-id]') ?? [];
    const button = Array.from(buttons).find((b) => b.dataset.cardId === id);
    button?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (expandedId === null) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
      focusCard(expandedId);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [expandedId, onClose, focusCard]);

  const style = {
    height: `${(cards.length - 1) * OFFSET + CARD_H}px`,
    '--sheet-h': `${sheetH}px`,
    '--sheet-rest': sheetRest,
  };

  return (
    <ol
      ref={stackRef}
      className={`wallet-stack${reducedMotion ? ' reduced-motion' : ''}`}
      style={style}
      aria-label="Your cards"
    >
      {cards.map((card, index) => {
        let state = 'rest';
        if (expandedId !== null) state = card.id === expandedId ? 'out' : 'away';
        let till = 'none';
        if (card.id === expandedId) till = 'open';
        else if (card.id === closingId) till = 'closing';
        return (
          <WalletCard
            key={card.id}
            card={card}
            index={index}
            state={state}
            offsetY={offsets.get(card.id) ?? 0}
            till={till}
            tabbable={expandedId === null || card.id === expandedId}
            onToggle={onToggle}
          />
        );
      })}
    </ol>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { openCardStore } from '../api/card-store.js';
import {
  addCard, updateCard, deleteCard, markUsed as markCardUsed, sortWallet,
} from '../lib/cards.js';

/** @typedef {import('../lib/cards.js').Card} Card */

const OWNER = 'guest';
const CardsContext = createContext(null);

/**
 * Holds the guest wallet. Every action writes through the card rules, then reloads the sorted list,
 * and resolves/rejects exactly as the rule did (e.g. DuplicateCardError reaches the caller).
 */
export function CardsProvider({ children }) {
  const [status, setStatus] = useState(/** @type {'loading'|'ready'|'unavailable'} */ ('loading'));
  const [cards, setCards] = useState(/** @type {Card[]} */ ([]));
  const storeRef = useRef(/** @type {Promise<import('../api/card-store.js').CardStore>|null} */ (null));
  const refreshSeq = useRef(0);

  const refresh = useCallback(async (store) => {
    const seq = ++refreshSeq.current;
    const list = sortWallet(await store.list(OWNER));
    // Only the newest refresh may land, so overlapping actions can't leave a stale list.
    if (seq === refreshSeq.current) setCards(list);
  }, []);

  useEffect(() => {
    let live = true;
    // Opened once per provider (StrictMode runs this effect twice in development).
    storeRef.current ??= openCardStore();
    storeRef.current
      .then(async (store) => {
        await refresh(store);
        if (live) setStatus('ready');
      })
      .catch(() => {
        // StorageUnavailableError in practice; any failure to read the wallet is treated the same.
        if (live) setStatus('unavailable');
      });
    return () => {
      live = false;
    };
  }, [refresh]);

  const run = useCallback(async (action) => {
    const store = await storeRef.current;
    const result = await action(store);
    await refresh(store);
    return result;
  }, [refresh]);

  const value = useMemo(() => ({
    status,
    cards,
    add: (input) => run((store) => addCard(store, { ...input, owner: OWNER })),
    update: (id, patch) => run((store) => updateCard(store, id, patch)),
    remove: (id) => run((store) => deleteCard(store, id)),
    markUsed: (id) => run((store) => markCardUsed(store, id)),
  }), [status, cards, run]);

  return <CardsContext.Provider value={value}>{children}</CardsContext.Provider>;
}

/**
 * @returns {{ status: 'loading'|'ready'|'unavailable', cards: Card[],
 *   add(input: object): Promise<Card>, update(id: string, patch: object): Promise<Card>,
 *   remove(id: string): Promise<void>, markUsed(id: string): Promise<void> }}
 */
export function useCards() {
  const ctx = useContext(CardsContext);
  if (!ctx) throw new Error('useCards must be used inside <CardsProvider>');
  return ctx;
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppHeader from '../../components/ui/AppHeader.jsx';
import CardStack from '../../components/wallet/CardStack.jsx';
import { useCards } from '../../context/CardsContext.jsx';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { useWakeLock } from '../../hooks/useWakeLock.js';
import '../../styles/wallet.css';

/** How long the till view takes to fade out after a card is put back (visual only). */
const TILL_FADE_OUT_MS = 180;

/** Keeps `frozenIds` order; cards not in it (newly added) go first, removed ones drop out. */
function inFrozenOrder(cards, frozenIds) {
  if (!frozenIds) return cards;
  const byId = new Map(cards.map((c) => [c.id, c]));
  const known = new Set(frozenIds);
  const fresh = cards.filter((c) => !known.has(c.id));
  return [...fresh, ...frozenIds.map((id) => byId.get(id)).filter(Boolean)];
}

function EmptyWallet() {
  return (
    <section className="wallet-empty">
      <h2 className="wallet-empty__title">Your wallet is empty</h2>
      <p className="wallet-empty__text">Add a loyalty card and it will be ready at the till, even offline.</p>
      <Link to="/app/add" className="wallet-empty__cta">Add your first card</Link>
    </section>
  );
}

export default function WalletPage() {
  const { status, cards, markUsed } = useCards();
  const reducedMotion = useReducedMotion();
  const location = useLocation();
  const navigate = useNavigate();

  const [expandedId, setExpandedId] = useState(/** @type {string|null} */ (null));
  const [closingId, setClosingId] = useState(/** @type {string|null} */ (null));
  // While a card has been out, the stack keeps its order so nothing jumps under the user's finger.
  // The most-recently-used order is applied next time the page is hidden or the wallet reopens.
  const [frozenIds, setFrozenIds] = useState(/** @type {string[]|null} */ (null));

  const visibleCards = useMemo(() => inFrozenOrder(cards, frozenIds), [cards, frozenIds]);

  const expandedRef = useRef(expandedId);
  const visibleRef = useRef(visibleCards);
  visibleRef.current = visibleCards;
  const closeTimer = useRef(0);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  /**
   * The single place the expanded card changes. State flips immediately on every tap (last tap
   * wins); CSS transitions only follow it, so a tap mid-animation can never get stuck.
   */
  const show = useCallback((next) => {
    const prev = expandedRef.current;
    if (prev === next) return;
    expandedRef.current = next;
    setExpandedId(next);
    if (next !== null) {
      setFrozenIds((ids) => ids ?? visibleRef.current.map((c) => c.id));
    }
    if (prev !== null) {
      clearTimeout(closeTimer.current);
      setClosingId(prev);
      closeTimer.current = setTimeout(() => setClosingId(null), TILL_FADE_OUT_MS);
    }
  }, []);

  const onToggle = useCallback((id) => {
    const next = expandedRef.current === id ? null : id;
    show(next);
    if (next !== null) markUsed(next).catch(() => {});
  }, [show, markUsed]);

  const onClose = useCallback(() => show(null), [show]);

  // Another screen (e.g. after adding a card) can ask for a card to be pulled out on arrival.
  const arrivalId = location.state?.expandId ?? null;
  useEffect(() => {
    if (status !== 'ready' || arrivalId === null) return;
    if (cards.some((c) => c.id === arrivalId)) show(arrivalId);
    navigate('.', { replace: true, state: null });
  }, [status, arrivalId, cards, show, navigate]);

  // Apply the most-recently-used order while nobody is looking.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && expandedRef.current === null) setFrozenIds(null);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // While a card is out the page must not scroll: the card's position was measured on the way out.
  useEffect(() => {
    if (expandedId === null) return undefined;
    const root = document.documentElement;
    root.classList.add('is-card-out');
    return () => root.classList.remove('is-card-out');
  }, [expandedId]);

  useWakeLock(expandedId !== null);

  // status 'unavailable' never reaches this page: the /app layout shows StorageUnavailable instead.
  let body = null;
  if (status === 'ready') {
    body = visibleCards.length === 0 ? (
      <EmptyWallet />
    ) : (
      <CardStack
        cards={visibleCards}
        expandedId={expandedId}
        closingId={closingId}
        reducedMotion={reducedMotion}
        onToggle={onToggle}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="wallet-page">
      <AppHeader dimmed={expandedId !== null} inert={expandedId !== null} />
      <main className="wallet-main" aria-busy={status === 'loading'}>
        {body}
      </main>
    </div>
  );
}

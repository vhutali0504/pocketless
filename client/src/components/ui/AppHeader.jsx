import { Link } from 'react-router-dom';

/**
 * Wallet header: wordmark and the "+" add button. Dims while a card is out at the till.
 * @param {{ dimmed?: boolean }} props
 */
export default function AppHeader({ dimmed = false }) {
  return (
    <header className={`app-header${dimmed ? ' is-dimmed' : ''}`}>
      <h1 className="app-header__title">Pocketless</h1>
      <Link to="/app/add" className="app-header__add" aria-label="Add a card">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </Link>
    </header>
  );
}

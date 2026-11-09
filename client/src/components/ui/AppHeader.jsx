import { Link } from 'react-router-dom';
import { inertProps } from './inert.js';
import useTheme from '../../hooks/useTheme.js';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <path
        d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Wallet header: wordmark, the light/dark switch and the "+" add button. Dims while a card is
 * out at the till, and is then `inert` so keyboard and screen reader users stay with the card.
 * @param {{ dimmed?: boolean, inert?: boolean }} props
 */
export default function AppHeader({ dimmed = false, inert = false }) {
  const { theme, toggle } = useTheme();
  const toLight = theme === 'dark';
  return (
    <header className={`app-header${dimmed ? ' is-dimmed' : ''}`} {...inertProps(inert)}>
      <h1 className="app-header__title">Pocketless</h1>
      <div className="app-header__actions">
        <button
          type="button"
          className="app-header__theme"
          onClick={toggle}
          aria-label={toLight ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {toLight ? <SunIcon /> : <MoonIcon />}
        </button>
        <Link to="/app/add" className="app-header__add" aria-label="Add a card">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

import '../../styles/wallet.css';

/**
 * Shown on every /app route when the browser won't let Pocketless keep cards (private windows,
 * blocked storage). Nothing here can fix that from inside the page, so it offers no buttons.
 */
export default function StorageUnavailable() {
  return (
    <div className="wallet-page">
      <header className="app-header">
        <h1 className="app-header__title">Pocketless</h1>
      </header>
      <main className="wallet-main">
        <p className="wallet-message">
          Pocketless can&apos;t save cards in this browser. If you&apos;re in a private or incognito
          window, open Pocketless in a normal window.
        </p>
      </main>
    </div>
  );
}

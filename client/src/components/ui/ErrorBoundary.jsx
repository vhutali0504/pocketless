import { Component } from 'react';
import Button from './Button.jsx';
import '../../styles/wallet.css';

/**
 * Catches a crash anywhere below it and shows a calm page instead of a blank screen. Cards live
 * in IndexedDB, so a reload loses nothing. The error goes to the console only, never the network.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Pocketless hit an error:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="wallet-page">
        <header className="app-header">
          <h1 className="app-header__title">Pocketless</h1>
        </header>
        <main className="wallet-main">
          <p className="wallet-message">Something went wrong. Your cards are safe on this phone.</p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </main>
      </div>
    );
  }
}

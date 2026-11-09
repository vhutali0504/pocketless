import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/App.jsx';

const COPY = "Pocketless can't save cards in this browser. If you're in a private or incognito window, open Pocketless in a normal window.";

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </MemoryRouter>,
  );
}

describe('storage-unavailable', () => {
  let original;
  let consoleError;
  beforeEach(() => {
    original = globalThis.indexedDB;
    delete globalThis.indexedDB;
    consoleError = vi.spyOn(console, 'error');
  });
  afterEach(() => {
    globalThis.indexedDB = original;
    consoleError.mockRestore();
  });

  it.each(['/app', '/app/add', '/app/cards/some-card'])('%s explains that cards cannot be saved, with no error', async (entry) => {
    renderAt(entry);
    expect(await screen.findByText(COPY)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Pocketless' })).toBeInTheDocument();
    expect(screen.queryByText("We couldn't find that card")).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });
});

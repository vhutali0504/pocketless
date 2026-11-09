import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AppHeader from '../../src/components/ui/AppHeader.jsx';
import { THEME_KEY } from '../../src/lib/theme.js';

function mockPhone(dark) {
  window.matchMedia = vi.fn((query) => ({
    matches: query.includes('dark') ? dark : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function renderHeader() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppHeader />
    </MemoryRouter>,
  );
}

describe('light/dark switch', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('follows the phone when nothing is chosen', () => {
    mockPhone(true);
    renderHeader();
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('switches a dark phone to light in the app and remembers it', async () => {
    mockPhone(true);
    const user = userEvent.setup();
    const { unmount } = renderHeader();
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();

    unmount();
    renderHeader();
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('can switch a light phone to dark', async () => {
    mockPhone(false);
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('keeps working when storage is blocked', async () => {
    mockPhone(true);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    setItem.mockRestore();
  });
});

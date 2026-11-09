import { render, screen, within, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { IDBFactory } from 'fake-indexeddb';
import { openCardStore } from '../../src/api/card-store.js';
import * as cards from '../../src/lib/cards.js';
import App from '../../src/App.jsx';

vi.mock('../../src/lib/cards.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, markUsed: vi.fn(actual.markUsed) };
});

const PNP = {
  owner: 'guest', storeKey: 'pnp-smart-shopper', displayName: 'Pick n Pay', programme: 'Smart Shopper',
  colour: '#B8232F', value: '4006381333931', format: 'EAN_13',
};
const CHECKERS = {
  owner: 'guest', storeKey: 'checkers-xtra-savings', displayName: 'Checkers', programme: 'Xtra Savings',
  colour: '#1F6F43', value: '9780201379624', format: 'EAN_13',
};

let store;
beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  store = await openCardStore();
  cards.markUsed.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  delete window.matchMedia;
});

async function seed(...inputs) {
  const out = [];
  for (const input of inputs) out.push(await cards.addCard(store, input));
  return out;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-state">{JSON.stringify(location.state)}</output>;
}

function renderWallet(entry = '/app') {
  return render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

/** Lets pending IndexedDB work (markUsed + refresh) finish inside act, so nothing updates after the test. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

const cardButton = (name) => screen.getByRole('button', { name });
const barcodeFor = (value) => screen.queryByRole('img', { name: `Barcode for ${value}` });

describe('WalletPage', () => {
  it('empty-state: invites the first card and links to /app/add', async () => {
    renderWallet();
    const link = await screen.findByRole('link', { name: 'Add your first card' });
    expect(link).toHaveAttribute('href', '/app/add');
    expect(screen.getByRole('heading', { name: 'Pocketless' })).toBeInTheDocument();
    const add = screen.getByRole('link', { name: 'Add a card' });
    expect(add).toHaveAttribute('href', '/app/add');
  });

  it('pull-out: tapping a card shows its barcode, tapping again puts it back', async () => {
    await seed(PNP, CHECKERS);
    renderWallet();
    const pnp = await screen.findByRole('button', { name: 'Pick n Pay, Smart Shopper' });
    expect(pnp).toHaveAttribute('aria-expanded', 'false');
    expect(barcodeFor(PNP.value)).not.toBeInTheDocument();

    fireEvent.click(pnp);
    expect(pnp).toHaveAttribute('aria-expanded', 'true');
    expect(barcodeFor(PNP.value)).toBeInTheDocument();
    expect(screen.getByText('4006 3813 3393 1')).toBeInTheDocument();
    expect(screen.getByText('Tap to put back')).toBeInTheDocument();
    const [card] = await store.list('guest').then((all) => all.filter((c) => c.storeKey === PNP.storeKey));
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `/app/cards/${card.id}`);

    fireEvent.click(pnp);
    expect(pnp).toHaveAttribute('aria-expanded', 'false');
    expect(barcodeFor(PNP.value)).not.toBeInTheDocument();
    expect(cards.markUsed).toHaveBeenCalledTimes(1);
    await settle();
    expect((await store.get(card.id)).lastUsedAt).not.toBeNull();
  });

  it('keeps the visible order while a card is out, even though markUsed reorders the data', async () => {
    await seed(PNP, CHECKERS);
    renderWallet();
    await screen.findByRole('button', { name: 'Pick n Pay, Smart Shopper' });
    const before = screen.getAllByRole('button', { name: /,/ }).map((b) => b.getAttribute('aria-label'));
    const last = cardButton(before[before.length - 1]);
    fireEvent.click(last);
    await settle();
    const during = screen.getAllByRole('button', { name: /,/ }).map((b) => b.getAttribute('aria-label'));
    expect(during).toEqual(before);
    fireEvent.click(last);
    await settle();
    const after = screen.getAllByRole('button', { name: /,/ }).map((b) => b.getAttribute('aria-label'));
    expect(after).toEqual(before);
  });

  it('keyboard: Enter pulls a card out, Escape puts it back and returns focus', async () => {
    await seed(PNP);
    const user = userEvent.setup();
    renderWallet();
    const pnp = await screen.findByRole('button', { name: 'Pick n Pay, Smart Shopper' });

    await user.tab(); // the "+" link in the header
    await user.tab();
    expect(pnp).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(pnp).toHaveAttribute('aria-expanded', 'true');
    expect(barcodeFor(PNP.value)).toBeInTheDocument();

    await user.tab(); // into the till view: the Edit link
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(pnp).toHaveAttribute('aria-expanded', 'false');
    expect(pnp).toHaveFocus();
    await settle();
  });

  it('keyboard: Space toggles too', async () => {
    await seed(PNP);
    const user = userEvent.setup();
    renderWallet();
    const pnp = await screen.findByRole('button', { name: 'Pick n Pay, Smart Shopper' });
    pnp.focus();
    await user.keyboard(' ');
    expect(pnp).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(pnp).toHaveAttribute('aria-expanded', 'false');
    await settle();
  });

  it('rapid-taps: the last intended state wins', async () => {
    await seed(PNP, CHECKERS);
    renderWallet();
    const a = await screen.findByRole('button', { name: 'Pick n Pay, Smart Shopper' });
    const b = cardButton('Checkers, Xtra Savings');

    vi.useFakeTimers();
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(a);
      act(() => { vi.advanceTimersByTime(10); });
    }
    fireEvent.click(b);
    act(() => { vi.runAllTimers(); });

    const expanded = screen.getAllByRole('button', { expanded: true });
    expect(expanded).toEqual([b]);
    expect(a).toHaveAttribute('aria-expanded', 'false');
    expect(barcodeFor(CHECKERS.value)).toBeInTheDocument();
    expect(barcodeFor(PNP.value)).not.toBeInTheDocument();

    vi.useRealTimers();
    await settle();
  });

  it('long-names-and-200-cards: renders all cards, truncates long names, pulls out the last one', async () => {
    const longName = 'The Very Long Name Of A Neighbourhood Co';
    expect(longName).toHaveLength(40);
    const inputs = Array.from({ length: 200 }, (_, i) => ({
      owner: 'guest', storeKey: 'other', displayName: i === 7 ? longName : `Store ${i + 1}`,
      programme: 'Rewards', colour: '#3D3D3D', value: `CARD-${i + 1}`, format: 'CODE_128',
    }));
    await seed(...inputs);
    renderWallet();
    await screen.findByRole('button', { name: `${longName}, Rewards` });

    const buttons = screen.getAllByRole('button', { name: /, Rewards$/ });
    expect(buttons).toHaveLength(200);

    const nameEl = within(cardButton(`${longName}, Rewards`)).getByText(longName);
    const style = getComputedStyle(nameEl);
    expect(style.textOverflow).toBe('ellipsis');
    expect(style.overflow).toBe('hidden');
    expect(style.whiteSpace).toBe('nowrap');

    const last = buttons[199];
    fireEvent.click(last);
    expect(last).toHaveAttribute('aria-expanded', 'true');
    const label = last.getAttribute('aria-label');
    const value = inputs.find((i) => `${i.displayName}, ${i.programme}` === label).value;
    expect(barcodeFor(value)).toBeInTheDocument();
    await settle();
  }, 30000);

  it('reduced-motion: the stack root gets the reduced-motion class with near-zero transitions', async () => {
    window.matchMedia = vi.fn((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    await seed(PNP);
    const { container } = renderWallet();
    const pnp = await screen.findByRole('button', { name: 'Pick n Pay, Smart Shopper' });
    const root = container.querySelector('.wallet-stack');
    expect(root).toHaveClass('reduced-motion');
    const card = pnp.closest('.wallet-card');
    expect(getComputedStyle(card).transitionDuration).toBe('0.01ms');
  });

  it('without reduced motion, cards slide with the 340 ms card motion', async () => {
    await seed(PNP);
    const { container } = renderWallet();
    const pnp = await screen.findByRole('button', { name: 'Pick n Pay, Smart Shopper' });
    expect(container.querySelector('.wallet-stack')).not.toHaveClass('reduced-motion');
    const transition = getComputedStyle(pnp.closest('.wallet-card')).transition;
    expect(transition).toContain('transform');
    expect(transition).not.toMatch(/height|top/);
  });

  it('pulls out the card named in location.state.expandId on arrival, then clears the state', async () => {
    const [, checkers] = await seed(PNP, CHECKERS);
    renderWallet({ pathname: '/app', state: { expandId: checkers.id } });
    const button = await screen.findByRole('button', { name: 'Checkers, Xtra Savings' });
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'true'));
    expect(barcodeFor(CHECKERS.value)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location-state')).toHaveTextContent('null'));

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await settle();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('dims the header while a card is out', async () => {
    await seed(PNP);
    renderWallet();
    const pnp = await screen.findByRole('button', { name: 'Pick n Pay, Smart Shopper' });
    const header = screen.getByRole('banner');
    expect(header).not.toHaveClass('is-dimmed');
    fireEvent.click(pnp);
    expect(header).toHaveClass('is-dimmed');
    fireEvent.click(pnp);
    expect(header).not.toHaveClass('is-dimmed');
    await settle();
  });
});

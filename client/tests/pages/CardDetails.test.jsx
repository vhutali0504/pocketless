import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { IDBFactory } from 'fake-indexeddb';
import { openCardStore } from '../../src/api/card-store.js';
import { addCard } from '../../src/lib/cards.js';
import { OTHER_PALETTE } from '../../src/lib/stores.js';
import App from '../../src/App.jsx';

const CLICKS = {
  owner: 'guest', storeKey: 'clicks-clubcard', displayName: 'Clicks', programme: 'ClubCard',
  colour: '#0B4F8A', value: '4006381333931', format: 'EAN_13',
};
const OTHER = {
  owner: 'guest', storeKey: 'other', displayName: 'Bookshop', programme: '',
  colour: OTHER_PALETTE[0], value: '9780306406157', format: 'EAN_13',
};

let store;
beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  store = await openCardStore();
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

async function openDetails(input = CLICKS) {
  const card = await addCard(store, input);
  const user = userEvent.setup();
  renderAt(`/app/cards/${card.id}`);
  await screen.findByLabelText('Card name');
  return { card, user };
}

describe('Card details', () => {
  it('renames the card and the wallet shows the new name', async () => {
    const { card, user } = await openDetails();
    const input = screen.getByLabelText('Card name');
    await user.clear(input);
    await user.type(input, "  Mom's Clicks ");
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    expect((await store.get(card.id)).displayName).toBe("Mom's Clicks");
    await user.click(screen.getByRole('link', { name: /back/i }));
    expect(await screen.findByRole('button', { name: /Mom's Clicks/ })).toBeInTheDocument();
  });

  it('refuses an empty name with an inline error and saves nothing', async () => {
    const { card, user } = await openDetails();
    await user.clear(screen.getByLabelText('Card name'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a name for this card')).toBeInTheDocument();
    expect(screen.getByLabelText('Card name')).toHaveAttribute('aria-invalid', 'true');
    expect((await store.get(card.id)).displayName).toBe('Clicks');
  });

  it('offers the store colour first, then the palette, and saves a picked colour', async () => {
    const { card, user } = await openDetails();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(OTHER_PALETTE.length + 1);
    expect(radios[0]).toHaveAttribute('value', '#0B4F8A');
    expect(radios[0]).toBeChecked();
    expect(radios[0]).toHaveAccessibleName(/Clicks/);
    await user.click(radios[3]);
    await waitFor(async () => expect((await store.get(card.id)).colour).toBe(OTHER_PALETTE[2]));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
  });

  it('shows only the palette for other stores', async () => {
    await openDetails(OTHER);
    expect(screen.getAllByRole('radio')).toHaveLength(OTHER_PALETTE.length);
  });

  it('pins the card to the top', async () => {
    const { card, user } = await openDetails();
    await addCard(store, { ...OTHER, displayName: 'Newer' });
    const toggle = screen.getByRole('switch', { name: 'Pin to top' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Pin to top' })).toHaveAttribute('aria-checked', 'true'));
    expect((await store.get(card.id)).pinned).toBe(true);

    // Back in the wallet, the pinned card comes first even though "Newer" was added after it.
    await user.click(screen.getByRole('link', { name: /back/i }));
    await screen.findByRole('button', { name: 'Newer' });
    const order = screen.getAllByRole('button', { expanded: false }).map((b) => b.getAttribute('aria-label'));
    expect(order).toEqual(['Clicks, ClubCard', 'Newer']);
  });

  it('changes the number through entry and confirm, saving only after confirming', async () => {
    const { card, user } = await openDetails();
    await user.click(screen.getByRole('button', { name: 'Change number' }));
    const input = screen.getByLabelText('Card number');
    await user.clear(input);
    await user.type(input, '9780306406157');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Does this number match the one printed on your card?')).toBeInTheDocument();
    expect((await store.get(card.id)).value).toBe('4006381333931');
    await user.click(screen.getByRole('button', { name: 'Yes, save card' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    const saved = await store.get(card.id);
    expect(saved.value).toBe('9780306406157');
    expect(saved.format).toBe('EAN_13');
  });

  it('cancelling a number change leaves the card alone', async () => {
    const { card, user } = await openDetails();
    await user.click(screen.getByRole('button', { name: 'Change number' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Card name')).toBeInTheDocument();
    expect((await store.get(card.id)).value).toBe('4006381333931');
  });

  it('shows the duplicate state when the new number belongs to another card', async () => {
    await addCard(store, { ...CLICKS, displayName: 'Mine', value: '9780306406157' });
    const { card, user } = await openDetails();
    await user.click(screen.getByRole('button', { name: 'Change number' }));
    const input = screen.getByLabelText('Card number');
    await user.clear(input);
    await user.type(input, '9780306406157');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, save card' }));
    expect(await screen.findByText('You already have this card')).toBeInTheDocument();
    expect((await store.get(card.id)).value).toBe('4006381333931');
    await user.click(screen.getByRole('button', { name: 'Open it' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/app$/);
  });

  it('deletes after confirming and returns to the wallet', async () => {
    const { card, user } = await openDetails();
    await user.click(screen.getByRole('button', { name: 'Delete card' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete this card?')).toBeInTheDocument();
    expect(within(dialog).getByText('You can add it again later.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/app$/));
    const remaining = (await store.list('guest')).filter((c) => c.id === card.id && !c.deletedAt);
    expect(remaining).toHaveLength(0);
  });

  it('cancelling the delete changes nothing', async () => {
    const { card, user } = await openDetails();
    await user.click(screen.getByRole('button', { name: 'Delete card' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(`/app/cards/${card.id}`);
    expect((await store.get(card.id)).deletedAt).toBeNull();
  });

  it('says so when the card does not exist', async () => {
    renderAt('/app/cards/nope');
    expect(await screen.findByText("We couldn't find that card")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Back to your cards' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/app$/);
  });

  it('treats a deleted card as not found', async () => {
    const card = await addCard(store, CLICKS);
    await store.put({ ...card, deletedAt: new Date().toISOString() });
    renderAt(`/app/cards/${card.id}`);
    expect(await screen.findByText("We couldn't find that card")).toBeInTheDocument();
  });
});

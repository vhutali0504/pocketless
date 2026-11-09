import { useState } from 'react';
import { render, screen, act, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { IDBFactory } from 'fake-indexeddb';
import { openCardStore } from '../../src/api/card-store.js';
import { addCard } from '../../src/lib/cards.js';
import { OTHER_PALETTE } from '../../src/lib/stores.js';
import App from '../../src/App.jsx';
import ManualEntry from '../../src/pages/app/add/ManualEntry.jsx';
import ConfirmStep from '../../src/pages/app/add/ConfirmStep.jsx';
import ConfirmDialog from '../../src/components/ui/ConfirmDialog.jsx';

const scanners = vi.hoisted(() => ({ list: [], onStart: null }));

vi.mock('../../src/api/scanner.js', () => ({
  createScanner: vi.fn((video, opts) => {
    const instance = {
      video,
      opts,
      start: vi.fn(async () => {
        if (scanners.onStart) scanners.onStart(instance);
      }),
      stop: vi.fn(),
    };
    scanners.list.push(instance);
    return instance;
  }),
}));

const CLICKS = {
  owner: 'guest', storeKey: 'clicks-clubcard', displayName: 'Clicks', programme: 'ClubCard',
  colour: '#0B4F8A', value: '4006381333931', format: 'EAN_13',
};
const GOOD_READ = { value: '4006381333931', format: 'EAN_13' };
const SA_ID = '8001015009087';
const SA_ID_COPY =
  "This looks like an SA ID number. Loyalty cards don't need your ID number. Only save it if it's really your card number.";
const CONFIRM_QUESTION = 'Does this number match the one printed on your card?';

let store;
beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  store = await openCardStore();
  scanners.list.length = 0;
  scanners.onStart = null;
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderAt(entry = '/app/add') {
  return render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const latest = () => scanners.list[scanners.list.length - 1];

/** Delivers `times` camera frames, each holding the given read(s). */
function emit(read, times = 1) {
  const reads = Array.isArray(read) ? read : [read];
  act(() => {
    for (let i = 0; i < times; i += 1) latest().opts.onFrame(reads);
  });
}

async function pickStore(user, name) {
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }));
  await waitFor(() => expect(latest()?.start).toHaveBeenCalled());
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

describe('AddCardPage', () => {
  it('happy-path: pick Clicks, three identical reads, confirm, lands on /app with Clicks out', async () => {
    const user = userEvent.setup();
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Add a card' })).toBeInTheDocument();
    await pickStore(user, 'Clicks');

    const scanner = latest();
    expect(scanner.opts.formats).toBeUndefined(); // Clicks has no expected formats: scan everything
    expect(scanner.video.tagName).toBe('VIDEO');
    expect(scanner.video).toHaveAttribute('playsinline');
    expect(scanner.video).toHaveAttribute('muted');
    expect(scanner.video).toHaveAttribute('autoplay');
    expect(screen.getByText('Hold the barcode on the back of your card inside the box')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Type the number instead' })).toBeInTheDocument();

    emit(GOOD_READ, 2);
    expect(screen.queryByText(CONFIRM_QUESTION)).not.toBeInTheDocument();
    emit(GOOD_READ);

    expect(await screen.findByText(CONFIRM_QUESTION)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Check your card' })).toBeInTheDocument();
    expect(screen.getByText('4006 3813 3393 1')).toBeInTheDocument();
    expect(scanner.stop).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Yes, save card' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/app$/));
    const card = await screen.findByRole('button', { name: 'Clicks, ClubCard' });
    await waitFor(() => expect(card).toHaveAttribute('aria-expanded', 'true'));

    const saved = await store.list('guest');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      storeKey: 'clicks-clubcard', displayName: 'Clicks', programme: 'ClubCard', colour: '#0B4F8A',
      value: '4006381333931', format: 'EAN_13',
    });
    await settle();
  });

  it('not-saved-without-confirm: nothing is stored until "Yes, save card"; "No, scan again" resets consensus', async () => {
    const user = userEvent.setup();
    renderAt();
    await pickStore(user, 'Clicks');
    const first = latest();
    emit(GOOD_READ, 3);
    await screen.findByText(CONFIRM_QUESTION);
    expect(await store.list('guest')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'No, scan again' }));
    await waitFor(() => expect(scanners.list).toHaveLength(2));
    expect(first.stop).toHaveBeenCalled();
    await waitFor(() => expect(latest().start).toHaveBeenCalled());
    expect(screen.getByText('Hold the barcode on the back of your card inside the box')).toBeInTheDocument();

    emit(GOOD_READ, 2);
    expect(screen.queryByText(CONFIRM_QUESTION)).not.toBeInTheDocument();
    emit(GOOD_READ);
    expect(await screen.findByText(CONFIRM_QUESTION)).toBeInTheDocument();
    expect(await store.list('guest')).toHaveLength(0);
  });

  it('has exactly one main landmark on every step', async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole('button', { name: /^Clicks/ });
    expect(screen.getAllByRole('main')).toHaveLength(1);
    await pickStore(user, 'Clicks');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Type the number instead' }));
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('accepts a code seen in 3 frames in a row even when another code is in view too', async () => {
    const user = userEvent.setup();
    renderAt();
    await pickStore(user, 'Clicks');
    const other = { value: '5901234123457', format: 'EAN_13' };
    emit([GOOD_READ, other], 2);
    expect(screen.queryByText(CONFIRM_QUESTION)).not.toBeInTheDocument();
    emit([GOOD_READ, other]);
    expect(await screen.findByText(CONFIRM_QUESTION)).toBeInTheDocument();
    expect(latest().stop).toHaveBeenCalled();
  });

  it('ignores reads that fail the checksum or the value rules, and onFrame never throws', async () => {
    const user = userEvent.setup();
    renderAt();
    await pickStore(user, 'Clicks');
    const { onFrame } = latest().opts;
    expect(() => onFrame([{ value: null, format: 'EAN_13' }])).not.toThrow();
    expect(() => onFrame([undefined])).not.toThrow();
    expect(() => onFrame(undefined)).not.toThrow();
    emit({ value: '4006381333932', format: 'EAN_13' }, 3); // bad check digit
    emit({ value: 'A'.repeat(65), format: 'CODE_128' }, 3); // longer than a card value may be
    expect(screen.queryByText(CONFIRM_QUESTION)).not.toBeInTheDocument();
  });

  it.each([
    [
      'permission',
      "Pocketless needs the camera to scan your card. You can allow it in your phone's settings, or type the number instead.",
    ],
    ['unavailable', "We couldn't find a camera on this device."],
  ])('scan-permission-denied: %s shows the message and focuses "Type the number instead"', async (kind, message) => {
    scanners.onStart = (instance) => instance.opts.onError({ kind });
    const user = userEvent.setup();
    renderAt();
    await pickStore(user, 'Clicks');
    expect(await screen.findByText(message)).toBeInTheDocument();
    const typeButton = screen.getByRole('button', { name: 'Type the number instead' });
    await waitFor(() => expect(typeButton).toHaveFocus());
    await user.click(typeButton);
    expect(screen.getByLabelText('Card number')).toBeInTheDocument();
  });

  it('manual-entry: a spaced number is normalised, inferred as EAN_13 and confirmed', async () => {
    const user = userEvent.setup();
    renderAt();
    await pickStore(user, 'Clicks');
    const scanner = latest();
    await user.click(screen.getByRole('button', { name: 'Type the number instead' }));
    expect(scanner.stop).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter the number from your card')).toBeInTheDocument();
    expect(screen.getByLabelText('Card number')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Card number'), '4006 3813 33931');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(CONFIRM_QUESTION)).toBeInTheDocument();
    expect(screen.getByText('4006 3813 3393 1')).toBeInTheDocument();

    // Back from a typed number returns to the typing step, number kept.
    await user.click(screen.getByRole('button', { name: 'No, type it again' }));
    expect(screen.getByLabelText('Card number')).toHaveValue('4006 3813 33931');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, save card' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/app$/));
    const [saved] = await store.list('guest');
    expect(saved).toMatchObject({ value: '4006381333931', format: 'EAN_13' });
    await settle();
  });

  it('manual-entry: too long a value shows the inline error', async () => {
    const user = userEvent.setup();
    renderAt();
    await pickStore(user, 'Clicks');
    await user.click(screen.getByRole('button', { name: 'Type the number instead' }));
    fireEvent.change(screen.getByLabelText('Card number'), { target: { value: 'A'.repeat(65) } });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText("That's longer than a card number can be.")).toBeInTheDocument();
    expect(screen.queryByText(CONFIRM_QUESTION)).not.toBeInTheDocument();
  });

  it('sa-id-warning (typed): needs "Save anyway" plus the normal confirm; Cancel returns to entry', async () => {
    const user = userEvent.setup();
    renderAt();
    await pickStore(user, 'Clicks');
    await user.click(screen.getByRole('button', { name: 'Type the number instead' }));
    await user.type(screen.getByLabelText('Card number'), SA_ID);
    const submit = screen.getByRole('button', { name: 'Continue' });
    await user.click(submit);

    let dialog = screen.getByRole('dialog', { name: 'Is this your ID number?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText(SA_ID_COPY)).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Card number')).toHaveValue(SA_ID);
    expect(submit).toHaveFocus();

    await user.click(submit);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(submit);
    dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save anyway' }));
    expect(await screen.findByText(CONFIRM_QUESTION)).toBeInTheDocument();
    expect(await store.list('guest')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Yes, save card' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/app$/));
    expect(await store.list('guest')).toHaveLength(1);
    await settle();
  });

  it('sa-id-warning (scanned): the warning shows before the confirm step; Cancel scans again', async () => {
    const user = userEvent.setup();
    renderAt();
    await pickStore(user, 'Clicks');
    emit({ value: SA_ID, format: 'CODE_128' }, 3);
    const dialog = await screen.findByRole('dialog', { name: 'Is this your ID number?' });
    expect(screen.queryByText(CONFIRM_QUESTION)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(scanners.list).toHaveLength(2));
    await waitFor(() => expect(latest().start).toHaveBeenCalled());

    emit({ value: SA_ID, format: 'CODE_128' }, 3);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save anyway' }));
    expect(await screen.findByText(CONFIRM_QUESTION)).toBeInTheDocument();
    expect(await store.list('guest')).toHaveLength(0);
  });

  it('duplicate-card: warns "You already have this card", offers "Open it", stores nothing new', async () => {
    const existing = await addCard(store, CLICKS);
    const user = userEvent.setup();
    renderAt();
    await pickStore(user, 'Clicks');
    emit(GOOD_READ, 3);
    await user.click(await screen.findByRole('button', { name: 'Yes, save card' }));

    expect(await screen.findByText('You already have this card')).toBeInTheDocument();
    expect(await store.list('guest')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Open it' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/app$/));
    const card = await screen.findByRole('button', { name: 'Clicks, ClubCard' });
    await waitFor(() => expect(card).toHaveAttribute('aria-expanded', 'true'));
    expect(card).toHaveAttribute('data-card-id', existing.id);
    expect(await store.list('guest')).toHaveLength(1);
    await settle();
  });

  it('card-limit: a full wallet shows the 200-card message instead of crashing', async () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 200; i += 1) {
      await store.put({
        id: `card-${i}`, owner: 'guest', storeKey: 'other', displayName: `Store ${i}`, programme: '',
        colour: '#3D3D3D', value: `CARD-${i}`, format: 'CODE_128', pinned: false, sortHint: i,
        lastUsedAt: null, createdAt: now, updatedAt: now, deletedAt: null,
      });
    }
    const user = userEvent.setup();
    renderAt();
    await pickStore(user, 'Clicks');
    emit(GOOD_READ, 3);
    await user.click(await screen.findByRole('button', { name: 'Yes, save card' }));
    expect(
      await screen.findByText("You've reached the 200-card limit. Delete a card you don't use to add a new one."),
    ).toBeInTheDocument();
    expect(await store.list('guest')).toHaveLength(200);
  }, 30000);

  it('other-store: needs a name (1-40) and a palette colour before scanning', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(await screen.findByRole('button', { name: /^Other store/ }));
    const name = screen.getByLabelText('Store name');
    expect(name).toHaveAttribute('maxLength', '40');

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText("Enter the store's name")).toBeInTheDocument();
    expect(screen.getByText('Choose a colour')).toBeInTheDocument();
    expect(scanners.list).toHaveLength(0);

    await user.type(name, '   ');
    await user.click(screen.getByRole('radio', { name: 'Colour 3 of 8' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText("Enter the store's name")).toBeInTheDocument();
    expect(scanners.list).toHaveLength(0);

    await user.clear(name);
    await user.type(name, '  Spar  ');
    expect(screen.getAllByRole('radio')).toHaveLength(8);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(latest()?.start).toHaveBeenCalled());
    expect(screen.getByRole('heading', { name: 'Scan your Spar card' })).toBeInTheDocument();

    emit({ value: 'SPAR-001', format: 'CODE_128' }, 3);
    await user.click(await screen.findByRole('button', { name: 'Yes, save card' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/app$/));
    const [saved] = await store.list('guest');
    expect(saved).toMatchObject({
      storeKey: 'other', displayName: 'Spar', programme: '', colour: OTHER_PALETTE[2],
      value: 'SPAR-001', format: 'CODE_128',
    });
    await settle();
  });

  it('store picker: searches stores and keeps "Other store" last', async () => {
    const user = userEvent.setup();
    renderAt();
    const search = await screen.findByLabelText('Search stores');
    await user.type(search, 'club');
    const list = screen.getByRole('list');
    const names = within(list).getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['ClicksClubCard', 'Other store']);
    await user.clear(search);
    await user.type(search, 'woolworths');
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['Other store']);
  });

  it('scanner-stopped: Back from the scan step stops the scanner and returns to the store list', async () => {
    const user = userEvent.setup();
    renderAt();
    await pickStore(user, 'Clicks');
    const scanner = latest();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(scanner.stop).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Add a card' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/app$/);
    await settle();
  });

  it('scanner-stopped: leaving the route (unmount) stops the scanner', async () => {
    const user = userEvent.setup();
    const { unmount } = renderAt();
    await pickStore(user, 'Clicks');
    const scanner = latest();
    expect(scanner.stop).not.toHaveBeenCalled();
    unmount();
    expect(scanner.stop).toHaveBeenCalled();
  });
});

describe('ManualEntry', () => {
  const NUMERIC_STORE = {
    key: 'numeric', name: 'Numeric Mart', programme: 'Points', colour: '#1C3A6B',
    expectedFormats: ['EAN_13'], expectedLength: 13,
  };

  it('blocks characters a numeric-only store number cannot have', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ManualEntry store={NUMERIC_STORE} initialValue="" onSubmit={onSubmit} onCancel={() => {}} />);
    await user.type(screen.getByLabelText('Card number'), '12a');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText("That number has characters a card number can't have.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the normalised value and the expected format when it fits', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ManualEntry store={NUMERIC_STORE} initialValue="4006-3813-33931" onSubmit={onSubmit} onCancel={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onSubmit).toHaveBeenCalledWith({ value: '4006381333931', format: 'EAN_13' });
  });
});

describe('ConfirmStep', () => {
  const draft = (store, value, format) => ({
    store, displayName: store.name, programme: store.programme, colour: store.colour, value, format,
  });
  const renderStep = (props) => render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ConfirmStep onConfirm={() => {}} onRetry={() => {}} error={null} {...props} />
    </MemoryRouter>,
  );

  it("shows a soft warning when the number doesn't match the store's expected length, without blocking", async () => {
    const onConfirm = vi.fn();
    const store = { key: 'x', name: 'Numeric Mart', programme: 'Points', colour: '#1C3A6B', expectedFormats: null, expectedLength: 16 };
    renderStep({ draft: draft(store, '4006381333931', 'EAN_13'), onConfirm });
    expect(
      screen.getByText("That doesn't look like a Numeric Mart card number. Check it against your card."),
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Yes, save card' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("warns when the format isn't one the store expects, and is quiet when it fits", () => {
    const store = { key: 'x', name: 'Numeric Mart', programme: 'Points', colour: '#1C3A6B', expectedFormats: ['EAN_13'], expectedLength: null };
    const { unmount } = renderStep({ draft: draft(store, 'ABC-1', 'CODE_128') });
    expect(screen.getByText(/doesn't look like a Numeric Mart card number/)).toBeInTheDocument();
    unmount();
    renderStep({ draft: draft(store, '4006381333931', 'EAN_13') });
    expect(screen.queryByText(/doesn't look like/)).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  function Harness({ onConfirm = () => {} }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>Open</button>
        <ConfirmDialog
          open={open}
          title="Sure?"
          body="Really sure?"
          confirmLabel="Yes"
          cancelLabel="No"
          onConfirm={() => { onConfirm(); setOpen(false); }}
          onCancel={() => setOpen(false)}
        />
      </>
    );
  }

  it('traps Tab, cancels on Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Sure?' });
    expect(dialog).toHaveAccessibleDescription('Really sure?');
    const yes = within(dialog).getByRole('button', { name: 'Yes' });
    const no = within(dialog).getByRole('button', { name: 'No' });
    expect(no).toHaveFocus();
    await user.tab();
    expect(yes).toHaveFocus();
    await user.tab();
    expect(no).toHaveFocus();
    await user.tab({ shift: true });
    expect(yes).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

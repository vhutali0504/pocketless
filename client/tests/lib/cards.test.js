import { IDBFactory } from 'fake-indexeddb';
import { openCardStore } from '../../src/api/card-store.js';
import {
  MAX_CARDS, LIMITS, ValidationError, CardLimitError, DuplicateCardError, CardNotFoundError,
  addCard, updateCard, deleteCard, markUsed, sortWallet,
} from '../../src/lib/cards.js';

const input = (over = {}) => ({
  owner: 'guest', storeKey: 'checkers', displayName: 'Checkers', programme: 'Xtra Savings',
  colour: '#009639', value: '4006381333931', format: 'EAN_13', ...over,
});

let store;
beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  store = await openCardStore();
});
afterEach(() => vi.useRealTimers());

const rejection = async (p) => {
  try { await p; } catch (e) { return e; }
  throw new Error('did not reject');
};

describe('constants', () => {
  it('has the agreed limits', () => {
    expect(MAX_CARDS).toBe(200);
    expect(LIMITS).toEqual({ displayName: 40, programme: 40, value: 64 });
  });
});

describe('addCard', () => {
  it('normalises the value and sets defaults', async () => {
    const card = await addCard(store, input({ value: ' 4006 381333931' }));
    expect(card.value).toBe('4006381333931');
    expect(card.pinned).toBe(false);
    expect(card.lastUsedAt).toBeNull();
    expect(card.deletedAt).toBeNull();
    expect(card.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof card.sortHint).toBe('number');
    expect(new Date(card.createdAt).toISOString()).toBe(card.createdAt);
    expect(card.updatedAt).toBe(card.createdAt);
    expect(await store.get(card.id)).toEqual(card);
  });

  it('rejects a 41-character displayName', async () => {
    const e = await rejection(addCard(store, input({ displayName: 'x'.repeat(41) })));
    expect(e).toBeInstanceOf(ValidationError);
    expect(e.name).toBe('ValidationError');
    expect(e.field).toBe('displayName');
    expect(e.reason).toBe('too_long');
  });

  it('rejects empty displayName, long programme, bad colour, bad value, empty storeKey', async () => {
    const f = async (over) => rejection(addCard(store, input(over)));
    let e = await f({ displayName: '   ' });
    expect([e.field, e.reason]).toEqual(['displayName', 'empty']);
    e = await f({ programme: 'x'.repeat(41) });
    expect([e.field, e.reason]).toEqual(['programme', 'too_long']);
    e = await f({ colour: 'green' });
    expect([e.field, e.reason]).toEqual(['colour', 'bad_format']);
    e = await f({ value: '4006381333932' });
    expect([e.field, e.reason]).toEqual(['value', 'bad_checksum']);
    e = await f({ storeKey: '' });
    expect(e).toBeInstanceOf(ValidationError);
    expect(e.field).toBe('storeKey');
  });

  it('trims text and allows an empty programme', async () => {
    const card = await addCard(store, input({ displayName: '  Checkers ', programme: '  ' }));
    expect(card.displayName).toBe('Checkers');
    expect(card.programme).toBe('');
  });

  it('throws CardLimitError on the 201st card', async () => {
    for (let i = 0; i < MAX_CARDS; i += 1) {
      await addCard(store, input({ format: 'CODE_128', value: `V${i}` }));
    }
    await expect(addCard(store, input({ format: 'CODE_128', value: 'extra' }))).rejects.toBeInstanceOf(CardLimitError);
  }, 30000);

  it('throws DuplicateCardError carrying the first id', async () => {
    const first = await addCard(store, input());
    const e = await rejection(addCard(store, input({ value: '4006 381333931' })));
    expect(e).toBeInstanceOf(DuplicateCardError);
    expect(e.existingId).toBe(first.id);
  });

  it('allows the same value at a different store', async () => {
    await addCard(store, input());
    await expect(addCard(store, input({ storeKey: 'pnp' }))).resolves.toBeDefined();
  });

  it('allows adding again after a delete', async () => {
    const first = await addCard(store, input());
    await deleteCard(store, first.id);
    await expect(addCard(store, input())).resolves.toBeDefined();
  });
});

describe('updateCard', () => {
  it('updates fields, bumps updatedAt, keeps id/owner/createdAt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z'));
    const card = await addCard(store, input());
    vi.setSystemTime(new Date('2026-11-09T12:00:00.000Z'));
    const updated = await updateCard(store, card.id, {
      displayName: ' New name ', pinned: true,
      id: 'hack', owner: 'other', createdAt: '2000-01-01T00:00:00.000Z',
      lastUsedAt: 5, deletedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(updated.displayName).toBe('New name');
    expect(updated.pinned).toBe(true);
    expect(updated.id).toBe(card.id);
    expect(updated.owner).toBe('guest');
    expect(updated.createdAt).toBe(card.createdAt);
    expect(updated.lastUsedAt).toBeNull();
    expect(updated.deletedAt).toBeNull();
    expect(updated.updatedAt).toBe('2026-11-09T12:00:00.000Z');
    expect(await store.get(card.id)).toEqual(updated);
  });

  it('validates only fields in the patch', async () => {
    const card = await addCard(store, input());
    const e = await rejection(updateCard(store, card.id, { displayName: '' }));
    expect([e.field, e.reason]).toEqual(['displayName', 'empty']);
    const e2 = await rejection(updateCard(store, card.id, { colour: 'nope' }));
    expect(e2.field).toBe('colour');
  });

  it('re-validates the value, and the existing value when only format changes', async () => {
    const card = await addCard(store, input());
    const e = await rejection(updateCard(store, card.id, { value: '123' }));
    expect(e.field).toBe('value');
    const e2 = await rejection(updateCard(store, card.id, { format: 'EAN_8' }));
    expect([e2.field, e2.reason]).toEqual(['value', 'bad_checksum']);
    const ok = await updateCard(store, card.id, { format: 'CODE_128' });
    expect(ok.format).toBe('CODE_128');
  });

  it('re-runs the duplicate check excluding itself', async () => {
    const a = await addCard(store, input());
    const b = await addCard(store, input({ storeKey: 'pnp' }));
    await expect(updateCard(store, a.id, { value: a.value })).resolves.toBeDefined();
    const e = await rejection(updateCard(store, b.id, { storeKey: 'checkers' }));
    expect(e).toBeInstanceOf(DuplicateCardError);
    expect(e.existingId).toBe(a.id);
  });

  it('throws CardNotFoundError for unknown or deleted ids', async () => {
    const e = await rejection(updateCard(store, 'nope', {}));
    expect(e).toBeInstanceOf(CardNotFoundError);
    expect(e.id).toBe('nope');
    const card = await addCard(store, input());
    await deleteCard(store, card.id);
    await expect(updateCard(store, card.id, {})).rejects.toBeInstanceOf(CardNotFoundError);
  });
});

describe('deleteCard and markUsed', () => {
  it('soft-deletes, setting deletedAt and updatedAt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z'));
    const card = await addCard(store, input());
    vi.setSystemTime(new Date('2026-11-09T13:00:00.000Z'));
    await deleteCard(store, card.id);
    const stored = await store.get(card.id);
    expect(stored.deletedAt).toBe('2026-11-09T13:00:00.000Z');
    expect(stored.updatedAt).toBe('2026-11-09T13:00:00.000Z');
    await expect(deleteCard(store, card.id)).rejects.toBeInstanceOf(CardNotFoundError);
  });

  it('markUsed sets lastUsedAt and leaves updatedAt unchanged', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z'));
    const card = await addCard(store, input());
    vi.setSystemTime(new Date('2026-11-09T14:00:00.000Z'));
    await markUsed(store, card.id);
    const stored = await store.get(card.id);
    expect(stored.lastUsedAt).toBe(Date.parse('2026-11-09T14:00:00.000Z'));
    expect(stored.updatedAt).toBe(card.updatedAt);
    await expect(markUsed(store, 'nope')).rejects.toBeInstanceOf(CardNotFoundError);
  });
});

describe('sortWallet', () => {
  it('orders pinned, then recently used, then newest', () => {
    const c = (id, o) => ({ id, pinned: false, lastUsedAt: null, sortHint: 0, ...o });
    const cards = [
      c('never-used-old', { sortHint: 1 }),
      c('used-yesterday', { lastUsedAt: 1000 }),
      c('never-used-new', { sortHint: 9 }),
      c('pinned-old', { pinned: true, sortHint: 0 }),
      c('used-today', { lastUsedAt: 2000 }),
    ];
    const sorted = sortWallet(cards).map((x) => x.id);
    expect(sorted).toEqual(['pinned-old', 'used-today', 'used-yesterday', 'never-used-new', 'never-used-old']);
    expect(cards[0].id).toBe('never-used-old');
  });
});

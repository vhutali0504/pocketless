import { IDBFactory } from 'fake-indexeddb';
import { openCardStore, StorageUnavailableError } from '../../src/api/card-store.js';

const make = (over = {}) => ({
  id: 'a', owner: 'guest', storeKey: 'checkers', displayName: 'Checkers', programme: 'Xtra Savings',
  colour: '#009639', value: '4006381333931', format: 'EAN_13', pinned: false, sortHint: 1,
  lastUsedAt: null, createdAt: '2026-11-09T10:00:00.000Z', updatedAt: '2026-11-09T10:00:00.000Z',
  deletedAt: null, ...over,
});

describe('card store', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('round-trips a card with put and get', async () => {
    const store = await openCardStore();
    await store.put(make());
    expect(await store.get('a')).toEqual(make());
    expect(await store.get('missing')).toBeUndefined();
  });

  it('list excludes soft-deleted cards and other owners', async () => {
    const store = await openCardStore();
    await store.put(make({ id: 'a' }));
    await store.put(make({ id: 'b', deletedAt: '2026-11-09T11:00:00.000Z' }));
    await store.put(make({ id: 'c', owner: 'user-2' }));
    const ids = (await store.list('guest')).map((c) => c.id);
    expect(ids).toEqual(['a']);
  });

  it('get still returns soft-deleted cards', async () => {
    const store = await openCardStore();
    await store.put(make({ deletedAt: '2026-11-09T11:00:00.000Z' }));
    expect((await store.get('a')).deletedAt).not.toBeNull();
  });

  it('rejects with StorageUnavailableError when indexedDB is missing', async () => {
    const original = globalThis.indexedDB;
    delete globalThis.indexedDB;
    try {
      await expect(openCardStore()).rejects.toBeInstanceOf(StorageUnavailableError);
    } finally {
      globalThis.indexedDB = original;
    }
  });

  it('rejects with StorageUnavailableError when touching indexedDB throws (blocked storage)', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    try {
      await expect(openCardStore()).rejects.toBeInstanceOf(StorageUnavailableError);
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', original);
    }
  });
});

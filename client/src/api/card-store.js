import { openDB } from 'idb';

/** @typedef {import('../lib/cards.js').Card} Card */

const DB_NAME = 'pocketless';
const DB_VERSION = 1;
const STORE = 'cards';

export class StorageUnavailableError extends Error {
  constructor(message = 'Local storage is not available', options) {
    super(message, options);
    this.name = 'StorageUnavailableError';
  }
}

/**
 * @typedef {{
 *  list(owner: string): Promise<Card[]>,
 *  get(id: string): Promise<Card|undefined>,
 *  put(card: Card): Promise<void>
 * }} CardStore
 */

/** @returns {Promise<CardStore>} */
export async function openCardStore() {
  let db;
  try {
    // Inside the try: some browsers throw a SecurityError just for reading `indexedDB` when
    // storage is blocked, and that must surface as StorageUnavailableError like everything else.
    if (typeof globalThis.indexedDB === 'undefined') {
      throw new StorageUnavailableError();
    }
    db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const cards = database.createObjectStore(STORE, { keyPath: 'id' });
        cards.createIndex('by_owner', 'owner');
      },
    });
  } catch (cause) {
    if (cause instanceof StorageUnavailableError) throw cause;
    throw new StorageUnavailableError('Could not open local storage', { cause });
  }

  return {
    async list(owner) {
      const all = await db.getAllFromIndex(STORE, 'by_owner', owner);
      return all.filter((card) => !card.deletedAt);
    },
    get(id) {
      return db.get(STORE, id);
    },
    async put(card) {
      await db.put(STORE, card);
    },
  };
}

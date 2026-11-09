/** @typedef {import('./barcode.js').BarcodeFormat} BarcodeFormat */
/**
 * @typedef {{
 *  key: string, name: string, programme: string, colour: string,
 *  expectedFormats: BarcodeFormat[]|null, expectedLength: number|null
 * }} Store
 */

export const OTHER_STORE_KEY = 'other';

/** @type {Store[]} */
export const STORES = [
  {
    key: 'pnp-smart-shopper',
    name: 'Pick n Pay',
    programme: 'Smart Shopper',
    colour: '#B8232F',
    expectedFormats: null,
    expectedLength: null,
  },
  {
    key: 'checkers-xtra-savings',
    name: 'Checkers',
    programme: 'Xtra Savings',
    colour: '#1F6F43',
    expectedFormats: null,
    expectedLength: null,
  },
  {
    key: 'clicks-clubcard',
    name: 'Clicks',
    programme: 'ClubCard',
    colour: '#0B4F8A',
    expectedFormats: null,
    expectedLength: null,
  },
  {
    key: 'dischem-benefits',
    name: 'Dis-Chem',
    programme: 'Benefits',
    colour: '#B5530A',
    expectedFormats: null,
    expectedLength: null,
  },
];

const OTHER_STORE = {
  key: OTHER_STORE_KEY,
  name: 'Other store',
  programme: '',
  colour: '#3D3D3D',
  expectedFormats: null,
  expectedLength: null,
};

/** Colours for cards from stores outside the built-in list. All give at least 4.5:1 with white text. */
export const OTHER_PALETTE = [
  '#43144F',
  '#3D3D3D',
  '#1B4D3E',
  '#1C3A6B',
  '#006D6F',
  '#7A1F2B',
  '#6B4423',
  '#4D5B1E',
];

/**
 * @param {string} key
 * @returns {Store|undefined}
 */
export function getStore(key) {
  if (key === OTHER_STORE_KEY) return OTHER_STORE;
  return STORES.find((s) => s.key === key);
}

/**
 * Case-insensitive match on name and programme. "Other store" is always last.
 * @param {string} query
 * @returns {Store[]}
 */
export function searchStores(query) {
  const needle = query.trim().toLowerCase();
  const matches = STORES.filter(
    (s) =>
      needle === '' ||
      s.name.toLowerCase().includes(needle) ||
      s.programme.toLowerCase().includes(needle),
  );
  return [...matches, OTHER_STORE];
}

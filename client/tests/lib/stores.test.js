import { describe, it, expect } from 'vitest';
import {
  STORES,
  OTHER_STORE_KEY,
  OTHER_PALETTE,
  getStore,
  searchStores,
} from '../../src/lib/stores.js';

const WHITE = '#FFFFFF';

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe('STORES', () => {
  it('lists the four built-in stores in order', () => {
    expect(STORES.map((s) => s.key)).toEqual([
      'pnp-smart-shopper',
      'checkers-xtra-savings',
      'clicks-clubcard',
      'dischem-benefits',
    ]);
  });

  it('has the expected name and programme for each store', () => {
    expect(STORES.map((s) => [s.name, s.programme])).toEqual([
      ['Pick n Pay', 'Smart Shopper'],
      ['Checkers', 'Xtra Savings'],
      ['Clicks', 'ClubCard'],
      ['Dis-Chem', 'Benefits'],
    ]);
  });

  it('leaves expectedFormats and expectedLength null for every store', () => {
    for (const store of STORES) {
      expect(store.expectedFormats).toBeNull();
      expect(store.expectedLength).toBeNull();
    }
  });

  it('gives every store a colour with at least 4.5:1 contrast against white text', () => {
    for (const store of STORES) {
      expect(contrastRatio(store.colour, WHITE), store.key).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('OTHER_PALETTE', () => {
  it('has exactly 8 distinct colours', () => {
    expect(OTHER_PALETTE).toHaveLength(8);
    expect(new Set(OTHER_PALETTE).size).toBe(8);
  });

  it('includes Aubergine and the Other store grey', () => {
    expect(OTHER_PALETTE).toContain('#43144F');
    expect(OTHER_PALETTE).toContain('#3D3D3D');
  });

  it('gives every colour at least 4.5:1 contrast against white text', () => {
    for (const colour of OTHER_PALETTE) {
      expect(contrastRatio(colour, WHITE), colour).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('getStore', () => {
  it('returns a built-in store by key', () => {
    expect(getStore('clicks-clubcard')).toEqual(STORES[2]);
  });

  it('returns the Other store for the other key', () => {
    expect(OTHER_STORE_KEY).toBe('other');
    expect(getStore('other')).toEqual({
      key: 'other',
      name: 'Other store',
      programme: '',
      colour: '#3D3D3D',
      expectedFormats: null,
      expectedLength: null,
    });
  });

  it('returns undefined for an unknown key', () => {
    expect(getStore('nope')).toBeUndefined();
  });
});

describe('searchStores', () => {
  it('returns Clicks plus Other for "club"', () => {
    const keys = searchStores('club').map((s) => s.key);
    expect(keys).toEqual(['clicks-clubcard', OTHER_STORE_KEY]);
  });

  it('returns all four stores plus Other for an empty query', () => {
    const keys = searchStores('').map((s) => s.key);
    expect(keys).toEqual([...STORES.map((s) => s.key), OTHER_STORE_KEY]);
  });

  it('matches case-insensitively across name and programme', () => {
    expect(searchStores('CHECKERS').map((s) => s.key)).toContain('checkers-xtra-savings');
    expect(searchStores('xtra').map((s) => s.key)).toContain('checkers-xtra-savings');
    expect(searchStores('SMART shopper').map((s) => s.key)).toContain('pnp-smart-shopper');
  });

  it('always puts Other last', () => {
    const results = searchStores('p');
    expect(results[results.length - 1].key).toBe(OTHER_STORE_KEY);
  });

  it('returns only Other when nothing matches', () => {
    expect(searchStores('zzzz').map((s) => s.key)).toEqual([OTHER_STORE_KEY]);
  });
});

import { normaliseValue, validateValue } from './barcode.js';

/** @typedef {import('./barcode.js').BarcodeFormat} BarcodeFormat */
/** @typedef {{
 *  id: string, owner: string, storeKey: string, displayName: string, programme: string,
 *  colour: string, value: string, format: BarcodeFormat, pinned: boolean, sortHint: number,
 *  lastUsedAt: number|null, createdAt: string, updatedAt: string, deletedAt: string|null
 * }} Card */
/** @typedef {import('../api/card-store.js').CardStore} CardStore */

export const MAX_CARDS = 200;
export const LIMITS = { displayName: 40, programme: 40, value: 64 };

const COLOUR_RE = /^#[0-9A-Fa-f]{6}$/;

export class ValidationError extends Error {
  constructor(field, reason) {
    super(`Invalid ${field}: ${reason}`);
    this.name = 'ValidationError';
    this.field = field;
    this.reason = reason;
  }
}

export class DuplicateCardError extends Error {
  constructor(existingId) {
    super('This card is already in the wallet');
    this.name = 'DuplicateCardError';
    this.existingId = existingId;
  }
}

export class CardLimitError extends Error {
  constructor() {
    super(`A wallet can hold at most ${MAX_CARDS} cards`);
    this.name = 'CardLimitError';
  }
}

export class CardNotFoundError extends Error {
  constructor(id) {
    super('Card not found');
    this.name = 'CardNotFoundError';
    this.id = id;
  }
}

function cleanText(field, raw, { required }) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (required && text === '') throw new ValidationError(field, 'empty');
  if (text.length > LIMITS[field]) throw new ValidationError(field, 'too_long');
  return text;
}

function cleanColour(raw) {
  if (typeof raw !== 'string' || !COLOUR_RE.test(raw)) throw new ValidationError('colour', 'bad_format');
  return raw;
}

function cleanStoreKey(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') throw new ValidationError('storeKey', 'empty');
  return raw;
}

function cleanValue(raw, format) {
  const value = normaliseValue(typeof raw === 'string' ? raw : '', format);
  const result = validateValue(value, format);
  if (!result.ok) throw new ValidationError('value', result.reason);
  return value;
}

function findDuplicate(cards, storeKey, value, excludeId) {
  return cards.find((c) => c.id !== excludeId && c.storeKey === storeKey && c.value === value);
}

/**
 * @param {CardStore} store
 * @param {{ owner: string, storeKey: string, displayName: string, programme: string,
 *   colour: string, value: string, format: BarcodeFormat }} input
 * @returns {Promise<Card>}
 */
export async function addCard(store, input) {
  const fields = {
    storeKey: cleanStoreKey(input.storeKey),
    displayName: cleanText('displayName', input.displayName, { required: true }),
    programme: cleanText('programme', input.programme ?? '', { required: false }),
    colour: cleanColour(input.colour),
    format: input.format,
    value: cleanValue(input.value, input.format),
  };
  const existing = await store.list(input.owner);
  if (existing.length >= MAX_CARDS) throw new CardLimitError();
  const dupe = findDuplicate(existing, fields.storeKey, fields.value);
  if (dupe) throw new DuplicateCardError(dupe.id);

  const now = new Date().toISOString();
  /** @type {Card} */
  const card = {
    id: crypto.randomUUID(),
    owner: input.owner,
    ...fields,
    pinned: false,
    sortHint: Date.now(),
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await store.put(card);
  return card;
}

async function getLive(store, id) {
  const card = await store.get(id);
  if (!card || card.deletedAt) throw new CardNotFoundError(id);
  return card;
}

/**
 * @param {CardStore} store
 * @param {string} id
 * @param {Partial<Card>} patch
 * @returns {Promise<Card>}
 */
export async function updateCard(store, id, patch) {
  const current = await getLive(store, id);
  const next = { ...current };

  if ('storeKey' in patch) next.storeKey = cleanStoreKey(patch.storeKey);
  if ('displayName' in patch) next.displayName = cleanText('displayName', patch.displayName, { required: true });
  if ('programme' in patch) next.programme = cleanText('programme', patch.programme ?? '', { required: false });
  if ('colour' in patch) next.colour = cleanColour(patch.colour);
  if ('pinned' in patch) next.pinned = Boolean(patch.pinned);
  if ('sortHint' in patch && Number.isFinite(patch.sortHint)) next.sortHint = patch.sortHint;
  if ('format' in patch) next.format = patch.format;

  const valueChanged = 'value' in patch || next.format !== current.format;
  if (valueChanged) {
    next.value = cleanValue('value' in patch ? patch.value : current.value, next.format);
  }

  if (next.storeKey !== current.storeKey || next.value !== current.value) {
    const dupe = findDuplicate(await store.list(current.owner), next.storeKey, next.value, id);
    if (dupe) throw new DuplicateCardError(dupe.id);
  }

  next.updatedAt = new Date().toISOString();
  await store.put(next);
  return next;
}

/** Soft delete, so a later sync can propagate it. */
export async function deleteCard(store, id) {
  const current = await getLive(store, id);
  const now = new Date().toISOString();
  await store.put({ ...current, deletedAt: now, updatedAt: now });
}

/** Local-only: does not bump updatedAt. */
export async function markUsed(store, id) {
  const current = await getLive(store, id);
  await store.put({ ...current, lastUsedAt: Date.now() });
}

/**
 * Pinned first, then most recently used (never-used last), then newest.
 * @param {Card[]} cards
 * @returns {Card[]}
 */
export function sortWallet(cards) {
  return [...cards].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const au = a.lastUsedAt ?? -Infinity;
    const bu = b.lastUsedAt ?? -Infinity;
    if (au !== bu) return au > bu ? -1 : 1;
    return b.sortHint - a.sortHint;
  });
}

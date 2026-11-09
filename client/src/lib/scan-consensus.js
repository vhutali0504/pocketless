import { isValidChecksum, normaliseValue } from './barcode.js';

/** @typedef {import('./cards.js').BarcodeFormat} BarcodeFormat */
/** @typedef {{value: string, format: BarcodeFormat}} Read */

/**
 * Accepts a code only after it appears in `required` consecutive frames.
 *
 * A camera frame can hold several codes, so consensus works per frame: each
 * value+format seen in a frame has its count raised, and any code missing from
 * a frame that held other valid reads loses its count. Reads that fail the
 * checksum are ignored, and a frame with no valid reads (a blurry frame)
 * changes nothing.
 *
 * @param {number} [required]
 * @returns {{
 *   pushFrame(reads: Read[]): Read | null,
 *   push(read: Read): Read | null,
 *   reset(): void
 * }}
 */
export function createConsensus(required = 3) {
  /** @type {Map<string, {read: Read, count: number}>} */
  let counts = new Map();

  function reset() {
    counts = new Map();
  }

  function pushFrame(reads) {
    /** @type {Map<string, Read>} */
    const seen = new Map();
    for (const read of reads || []) {
      if (!read || typeof read.value !== 'string') continue;
      const value = normaliseValue(read.value, read.format);
      if (!isValidChecksum(value, read.format)) continue;
      const key = `${read.format}\u0000${value}`;
      if (!seen.has(key)) seen.set(key, { value, format: read.format });
    }
    if (seen.size === 0) return null;

    const next = new Map();
    for (const [key, read] of seen) {
      next.set(key, { read, count: (counts.get(key)?.count ?? 0) + 1 });
    }
    counts = next;

    for (const { read, count } of counts.values()) {
      if (count >= required) {
        reset();
        return read;
      }
    }
    return null;
  }

  /** A frame holding a single read. */
  function push(read) {
    return pushFrame([read]);
  }

  return { pushFrame, push, reset };
}

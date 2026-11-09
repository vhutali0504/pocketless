import { isValidChecksum, normaliseValue } from './barcode.js';

/**
 * Accepts a read only after `required` consecutive identical, checksum-valid
 * decodes. Reads that fail the checksum are ignored: they neither count nor
 * break the run. A different value or format breaks the run.
 *
 * @param {number} [required]
 * @returns {{
 *   push(read: {value: string, format: import('./cards.js').BarcodeFormat}):
 *     {value: string, format: import('./cards.js').BarcodeFormat} | null,
 *   reset(): void
 * }}
 */
export function createConsensus(required = 3) {
  let current = null;
  let count = 0;

  function reset() {
    current = null;
    count = 0;
  }

  function push(read) {
    const value = normaliseValue(read.value, read.format);
    if (!isValidChecksum(value, read.format)) return null;

    if (current && current.value === value && current.format === read.format) {
      count += 1;
    } else {
      current = { value, format: read.format };
      count = 1;
    }

    if (count >= required) {
      const result = current;
      reset();
      return result;
    }
    return null;
  }

  return { push, reset };
}

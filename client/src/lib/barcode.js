/** @typedef {'EAN_13'|'EAN_8'|'UPC_A'|'CODE_128'|'CODE_39'|'ITF'|'QR_CODE'} BarcodeFormat */

/** @type {BarcodeFormat[]} */
export const FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'CODE_128', 'CODE_39', 'ITF', 'QR_CODE'];

const MAX_VALUE_LENGTH = 64;
const NUMERIC_FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'ITF'];
const FIXED_LENGTH = { EAN_13: 13, EAN_8: 8, UPC_A: 12 };

const CHAR_RULES = {
  EAN_13: /^\d+$/,
  EAN_8: /^\d+$/,
  UPC_A: /^\d+$/,
  ITF: /^\d+$/,
  CODE_39: /^[0-9A-Z \-.$/+%]+$/,
  CODE_128: /^[\x20-\x7E]+$/,
  QR_CODE: /^[\s\S]+$/,
};

/** Mod-10 check for EAN-13, EAN-8 and UPC-A (weights 3,1,3,... from the right of the body). */
function gs1Valid(value) {
  if (!/^\d+$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop();
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

function luhnValid(value) {
  let sum = 0;
  [...value].reverse().forEach((ch, i) => {
    let d = Number(ch);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  });
  return sum % 10 === 0;
}

/**
 * @param {string} value
 * @param {BarcodeFormat} format
 * @returns {boolean}
 */
export function isValidChecksum(value, format) {
  if (format in FIXED_LENGTH) {
    return value.length === FIXED_LENGTH[format] && gs1Valid(value);
  }
  if (format === 'ITF') return value.length % 2 === 0;
  return true;
}

/**
 * @param {string} value
 * @param {BarcodeFormat} format
 * @returns {string}
 */
export function normaliseValue(value, format) {
  if (NUMERIC_FORMATS.includes(format)) return value.replace(/[\s-]/g, '');
  return value.trim();
}

/**
 * @param {string} value
 * @param {BarcodeFormat[]} [expected]
 * @returns {BarcodeFormat}
 */
export function inferFormat(value, expected) {
  if (Array.isArray(expected) && expected.length > 0) {
    const first = expected[0];
    if (CHAR_RULES[first]?.test(value) && isValidChecksum(value, first)) return first;
  }
  if (/^\d{13}$/.test(value) && gs1Valid(value)) return 'EAN_13';
  if (/^\d{12}$/.test(value) && gs1Valid(value)) return 'UPC_A';
  if (/^\d{8}$/.test(value) && gs1Valid(value)) return 'EAN_8';
  return 'CODE_128';
}

function isRealDate(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * True for a 13-digit value with a real YYMMDD date (in either century) and a valid Luhn check.
 * @param {string} value
 * @returns {boolean}
 */
export function looksLikeSaId(value) {
  if (!/^\d{13}$/.test(value)) return false;
  const yy = Number(value.slice(0, 2));
  const mm = Number(value.slice(2, 4));
  const dd = Number(value.slice(4, 6));
  const dateOk = isRealDate(1900 + yy, mm, dd) || isRealDate(2000 + yy, mm, dd);
  return dateOk && luhnValid(value);
}

/**
 * @param {string} value
 * @param {BarcodeFormat} format
 * @returns {{ ok: true } | { ok: false, reason: 'empty'|'too_long'|'bad_chars'|'bad_checksum' }}
 */
export function validateValue(value, format) {
  if (!value) return { ok: false, reason: 'empty' };
  if (value.length > MAX_VALUE_LENGTH) return { ok: false, reason: 'too_long' };
  if (!CHAR_RULES[format].test(value)) return { ok: false, reason: 'bad_chars' };
  if (!isValidChecksum(value, format)) return { ok: false, reason: 'bad_checksum' };
  return { ok: true };
}

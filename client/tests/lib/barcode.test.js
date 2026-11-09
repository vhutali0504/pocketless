import { describe, it, expect } from 'vitest';
import {
  FORMATS,
  isValidChecksum,
  normaliseValue,
  inferFormat,
  looksLikeSaId,
  validateValue,
} from '../../src/lib/barcode.js';

function luhnCheckDigit(body) {
  let sum = 0;
  [...body].reverse().forEach((ch, i) => {
    let d = Number(ch);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  });
  return String((10 - (sum % 10)) % 10);
}
const saId = (body12) => body12 + luhnCheckDigit(body12);

describe('FORMATS', () => {
  it('lists all supported formats', () => {
    expect(FORMATS).toEqual(['EAN_13', 'EAN_8', 'UPC_A', 'CODE_128', 'CODE_39', 'ITF', 'QR_CODE']);
  });
});

describe('isValidChecksum', () => {
  it('validates EAN-13, EAN-8 and UPC-A', () => {
    expect(isValidChecksum('4006381333931', 'EAN_13')).toBe(true);
    expect(isValidChecksum('4006381333932', 'EAN_13')).toBe(false);
    expect(isValidChecksum('96385074', 'EAN_8')).toBe(true);
    expect(isValidChecksum('96385075', 'EAN_8')).toBe(false);
    expect(isValidChecksum('036000291452', 'UPC_A')).toBe(true);
    expect(isValidChecksum('036000291453', 'UPC_A')).toBe(false);
  });
  it('rejects wrong length or non-digits for checksum formats', () => {
    expect(isValidChecksum('400638133393', 'EAN_13')).toBe(false);
    expect(isValidChecksum('40063813339a1', 'EAN_13')).toBe(false);
  });
  it('is true for formats without a checksum', () => {
    expect(isValidChecksum('anything', 'CODE_128')).toBe(true);
    expect(isValidChecksum('ABC', 'CODE_39')).toBe(true);
    expect(isValidChecksum('https://x.y', 'QR_CODE')).toBe(true);
  });
  it('checks ITF for even length only', () => {
    expect(isValidChecksum('1234', 'ITF')).toBe(true);
    expect(isValidChecksum('123', 'ITF')).toBe(false);
  });
});

describe('normaliseValue', () => {
  it('strips spaces and dashes for numeric formats', () => {
    expect(normaliseValue(' 4006 3813-33931 ', 'EAN_13')).toBe('4006381333931');
    expect(normaliseValue('1234 56', 'ITF')).toBe('123456');
  });
  it('only trims other formats', () => {
    expect(normaliseValue('  AB-12 34  ', 'CODE_128')).toBe('AB-12 34');
    expect(normaliseValue(' A-B ', 'CODE_39')).toBe('A-B');
  });
});

describe('inferFormat', () => {
  it('infers from the value', () => {
    expect(inferFormat('4006381333931')).toBe('EAN_13');
    expect(inferFormat('96385074')).toBe('EAN_8');
    expect(inferFormat('036000291452')).toBe('UPC_A');
    expect(inferFormat('ABC-123')).toBe('CODE_128');
    expect(inferFormat('4006381333932')).toBe('CODE_128');
  });
  it('prefers the store expectation when the value is valid for it', () => {
    expect(inferFormat('4006381333931', ['CODE_128'])).toBe('CODE_128');
    expect(inferFormat('4006381333931', ['EAN_13', 'CODE_128'])).toBe('EAN_13');
  });
  it('falls through when the value is invalid for the expected format', () => {
    expect(inferFormat('ABC', ['EAN_13'])).toBe('CODE_128');
    expect(inferFormat('96385074', ['EAN_13'])).toBe('EAN_8');
  });
  it('treats empty or null expected as no expectation', () => {
    expect(inferFormat('96385074', [])).toBe('EAN_8');
    expect(inferFormat('96385074', null)).toBe('EAN_8');
  });
});

describe('looksLikeSaId', () => {
  it('accepts a Luhn-valid ID with a real date', () => {
    expect(looksLikeSaId(saId('800101500908'))).toBe(true);
    expect(looksLikeSaId(saId('000229500908'))).toBe(true); // 2000-02-29
  });
  it('rejects an impossible date', () => {
    expect(looksLikeSaId(saId('801301500908'))).toBe(false); // month 13
    expect(looksLikeSaId(saId('010229500908'))).toBe(false); // 2001-02-29 / 1901
    expect(looksLikeSaId(saId('800132500908'))).toBe(false); // day 32
  });
  it('rejects a Luhn failure', () => {
    const good = saId('800101500908');
    const bad = good.slice(0, 12) + String((Number(good[12]) + 1) % 10);
    expect(looksLikeSaId(bad)).toBe(false);
  });
  it('rejects wrong length or non-digits', () => {
    expect(looksLikeSaId('800101500908')).toBe(false);
    expect(looksLikeSaId('80010150090a7')).toBe(false);
  });
});

describe('validateValue', () => {
  it('reports each failure reason', () => {
    expect(validateValue('', 'CODE_128')).toEqual({ ok: false, reason: 'empty' });
    expect(validateValue('x'.repeat(65), 'CODE_128')).toEqual({ ok: false, reason: 'too_long' });
    expect(validateValue('12a4', 'EAN_13')).toEqual({ ok: false, reason: 'bad_chars' });
    expect(validateValue('4006381333932', 'EAN_13')).toEqual({ ok: false, reason: 'bad_checksum' });
    expect(validateValue('abc', 'CODE_39')).toEqual({ ok: false, reason: 'bad_chars' });
    expect(validateValue('é', 'CODE_128')).toEqual({ ok: false, reason: 'bad_chars' });
  });
  it('accepts valid values, including exactly 64 characters', () => {
    expect(validateValue('4006381333931', 'EAN_13')).toEqual({ ok: true });
    expect(validateValue('x'.repeat(64), 'CODE_128')).toEqual({ ok: true });
    expect(validateValue('ABC-1.2', 'CODE_39')).toEqual({ ok: true });
    expect(validateValue('anything é', 'QR_CODE')).toEqual({ ok: true });
  });
});

import { describe, expect, test, vi } from 'vitest';
import { isCalmMoment, setupUpdates } from '../src/sw-updates.js';

function fakeSw({ controller = {} } = {}) {
  const listeners = {};
  const reg = { update: vi.fn(() => Promise.resolve()) };
  return {
    controller,
    reg,
    register: vi.fn(() => Promise.resolve(reg)),
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
    fire: (type) => listeners[type]?.(),
  };
}

function fakeDoc() {
  const listeners = {};
  return {
    visibilityState: 'visible',
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
    show() {
      this.visibilityState = 'visible';
      listeners.visibilitychange?.();
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('isCalmMoment', () => {
  const root = (out) => ({ classList: { contains: () => out } });

  test('wallet with no card out is calm', () => {
    expect(isCalmMoment({ pathname: '/app' }, root(false))).toBe(true);
    expect(isCalmMoment({ pathname: '/app/' }, root(false))).toBe(true);
  });

  test('a pulled-out card, the add flow or card details are not calm', () => {
    expect(isCalmMoment({ pathname: '/app' }, root(true))).toBe(false);
    expect(isCalmMoment({ pathname: '/app/add' }, root(false))).toBe(false);
    expect(isCalmMoment({ pathname: '/app/cards/abc' }, root(false))).toBe(false);
  });
});

describe('setupUpdates', () => {
  test('registers the service worker at /sw.js', () => {
    const sw = fakeSw();
    setupUpdates({ sw, doc: fakeDoc(), reload: vi.fn(), calm: () => true });
    expect(sw.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  test('reloads into a new version straight away when calm', () => {
    const sw = fakeSw();
    const reload = vi.fn();
    setupUpdates({ sw, doc: fakeDoc(), reload, calm: () => true });
    sw.fire('controllerchange');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('waits until a calm moment (next time the app comes to the front)', () => {
    const sw = fakeSw();
    const doc = fakeDoc();
    const reload = vi.fn();
    let calm = false;
    setupUpdates({ sw, doc, reload, calm: () => calm });
    sw.fire('controllerchange');
    expect(reload).not.toHaveBeenCalled();
    calm = true;
    doc.show();
    expect(reload).toHaveBeenCalledTimes(1);
    doc.show();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('does not reload on the very first install', () => {
    const sw = fakeSw({ controller: null });
    const reload = vi.fn();
    setupUpdates({ sw, doc: fakeDoc(), reload, calm: () => true });
    sw.fire('controllerchange');
    expect(reload).not.toHaveBeenCalled();
  });

  test('checks for a new version whenever the app comes to the front', async () => {
    const sw = fakeSw();
    const doc = fakeDoc();
    setupUpdates({ sw, doc, reload: vi.fn(), calm: () => false });
    await flush();
    doc.show();
    expect(sw.reg.update).toHaveBeenCalledTimes(1);
  });

  test('does nothing without service worker support', () => {
    expect(setupUpdates({ sw: undefined, doc: fakeDoc() })).toBeNull();
  });
});

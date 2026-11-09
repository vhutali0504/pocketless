import { renderHook, act } from '@testing-library/react';
import { useWakeLock } from '../../src/hooks/useWakeLock.js';

function fakeSentinel() {
  const s = { released: false, release: vi.fn(async () => { s.released = true; }) };
  return s;
}

let visibility = 'visible';
beforeEach(() => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => {
  delete navigator.wakeLock;
  delete document.visibilityState;
});

function installWakeLock() {
  const sentinels = [];
  const request = vi.fn(async () => {
    const s = fakeSentinel();
    sentinels.push(s);
    return s;
  });
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  return { request, sentinels };
}

const flush = () => act(async () => {});

describe('useWakeLock', () => {
  it('requests a screen lock when active and releases it when inactive', async () => {
    const { request, sentinels } = installWakeLock();
    const { rerender } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: false } });
    await flush();
    expect(request).not.toHaveBeenCalled();

    rerender({ active: true });
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');

    rerender({ active: false });
    await flush();
    expect(sentinels[0].release).toHaveBeenCalledTimes(1);
  });

  it('re-requests when the page becomes visible again while active', async () => {
    const { request, sentinels } = installWakeLock();
    renderHook(() => useWakeLock(true));
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    // The browser drops the lock when the page is hidden.
    visibility = 'hidden';
    sentinels[0].released = true;
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(request).toHaveBeenCalledTimes(1);

    visibility = 'visible';
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not re-request on visibility return when inactive', async () => {
    const { request } = installWakeLock();
    renderHook(() => useWakeLock(false));
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(request).not.toHaveBeenCalled();
  });

  it('does not throw when navigator.wakeLock is undefined', async () => {
    expect(navigator.wakeLock).toBeUndefined();
    const { rerender, unmount } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } });
    await flush();
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    rerender({ active: false });
    unmount();
  });

  it('swallows a rejected request (e.g. low battery)', async () => {
    const request = vi.fn(async () => { throw new Error('NotAllowedError'); });
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    renderHook(() => useWakeLock(true));
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

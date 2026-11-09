import { vi } from 'vitest';
import { createScanner, ScannerError } from '../../src/api/scanner.js';

const ALL = ['ean_13', 'qr_code', 'ean_8', 'upc_a', 'code_128', 'code_39', 'itf'];

function makeStream() {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  return { tracks, getTracks: () => tracks };
}

function makeDetector(results, supported = ALL) {
  const detect = vi.fn(async () => results);
  class FakeDetector {
    static getSupportedFormats = vi.fn(async () => supported);
    constructor(opts) {
      FakeDetector.opts = opts;
    }
    detect = detect;
  }
  return { FakeDetector, detect };
}

function setMedia(getUserMedia) {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
}

function mockZxing(ctor) {
  vi.doMock('@zxing/browser', () => ({
    BrowserMultiFormatReader: class {
      constructor(...a) {
        ctor(...a);
      }
      decodeFromCanvas() {
        throw new Error('not found');
      }
    },
  }));
}

let video;
beforeEach(() => {
  vi.useFakeTimers();
  video = document.createElement('video');
  video.play = vi.fn(() => Promise.resolve());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.doUnmock('@zxing/browser');
  delete navigator.mediaDevices;
});

describe('createScanner errors', () => {
  it.each([
    ['NotAllowedError', 'permission'],
    ['SecurityError', 'permission'],
    ['NotFoundError', 'unavailable'],
    ['OverconstrainedError', 'unavailable'],
    ['AbortError', 'failed'],
  ])('maps %s to %s', async (name, kind) => {
    setMedia(vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name })));
    const onError = vi.fn();
    const s = createScanner(video, { onRead: vi.fn(), onError });
    await s.start();
    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0];
    expect(err).toBeInstanceOf(ScannerError);
    expect(err.kind).toBe(kind);
  });

  it('reports unavailable when mediaDevices is missing', async () => {
    delete navigator.mediaDevices;
    const onError = vi.fn();
    await createScanner(video, { onRead: vi.fn(), onError }).start();
    expect(onError.mock.calls[0][0].kind).toBe('unavailable');
  });
});

describe('createScanner with BarcodeDetector', () => {
  it('requests the rear camera without audio', async () => {
    const gum = vi.fn().mockResolvedValue(makeStream());
    setMedia(gum);
    vi.stubGlobal('BarcodeDetector', makeDetector([]).FakeDetector);
    const s = createScanner(video, { onRead: vi.fn(), onError: vi.fn() });
    await s.start();
    expect(gum).toHaveBeenCalledWith({ video: { facingMode: 'environment' }, audio: false });
    s.stop();
  });

  it('emits mapped reads on a ~100 ms loop and drops unknown formats', async () => {
    setMedia(vi.fn().mockResolvedValue(makeStream()));
    const { FakeDetector, detect } = makeDetector([
      { rawValue: '4006381333931', format: 'ean_13' },
      { rawValue: 'zzz', format: 'aztec' },
    ]);
    vi.stubGlobal('BarcodeDetector', FakeDetector);
    const onRead = vi.fn();
    const s = createScanner(video, { onRead, onError: vi.fn() });
    await s.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(onRead).toHaveBeenCalledWith({ value: '4006381333931', format: 'EAN_13' });
    expect(onRead).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(detect.mock.calls.length).toBeGreaterThanOrEqual(3);
    s.stop();
  });

  it('keeps decoding when an onRead callback throws', async () => {
    setMedia(vi.fn().mockResolvedValue(makeStream()));
    const { FakeDetector } = makeDetector([{ rawValue: '4006381333931', format: 'ean_13' }]);
    vi.stubGlobal('BarcodeDetector', FakeDetector);
    const onRead = vi.fn(() => {
      throw new Error('callback bug');
    });
    const s = createScanner(video, { onRead, onError: vi.fn() });
    await s.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(onRead).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(onRead.mock.calls.length).toBeGreaterThanOrEqual(3);
    s.stop();
  });

  it('restricts the detector to the requested formats', async () => {
    setMedia(vi.fn().mockResolvedValue(makeStream()));
    const { FakeDetector } = makeDetector([]);
    vi.stubGlobal('BarcodeDetector', FakeDetector);
    const s = createScanner(video, { formats: ['EAN_13', 'QR_CODE'], onRead: vi.fn(), onError: vi.fn() });
    await s.start();
    expect(FakeDetector.opts).toEqual({ formats: ['ean_13', 'qr_code'] });
    s.stop();
  });

  it('stop() releases every track, detaches the video and stops decoding', async () => {
    const stream = makeStream();
    setMedia(vi.fn().mockResolvedValue(stream));
    const { FakeDetector, detect } = makeDetector([]);
    vi.stubGlobal('BarcodeDetector', FakeDetector);
    const s = createScanner(video, { onRead: vi.fn(), onError: vi.fn() });
    await s.start();
    expect(video.srcObject).toBe(stream);
    s.stop();
    s.stop();
    stream.tracks.forEach((t) => expect(t.stop).toHaveBeenCalledTimes(1));
    expect(video.srcObject).toBeNull();
    const calls = detect.mock.calls.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(detect.mock.calls.length).toBe(calls);
  });

  it('ignores an in-flight decode result after stop()', async () => {
    setMedia(vi.fn().mockResolvedValue(makeStream()));
    let resolveDetect;
    class Slow {
      static getSupportedFormats = async () => ['ean_13'];
      detect = () => new Promise((r) => (resolveDetect = r));
    }
    vi.stubGlobal('BarcodeDetector', Slow);
    const onRead = vi.fn();
    const s = createScanner(video, { formats: ['EAN_13'], onRead, onError: vi.fn() });
    await s.start();
    await vi.advanceTimersByTimeAsync(100);
    s.stop();
    resolveDetect([{ rawValue: '4006381333931', format: 'ean_13' }]);
    await vi.advanceTimersByTimeAsync(300);
    expect(onRead).not.toHaveBeenCalled();
  });

  it('can start again after stop()', async () => {
    const gum = vi.fn().mockImplementation(async () => makeStream());
    setMedia(gum);
    const { FakeDetector } = makeDetector([{ rawValue: '4006381333931', format: 'ean_13' }]);
    vi.stubGlobal('BarcodeDetector', FakeDetector);
    const onRead = vi.fn();
    const s = createScanner(video, { onRead, onError: vi.fn() });
    await s.start();
    s.stop();
    await s.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(gum).toHaveBeenCalledTimes(2);
    expect(onRead).toHaveBeenCalled();
    s.stop();
  });

  it('releases the stream if stop() is called while the camera is opening', async () => {
    const stream = makeStream();
    let resolveGum;
    setMedia(vi.fn(() => new Promise((r) => (resolveGum = r))));
    vi.stubGlobal('BarcodeDetector', makeDetector([]).FakeDetector);
    const s = createScanner(video, { onRead: vi.fn(), onError: vi.fn() });
    const started = s.start();
    s.stop();
    resolveGum(stream);
    await started;
    stream.tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
    expect(video.srcObject).toBeNull();
  });
});

describe('createScanner fallback', () => {
  it('uses ZXing when BarcodeDetector is absent', async () => {
    setMedia(vi.fn().mockResolvedValue(makeStream()));
    const ctor = vi.fn();
    mockZxing(ctor);
    const s = createScanner(video, { onRead: vi.fn(), onError: vi.fn() });
    await s.start();
    expect(ctor).toHaveBeenCalledTimes(1);
    s.stop();
  });

  it('uses ZXing when the detector lacks a needed format', async () => {
    setMedia(vi.fn().mockResolvedValue(makeStream()));
    const ctor = vi.fn();
    mockZxing(ctor);
    const { FakeDetector, detect } = makeDetector([], ['qr_code']);
    vi.stubGlobal('BarcodeDetector', FakeDetector);
    const s = createScanner(video, { formats: ['EAN_13'], onRead: vi.fn(), onError: vi.fn() });
    await s.start();
    expect(ctor).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(detect).not.toHaveBeenCalled();
    s.stop();
  });
});

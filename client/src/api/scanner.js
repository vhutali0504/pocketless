import { FORMATS } from '../lib/barcode.js';

/** @typedef {import('../lib/cards.js').BarcodeFormat} BarcodeFormat */

const DECODE_INTERVAL_MS = 100;
// After this many detect() failures in a row, the BarcodeDetector is treated as broken.
const MAX_DETECTOR_FAILURES = 10;

const TO_DETECTOR = {
  EAN_13: 'ean_13',
  EAN_8: 'ean_8',
  UPC_A: 'upc_a',
  CODE_128: 'code_128',
  CODE_39: 'code_39',
  ITF: 'itf',
  QR_CODE: 'qr_code',
};
const FROM_DETECTOR = Object.fromEntries(Object.entries(TO_DETECTOR).map(([k, v]) => [v, k]));

export class ScannerError extends Error {
  /** @param {'permission'|'unavailable'|'failed'} kind @param {string} [message] */
  constructor(kind, message) {
    super(message || kind);
    this.name = 'ScannerError';
    this.kind = kind;
  }
}

function toScannerError(err) {
  if (err instanceof ScannerError) return err;
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return new ScannerError('permission', err.message);
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return new ScannerError('unavailable', err.message);
  return new ScannerError('failed', err && err.message);
}

/** Returns null when BarcodeDetector is missing, lacks a format, or fails to set up. */
async function createDetectorDecoder(formats) {
  const wanted = formats.map((f) => TO_DETECTOR[f]);
  if (typeof window === 'undefined' || !('BarcodeDetector' in window) || !window.BarcodeDetector) return null;
  let detector;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    if (!Array.isArray(supported) || !wanted.every((f) => supported.includes(f))) return null;
    detector = new window.BarcodeDetector({ formats: wanted });
  } catch {
    return null; // a broken detector: use ZXing instead
  }
  return async (video) => {
    const found = await detector.detect(video);
    return found
      .filter((r) => FROM_DETECTOR[r.format])
      .map((r) => ({ value: r.rawValue, format: FROM_DETECTOR[r.format] }));
  };
}

async function createZxingDecoder(formats) {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const toZxing = Object.fromEntries(FORMATS.map((f) => [f, BarcodeFormat[f]]));
  const fromZxing = Object.fromEntries(Object.entries(toZxing).map(([k, v]) => [v, k]));
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, formats.map((f) => toZxing[f])]]);
  const reader = new BrowserMultiFormatReader(hints);
  const canvas = document.createElement('canvas');
  return async (video) => {
    if (!video.videoWidth || !video.videoHeight) return [];
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0);
    try {
      const result = reader.decodeFromCanvas(canvas);
      const format = fromZxing[result.getBarcodeFormat()];
      return format ? [{ value: result.getText(), format }] : [];
    } catch {
      return []; // ZXing throws when no code is in the frame
    }
  };
}

/**
 * Camera scanner. Emits raw reads only; consensus is the caller's job.
 * `onFrame` gets every decoded frame's reads at once (an empty array when the frame held no code);
 * `onRead` gets each read on its own. Either or both may be given.
 *
 * @param {HTMLVideoElement} video
 * @param {{
 *   formats?: BarcodeFormat[],
 *   onFrame?: (reads: {value: string, format: BarcodeFormat}[]) => void,
 *   onRead?: (read: {value: string, format: BarcodeFormat}) => void,
 *   onError: (err: ScannerError) => void
 * }} options
 */
export function createScanner(video, { formats, onFrame, onRead, onError }) {
  const wanted = formats && formats.length ? formats : FORMATS;
  let generation = 0;
  let stream = null;
  let timer = null;

  function release() {
    clearTimeout(timer);
    timer = null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    video.srcObject = null;
  }

  function stop() {
    generation += 1; // invalidates any in-flight start or decode
    release();
  }

  async function start() {
    stop();
    const gen = generation;
    let opened = null;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new ScannerError('unavailable', 'No camera API');
      }
      opened = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (gen !== generation) {
        opened.getTracks().forEach((t) => t.stop());
        return;
      }
      const detectorDecode = await createDetectorDecoder(wanted);
      let decode = detectorDecode || (await createZxingDecoder(wanted));
      if (gen !== generation) {
        opened.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = opened;
      video.srcObject = stream;
      if (typeof video.play === 'function') {
        try {
          await video.play();
        } catch {
          // autoplay may be refused or unimplemented; the stream is still attached
        }
        if (gen !== generation) return;
      }

      let failures = 0;
      const tick = async () => {
        let reads = [];
        try {
          reads = await decode(video);
          failures = 0;
        } catch {
          // a failed frame is just a frame with no code, unless the detector keeps failing
          failures += 1;
          if (decode === detectorDecode && failures >= MAX_DETECTOR_FAILURES) {
            try {
              const zxing = await createZxingDecoder(wanted);
              if (gen !== generation) return;
              decode = zxing;
            } catch {
              // ZXing could not load either; keep trying the detector
            }
            failures = 0;
          }
        }
        if (gen !== generation) return;
        try {
          if (onFrame) {
            onFrame(reads);
            if (gen !== generation) return; // the callback stopped the scanner
          }
          if (onRead) {
            for (const r of reads) {
              onRead(r);
              if (gen !== generation) return; // the callback stopped the scanner
            }
          }
        } catch {
          // a throwing callback must not kill the decode loop
        } finally {
          if (gen === generation) timer = setTimeout(tick, DECODE_INTERVAL_MS);
        }
      };
      timer = setTimeout(tick, DECODE_INTERVAL_MS);
    } catch (err) {
      if (opened && opened !== stream) opened.getTracks().forEach((t) => t.stop());
      if (gen !== generation) return;
      release();
      onError(toScannerError(err));
    }
  }

  return { start, stop };
}

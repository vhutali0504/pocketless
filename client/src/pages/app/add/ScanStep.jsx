import { useEffect, useRef, useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import { createScanner } from '../../../api/scanner.js';
import { normaliseValue, validateValue } from '../../../lib/barcode.js';
import { createConsensus } from '../../../lib/scan-consensus.js';

/** @typedef {import('../../../lib/barcode.js').BarcodeFormat} BarcodeFormat */

const CAMERA_ERROR_COPY = {
  permission:
    "Pocketless needs the camera to scan your card. You can allow it in your phone's settings, or type the number instead.",
  unavailable: "We couldn't find a camera on this device.",
  failed: "The camera didn't start. You can type the number instead.",
};

/**
 * Step 2: the camera. A code is accepted only once it is decoded (checksum-valid) in 3 frames in a row.
 * The scanner is stopped as soon as a read is accepted and whenever this step goes away.
 * @param {{ store: import('../../../lib/stores.js').Store,
 *   onResult(read: { value: string, format: BarcodeFormat }): void, onManual(): void }} props
 */
export default function ScanStep({ store, onResult, onManual }) {
  const videoRef = useRef(/** @type {HTMLVideoElement|null} */ (null));
  const typeButtonRef = useRef(null);
  const onResultRef = useRef(onResult);
  const [cameraError, setCameraError] = useState(/** @type {string|null} */ (null));

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const formats = store.expectedFormats;

  useEffect(() => {
    const video = videoRef.current;
    // React sets `muted` as a property only; iOS wants the attribute before it will play inline.
    video.setAttribute('muted', '');
    video.muted = true;

    const consensus = createConsensus(3);
    let done = false;
    const scanner = createScanner(video, {
      formats: formats ?? undefined,
      onFrame(reads) {
        // Runs inside the scanner's decode loop: it must never throw.
        try {
          if (done || !Array.isArray(reads)) return;
          const usable = reads.filter(
            (read) =>
              read &&
              typeof read.value === 'string' &&
              validateValue(normaliseValue(read.value, read.format), read.format).ok,
          );
          const accepted = consensus.pushFrame(usable);
          if (!accepted) return;
          done = true;
          scanner.stop();
          onResultRef.current(accepted);
        } catch {
          // a bad frame is just a frame we don't use
        }
      },
      onError(err) {
        if (!done) setCameraError(CAMERA_ERROR_COPY[err?.kind] ? err.kind : 'failed');
      },
    });
    scanner.start();
    return () => {
      done = true;
      scanner.stop();
    };
  }, [formats]);

  useEffect(() => {
    if (cameraError) typeButtonRef.current?.focus();
  }, [cameraError]);

  return (
    <div className="add-body scan">
      <div className={`scan__viewport${cameraError ? ' is-off' : ''}`}>
        <video ref={videoRef} className="scan__video" playsInline muted autoPlay aria-hidden="true" />
        {!cameraError && <div className="scan__guide" aria-hidden="true" />}
        {cameraError && (
          <p className="scan__error" role="alert">{CAMERA_ERROR_COPY[cameraError]}</p>
        )}
      </div>
      {!cameraError && (
        <p className="scan__copy">Hold the barcode on the back of your card inside the box</p>
      )}
      <Button variant={cameraError ? 'primary' : 'secondary'} ref={typeButtonRef} onClick={onManual}>
        Type the number instead
      </Button>
    </div>
  );
}

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../../../components/ui/ConfirmDialog.jsx';
import { useCards } from '../../../context/CardsContext.jsx';
import { looksLikeSaId } from '../../../lib/barcode.js';
import ConfirmStep from './ConfirmStep.jsx';
import ManualEntry, { SA_ID_DIALOG } from './ManualEntry.jsx';
import ScanStep from './ScanStep.jsx';
import StepHeader from './StepHeader.jsx';
import StorePicker from './StorePicker.jsx';
import '../../../styles/add-card.css';

/** @typedef {import('../../../lib/barcode.js').BarcodeFormat} BarcodeFormat */
/** @typedef {'store'|'scan'|'manual'|'confirm'} Step */

const EMPTY_DRAFT = { store: null, displayName: '', programme: '', colour: '', value: '', format: null };

/**
 * Add a card: pick the store, scan (or type) the number, check it, save. Nothing is stored before
 * the user confirms the number on the "Check your card" step.
 */
export default function AddCardPage() {
  const { add } = useCards();
  const navigate = useNavigate();

  const [step, setStep] = useState(/** @type {Step} */ ('store'));
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  // Which step produced the number, so "No" and Back return there.
  const [source, setSource] = useState(/** @type {'scan'|'manual'} */ ('scan'));
  const [typed, setTyped] = useState('');
  // Bumped to restart the camera with a fresh consensus.
  const [scanRun, setScanRun] = useState(0);
  const [scannedSaId, setScannedSaId] = useState(/** @type {{value: string, format: BarcodeFormat}|null} */ (null));
  const [saveError, setSaveError] = useState(/** @type {Error|null} */ (null));
  const [saving, setSaving] = useState(false);

  const toConfirm = useCallback((read, from) => {
    setDraft((d) => ({ ...d, value: read.value, format: read.format }));
    setSource(from);
    setSaveError(null);
    setStep('confirm');
  }, []);

  const onScanResult = useCallback((read) => {
    if (looksLikeSaId(read.value)) setScannedSaId(read);
    else toConfirm(read, 'scan');
  }, [toConfirm]);

  const scanAgain = () => {
    setScanRun((n) => n + 1);
    setStep('scan');
  };

  const back = () => {
    if (step === 'store') navigate('/app');
    else if (step === 'confirm') onRetry();
    else setStep('store');
  };

  function onRetry() {
    setSaveError(null);
    if (source === 'manual') setStep('manual');
    else scanAgain();
  }

  const onConfirm = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const card = await add({
        storeKey: draft.store.key,
        displayName: draft.displayName,
        programme: draft.programme,
        colour: draft.colour,
        value: draft.value,
        format: draft.format,
      });
      navigate('/app', { state: { expandId: card.id } });
    } catch (err) {
      setSaveError(err);
      setSaving(false);
    }
  };

  let title = 'Add a card';
  let body = null;
  if (step === 'store') {
    // StorePicker draws its own header: it has a second view for "Other store".
    return (
      <main className="add-page">
        <StorePicker
          onBack={() => navigate('/app')}
          onPick={(picked) => {
            setDraft({ ...EMPTY_DRAFT, ...picked });
            setTyped('');
            scanAgain();
          }}
        />
      </main>
    );
  }
  if (step === 'scan') {
    title = `Scan your ${draft.displayName} card`;
    body = (
      <>
        <ScanStep
          key={scanRun}
          store={draft.store}
          onResult={onScanResult}
          onManual={() => setStep('manual')}
        />
        <ConfirmDialog
          open={scannedSaId !== null}
          {...SA_ID_DIALOG}
          onConfirm={() => {
            const read = scannedSaId;
            setScannedSaId(null);
            toConfirm(read, 'scan');
          }}
          onCancel={() => {
            setScannedSaId(null);
            setScanRun((n) => n + 1);
          }}
        />
      </>
    );
  } else if (step === 'manual') {
    title = `Type your ${draft.displayName} number`;
    body = (
      <ManualEntry
        store={draft.store}
        initialValue={typed}
        cancelLabel="Scan the barcode instead"
        onCancel={scanAgain}
        onSubmit={(read) => toConfirm(read, 'manual')}
        onChange={setTyped}
      />
    );
  } else if (step === 'confirm') {
    title = 'Check your card';
    body = (
      <ConfirmStep
        draft={draft}
        error={saveError}
        busy={saving}
        retryLabel={source === 'manual' ? 'No, type it again' : 'No, scan again'}
        onConfirm={onConfirm}
        onRetry={onRetry}
      />
    );
  }

  return (
    <main className="add-page">
      <StepHeader key={step} title={title} onBack={back} />
      {body}
    </main>
  );
}

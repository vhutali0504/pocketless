import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button.jsx';
import './ui.css';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Sets `inert` on everything in <body> except `keep`, and returns how to undo it. Elements that
 * were already inert are left as they were.
 * @param {Element} keep
 */
function makeBackgroundInert(keep) {
  const changed = [...document.body.children].filter((el) => el !== keep && !el.hasAttribute('inert'));
  changed.forEach((el) => el.setAttribute('inert', ''));
  return () => changed.forEach((el) => el.removeAttribute('inert'));
}

/**
 * Modal yes/no question. Focus moves to the cancel button on open (the safe choice), Tab stays
 * inside, Escape cancels, and focus returns to whatever opened it when it closes. It renders into
 * <body> so everything else can be made `inert` while it is open: screen readers can't wander
 * to the page behind.
 * @param {{ open: boolean, title: string, body: string, confirmLabel: string, cancelLabel: string,
 *   onConfirm(): void, onCancel(): void }} props
 */
export default function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  const titleId = useId();
  const bodyId = useId();
  const backdropRef = useRef(null);
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const restore = makeBackgroundInert(backdropRef.current);
    cancelRef.current?.focus();
    return () => {
      // Un-inert first: an inert element can't take focus back.
      restore();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);

  // On the document, not the dialog: after a click on the backdrop focus falls to <body>, and
  // Escape and the Tab trap must keep working wherever focus is while the dialog is open.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = dialogRef.current.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div ref={backdropRef} className="dialog-backdrop">
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <h2 id={titleId} className="dialog__title">{title}</h2>
        <p id={bodyId} className="dialog__body">{body}</p>
        <div className="dialog__actions">
          <Button variant="secondary" ref={cancelRef} onClick={onCancel}>{cancelLabel}</Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

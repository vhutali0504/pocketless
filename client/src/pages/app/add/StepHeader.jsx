import { useEffect, useRef } from 'react';
import Button from '../../../components/ui/Button.jsx';

/**
 * Back button and the step's title. The title takes focus when the step appears, so screen
 * reader and keyboard users start at the top of each new step.
 * @param {{ title: string, onBack(): void, focusOnMount?: boolean }} props
 */
export default function StepHeader({ title, onBack, focusOnMount = true }) {
  const headingRef = useRef(null);
  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);

  return (
    <header className="add-header">
      <Button variant="quiet" className="add-header__back" onClick={onBack}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </Button>
      <h1 ref={headingRef} tabIndex={-1} className="add-header__title">{title}</h1>
    </header>
  );
}

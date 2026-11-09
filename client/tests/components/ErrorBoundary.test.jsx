import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../../src/components/ui/ErrorBoundary.jsx';

function Boom() {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  let consoleError;
  let reload;
  const realLocation = window.location;
  beforeEach(() => {
    // React reports the caught error through console.error too; keep the test output clean.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload } });
  });
  afterEach(() => {
    consoleError.mockRestore();
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });

  it('renders the children when nothing throws', () => {
    render(<ErrorBoundary><p>All good</p></ErrorBoundary>);
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows the reassurance copy and a Reload button when a child throws', async () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong. Your cards are safe on this phone.')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith('Pocketless hit an error:', expect.objectContaining({ message: 'kaboom' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

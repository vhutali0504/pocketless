import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../../src/components/ui/ConfirmDialog.jsx';

function setup() {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Delete?"
      body="Sure?"
      confirmLabel="Delete"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onCancel, onConfirm };
}

describe('ConfirmDialog keyboard handling after focus is lost', () => {
  it('still cancels on Escape once focus has fallen to the body (backdrop click)', async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();
    screen.getByRole('button', { name: 'Cancel' }).blur();
    expect(document.activeElement).toBe(document.body);
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('still traps Tab: focus returns into the dialog', async () => {
    const user = userEvent.setup();
    setup();
    screen.getByRole('button', { name: 'Cancel' }).blur();
    await user.tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });
});

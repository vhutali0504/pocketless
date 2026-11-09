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

describe('ConfirmDialog background', () => {
  function Page({ open }) {
    return (
      <div>
        <button type="button">Behind</button>
        <ConfirmDialog
          open={open}
          title="Delete?"
          body="Sure?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </div>
    );
  }

  it('makes the page behind inert while open and restores it, and focus, on close', () => {
    const { container, rerender } = render(<Page open={false} />);
    const behind = screen.getByRole('button', { name: 'Behind' });
    behind.focus();
    rerender(<Page open />);
    expect(container).toHaveAttribute('inert');
    expect(screen.getByRole('dialog').closest('[inert]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    rerender(<Page open={false} />);
    expect(container).not.toHaveAttribute('inert');
    expect(behind).toHaveFocus();
  });

  it('leaves something that was already inert alone', () => {
    const other = document.createElement('div');
    other.setAttribute('inert', '');
    document.body.appendChild(other);
    try {
      const { rerender } = render(<Page open />);
      rerender(<Page open={false} />);
      expect(other).toHaveAttribute('inert');
    } finally {
      other.remove();
    }
  });
});

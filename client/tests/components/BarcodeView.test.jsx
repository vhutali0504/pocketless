import { render, screen, waitFor } from '@testing-library/react';
import BarcodeView from '../../src/components/barcode/BarcodeView.jsx';

describe('BarcodeView', () => {
  it('draws a 1D barcode with bars and grouped number', () => {
    render(<BarcodeView value="4006381333931" format="EAN_13" />);
    const img = screen.getByRole('img', { name: 'Barcode for 4006381333931' });
    expect(img.querySelectorAll('rect').length).toBeGreaterThan(0);
    expect(screen.getByText('4006 3813 3393 1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('colours the 1D background and bars with fill attributes, not only inline styles', () => {
    render(<BarcodeView value="4006381333931" format="EAN_13" />);
    const svg = screen.getByRole('img', { name: 'Barcode for 4006381333931' }).querySelector('svg');
    const background = svg.querySelector(':scope > rect');
    const groups = svg.querySelectorAll(':scope > g');
    expect(background).toHaveAttribute('fill', '#ffffff');
    expect(groups.length).toBeGreaterThan(0);
    groups.forEach((g) => {
      expect(g).toHaveAttribute('fill', '#000000');
      expect(g.querySelectorAll('rect').length).toBeGreaterThan(0);
    });
  });

  it('draws a QR code', async () => {
    render(<BarcodeView value="HELLO" format="QR_CODE" />);
    const img = await screen.findByRole('img', { name: 'Barcode for HELLO' });
    await waitFor(() => expect(img.querySelector('svg rect, svg path')).not.toBeNull());
    expect(screen.getByText('HELL O')).toBeInTheDocument();
  });

  it('shows the fallback for an invalid value', () => {
    render(<BarcodeView value="123" format="EAN_13" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("The barcode couldn't be drawn. Read this number to the cashier:");
    expect(alert).toHaveTextContent('123');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('falls back on a bad checksum', () => {
    render(<BarcodeView value="4006381333932" format="EAN_13" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

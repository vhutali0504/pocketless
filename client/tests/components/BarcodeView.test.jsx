import { render, screen, waitFor } from '@testing-library/react';
import BarcodeView from '../../src/components/barcode/BarcodeView.jsx';

/** Decodes an <img> data URL back into an SVG document. */
function svgFromImg(img) {
  const src = img.getAttribute('src');
  expect(src.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
  const markup = decodeURIComponent(src.slice(src.indexOf(',') + 1));
  return new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
}

describe('BarcodeView', () => {
  it('draws a 1D barcode as a picture with bars and the grouped number', () => {
    render(<BarcodeView value="4006381333931" format="EAN_13" />);
    const art = screen.getByRole('img', { name: 'Barcode for 4006381333931' });
    const img = art.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('alt', '');
    const svg = svgFromImg(img);
    expect(svg.nodeName).toBe('svg');
    expect(svg.querySelectorAll('rect').length).toBeGreaterThan(10);
    expect(screen.getByText('4006 3813 3393 1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('is a picture, not page SVG, so browser dark modes cannot recolour the bars', () => {
    render(<BarcodeView value="4006381333931" format="EAN_13" />);
    const art = screen.getByRole('img', { name: 'Barcode for 4006381333931' });
    expect(art.querySelector('svg')).toBeNull();
    expect(art.querySelector('img')).not.toBeNull();
  });

  it('colours the background white and the bars black with fill attributes, never inline styles', () => {
    render(<BarcodeView value="4006381333931" format="EAN_13" />);
    const svg = svgFromImg(screen.getByRole('img', { name: 'Barcode for 4006381333931' }).querySelector('img'));
    const background = svg.querySelector(':scope > rect');
    const groups = svg.querySelectorAll(':scope > g');
    expect(background.getAttribute('fill')).toBe('#ffffff');
    expect(groups.length).toBeGreaterThan(0);
    groups.forEach((g) => {
      expect(g.getAttribute('fill')).toBe('#000000');
      expect(g.querySelectorAll('rect').length).toBeGreaterThan(0);
    });
    expect(svg.hasAttribute('style')).toBe(false);
    expect(svg.querySelectorAll('[style]').length).toBe(0);
  });

  it('draws a QR code as a picture', async () => {
    render(<BarcodeView value="HELLO" format="QR_CODE" />);
    const art = await screen.findByRole('img', { name: 'Barcode for HELLO' });
    await waitFor(() => expect(art.querySelector('img')).not.toBeNull());
    const svg = svgFromImg(art.querySelector('img'));
    expect(svg.querySelector('path')).not.toBeNull();
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

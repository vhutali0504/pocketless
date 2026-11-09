import { useEffect, useMemo, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { validateValue } from '../../lib/barcode.js';
import './BarcodeView.css';

/** @typedef {import('../../lib/barcode.js').BarcodeFormat} BarcodeFormat */

const JSBARCODE_FORMAT = {
  EAN_13: 'EAN13',
  EAN_8: 'EAN8',
  UPC_A: 'UPC',
  CODE_128: 'CODE128',
  CODE_39: 'CODE39',
  ITF: 'ITF',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function groupInFours(value) {
  return value.match(/.{1,4}/gu)?.join(' ') ?? '';
}

// The barcode is shown as a picture (<img>), not as SVG inside the page. Browser dark modes
// that repaint web pages (Samsung Internet's in particular) recolour page elements, which
// turned the bars grey on grey, but they leave pictures alone. As a picture the bars stay
// black on their own white quiet zone, whatever the browser does to the rest of the page.
function toDataUrl(markup) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

/** Draws a 1D barcode and returns it as an SVG data URL. Throws if the value can't be drawn. */
export function drawOneD(value, format) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  JsBarcode(svg, value, {
    format: JSBARCODE_FORMAT[format],
    displayValue: false,
    margin: 20, // px at JsBarcode's module width of 2 = 10 modules quiet zone each side
    background: '#ffffff',
    lineColor: '#000000',
  });
  // JsBarcode colours its background and bars with inline style attributes. Use plain fill
  // attributes instead so the drawing never depends on styles (a strict CSP blocks them).
  for (const child of svg.children) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'rect') child.setAttribute('fill', '#ffffff');
    else if (tag === 'g') child.setAttribute('fill', '#000000');
  }
  svg.removeAttribute('style');
  svg.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'));
  svg.setAttribute('shape-rendering', 'crispEdges');
  // JsBarcode writes an xmlns attribute; the serializer adds the namespace itself, and two
  // copies make the picture invalid XML that won't display.
  svg.removeAttribute('xmlns');
  return toDataUrl(new XMLSerializer().serializeToString(svg));
}

/** Draws a QR code and resolves to an SVG data URL. */
export async function drawQr(value) {
  const markup = await QRCode.toString(value, { type: 'svg', margin: 2 });
  if (!markup.trimStart().startsWith('<svg')) throw new Error('bad qr svg');
  return toDataUrl(markup);
}

function Fallback({ value }) {
  return (
    <div className="barcode-view" role="alert">
      <p className="barcode-view__fallback-text">
        The barcode couldn't be drawn. Read this number to the cashier:
      </p>
      <p className="barcode-view__fallback-number">{groupInFours(value)}</p>
    </div>
  );
}

/**
 * Black-on-white barcode with a readable number. Falls back to a large number if it cannot draw.
 * @param {{ value: string, format: BarcodeFormat }} props
 */
export default function BarcodeView({ value, format }) {
  const valid = validateValue(value, format).ok;
  const isQr = format === 'QR_CODE';
  const key = `${format}:${value}`;

  const oneD = useMemo(() => {
    if (!valid || isQr) return null;
    try {
      return { src: drawOneD(value, format) };
    } catch {
      return { failed: true };
    }
  }, [valid, isQr, value, format]);

  const [qr, setQr] = useState(null); // { key, src } | { key, failed: true }
  useEffect(() => {
    if (!valid || !isQr) return undefined;
    let cancelled = false;
    drawQr(value)
      .then((src) => {
        if (!cancelled) setQr({ key, src });
      })
      .catch(() => {
        if (!cancelled) setQr({ key, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [valid, isQr, value, key]);

  const current = isQr ? (qr?.key === key ? qr : null) : oneD;
  if (!valid || current?.failed) return <Fallback value={value} />;

  return (
    <div className="barcode-view">
      <div
        className={`barcode-view__art${isQr ? ' barcode-view__art--qr' : ''}`}
        role="img"
        aria-label={`Barcode for ${value}`}
      >
        {current?.src && <img src={current.src} alt="" draggable={false} />}
      </div>
      <p className="barcode-view__number">{groupInFours(value)}</p>
    </div>
  );
}

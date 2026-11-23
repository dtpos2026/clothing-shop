import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import type { BarcodeFormat } from '@/types';
import { isValidEan } from '@/core/barcode';

/** Renders a product code as a barcode (EAN-13/EAN-8/CODE128) or QR code, as SVG for crisp printing. */
export function CodeImage({ value, format, height = 40, width = 1.6, showText = true, qrSize = 72, fontSize = 12 }: {
  value: string; format: BarcodeFormat; height?: number; width?: number; showText?: boolean; qrSize?: number; fontSize?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const effFormat = (format === 'EAN13' && !(value.length === 13 && isValidEan(value))) || (format === 'EAN8' && !(value.length === 8 && isValidEan(value)))
    ? 'CODE128' : format;

  useEffect(() => {
    if (effFormat === 'QR' || !ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: effFormat, height, width, displayValue: showText, fontSize, margin: 2, textMargin: 1, background: '#ffffff', lineColor: '#000000',
      });
    } catch {
      JsBarcode(ref.current, value, { format: 'CODE128', height, width, displayValue: showText, fontSize, margin: 2 });
    }
  }, [value, effFormat, height, width, showText, fontSize]);

  if (!value) return null;
  if (effFormat === 'QR') {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
        <QRCodeSVG value={value} size={qrSize} level="M" marginSize={0} />
        {showText && <span style={{ fontFamily: 'monospace', fontSize: fontSize - 2, marginTop: 2 }}>{value}</span>}
      </div>
    );
  }
  return <svg ref={ref} style={{ maxWidth: '100%' }} />;
}

/** Render a code to a PNG data URL (for sharing / saving a single product code). */
export async function codeToPng(value: string, format: BarcodeFormat, label?: string): Promise<string> {
  const canvas = document.createElement('canvas');
  if (format === 'QR') {
    // draw QR via an offscreen SVG → image
    const svgNs = 'http://www.w3.org/2000/svg';
    const holder = document.createElement('div');
    const { createRoot } = await import('react-dom/client');
    const root = createRoot(holder);
    await new Promise<void>(r => { root.render(<QRCodeSVG value={value} size={480} level="M" marginSize={2} />); setTimeout(r, 30); });
    const svg = holder.querySelector('svg')!;
    svg.setAttribute('xmlns', svgNs);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.outerHTML);
    await img.decode();
    root.unmount();
    canvas.width = 520; canvas.height = label ? 600 : 520;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 20, 20, 480, 480);
    if (label) { ctx.fillStyle = '#000'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, 260, 550, 500); }
    return canvas.toDataURL('image/png');
  }
  const eff = (format === 'EAN13' || format === 'EAN8') && !isValidEan(value) ? 'CODE128' : format;
  JsBarcode(canvas, value, { format: eff, height: 140, width: 4, fontSize: 32, margin: 20, background: '#ffffff' });
  if (!label) return canvas.toDataURL('image/png');
  const out = document.createElement('canvas');
  out.width = canvas.width; out.height = canvas.height + 60;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
  ctx.fillStyle = '#000'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, out.width / 2, 40, out.width - 20);
  ctx.drawImage(canvas, 0, 55);
  return out.toDataURL('image/png');
}

export const dataUrlToBytes = (dataUrl: string) => Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));

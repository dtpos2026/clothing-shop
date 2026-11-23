/**
 * Printing: Windows uses Chromium's print pipeline via Electron (supports silent printing to a
 * named thermal printer and exact paper widths); Android uses the system PrintManager
 * (works with Wi-Fi/Bluetooth printers that provide an Android print service, e.g. RawBT/Mopria);
 * browsers print through a hidden iframe.
 */
import { Capacitor } from '@capacitor/core';
import { isElectron } from './device';
import { DtNative } from './files';
import type { PaperSize } from '@/types';

export const PAPER_MM: Record<PaperSize, { w: number; h?: number }> = {
  '58mm': { w: 58 }, '80mm': { w: 80 }, A5: { w: 148, h: 210 }, A4: { w: 210, h: 297 },
};

export function wrapPrintHtml(body: string, paper: PaperSize, extraCss = '') {
  const { w, h } = PAPER_MM[paper];
  const size = h ? `${w}mm ${h}mm` : `${w}mm auto`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print</title><style>
@page { size: ${size}; margin: ${h ? '8mm' : '0'}; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; }
body { width: ${h ? 'auto' : `${w}mm`}; }
img { max-width: 100%; }
${extraCss}
</style></head><body>${body}</body></html>`;
}

export interface PrintOptions { paper: PaperSize; silent?: boolean; printerName?: string; jobName?: string }

export async function printHtml(html: string, opts: PrintOptions): Promise<{ ok: boolean; error?: string }> {
  const full = html.startsWith('<!DOCTYPE') ? html : wrapPrintHtml(html, opts.paper);
  if (isElectron()) {
    const { w, h } = PAPER_MM[opts.paper];
    return window.electronAPI!.printHtml({
      html: full, silent: !!opts.silent && !!opts.printerName && opts.printerName !== 'Default Printer',
      deviceName: opts.printerName && opts.printerName !== 'Default Printer' ? opts.printerName : undefined,
      pageWidthMm: w, pageHeightMm: h,
    });
  }
  if (Capacitor.isNativePlatform()) {
    try {
      const r = await DtNative.printHtml({ html: full, jobName: opts.jobName || 'Invoice', widthMm: PAPER_MM[opts.paper].w });
      return { ok: r.started };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return new Promise(resolve => {
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(full);
    doc.close();
    const go = () => {
      try {
        iframe.contentWindow!.focus();
        iframe.contentWindow!.print();
        resolve({ ok: true });
      } catch (e) {
        resolve({ ok: false, error: String(e) });
      }
      setTimeout(() => iframe.remove(), 60_000);
    };
    const imgs = [...doc.images];
    if (imgs.length === 0) setTimeout(go, 150);
    else Promise.all(imgs.map(i => (i.complete ? Promise.resolve() : new Promise(r => { i.onload = i.onerror = r; })))).then(() => setTimeout(go, 100));
  });
}

/** Print a rendered image (e.g. a receipt captured at high DPI for thermal clarity). */
export function printImage(dataUrl: string, opts: PrintOptions) {
  return printHtml(wrapPrintHtml(`<img src="${dataUrl}" style="width:100%;display:block" />`, opts.paper), opts);
}

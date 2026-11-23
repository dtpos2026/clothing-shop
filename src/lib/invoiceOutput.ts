/**
 * Turn a rendered invoice element into PNG / PDF / print, and share them.
 * PDFs are rendered from the same HTML template (image-based) so Urdu text and every
 * template design come out exactly as previewed.
 */
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { PaperSize } from '@/types';
import { printHtml, wrapPrintHtml, PAPER_MM } from '@/platform/print';

export async function captureElement(el: HTMLElement, scale = 3): Promise<HTMLCanvasElement> {
  // wait for fonts/images so the capture is complete
  try { await document.fonts?.ready; } catch { /* ignore */ }
  await Promise.all([...el.querySelectorAll('img')].map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; }))));
  return html2canvas(el, { backgroundColor: '#ffffff', scale, useCORS: true, logging: false });
}

export async function elementToPngBytes(el: HTMLElement): Promise<Uint8Array> {
  const canvas = await captureElement(el);
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function elementToPdfBytes(el: HTMLElement, paper: PaperSize): Promise<Uint8Array> {
  const canvas = await captureElement(el, 2.5);
  const { w, h } = PAPER_MM[paper];
  const img = canvas.toDataURL('image/jpeg', 0.92);
  const imgHmm = (canvas.height / canvas.width) * w;
  if (!h) {
    // thermal: one long page exactly as tall as the receipt
    const doc = new jsPDF({ unit: 'mm', format: [w, Math.max(60, imgHmm)] });
    doc.addImage(img, 'JPEG', 0, 0, w, imgHmm);
    return new Uint8Array(doc.output('arraybuffer'));
  }
  const doc = new jsPDF({ unit: 'mm', format: [w, h] });
  // paginate tall invoices
  let y = 0;
  let page = 0;
  while (y < imgHmm - 0.5) {
    if (page > 0) doc.addPage([w, h]);
    doc.addImage(img, 'JPEG', 0, -y, w, imgHmm);
    y += h;
    page++;
  }
  return new Uint8Array(doc.output('arraybuffer'));
}

/** Print: thermal receipts as a sharp high-DPI image, A4/A5 as live HTML. */
export async function printInvoiceElement(el: HTMLElement, paper: PaperSize, opts: { silent?: boolean; printerName?: string } = {}) {
  if (paper === '58mm' || paper === '80mm') {
    const canvas = await captureElement(el, 4);
    return printHtml(wrapPrintHtml(`<img src="${canvas.toDataURL('image/png')}" style="width:100%;display:block" />`, paper), { paper, ...opts });
  }
  return printHtml(wrapPrintHtml(el.outerHTML, paper, 'body > div { width: 100% !important; }'), { paper, ...opts });
}

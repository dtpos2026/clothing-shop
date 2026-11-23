/**
 * Generic table export: CSV (UTF-8 BOM), XLSX (ExcelJS), PDF and PNG.
 * PDF/PNG are rendered from HTML page by page so Urdu (Nastaleeq) text is shaped correctly.
 */
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toCSV } from '@/core/csv';
import type { StoreSettings } from '@/types';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'png';

export interface TableColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
  /** numeric columns are right-aligned and typed as numbers in Excel */
  numeric?: boolean;
  width?: number;
}

export interface TableSpec<T> {
  title: string;
  subtitle?: string;
  columns: TableColumn<T>[];
  rows: T[];
  /** totals row: header → value */
  totals?: Record<string, string | number>;
  summary?: { label: string; value: string }[];
  landscape?: boolean;
}

export const MIME: Record<ExportFormat | 'zip', string> = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  png: 'image/png',
  zip: 'application/zip',
};

export const fileStamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
export const slugify = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export';

export function tableToCSV<T>(spec: TableSpec<T>): Uint8Array {
  const csv = toCSV(spec.rows, spec.columns.map(c => ({ header: c.header, value: c.value })));
  return new TextEncoder().encode(csv);
}

export async function tableToXLSX<T>(specs: TableSpec<T>[] | TableSpec<T>, settings?: StoreSettings): Promise<Uint8Array> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = settings?.storeName || 'Digital Target POS';
  wb.created = new Date();
  for (const spec of Array.isArray(specs) ? specs : [specs]) {
    const ws = wb.addWorksheet(spec.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '), { views: [{ state: 'frozen', ySplit: 3 }] });
    ws.addRow([`${settings?.storeName || ''} – ${spec.title}`]).font = { bold: true, size: 14 };
    ws.addRow([spec.subtitle || `Generated ${new Date().toLocaleString()}`]).font = { italic: true, color: { argb: 'FF666666' } };
    const header = ws.addRow(spec.columns.map(c => c.header));
    header.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E3A' } };
      cell.alignment = { vertical: 'middle' };
    });
    for (const r of spec.rows) {
      ws.addRow(spec.columns.map(c => {
        const v = c.value(r);
        return c.numeric && v !== '' && v !== null && v !== undefined ? Number(v) : v ?? '';
      }));
    }
    if (spec.totals) {
      const t = ws.addRow(spec.columns.map(c => spec.totals![c.header] ?? ''));
      t.font = { bold: true };
    }
    spec.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = c.width || Math.min(45, Math.max(10, c.header.length + 2, ...spec.rows.slice(0, 200).map(r => String(c.value(r) ?? '').length + 2)));
      if (c.numeric) col.numFmt = '#,##0.##';
    });
    if (spec.summary?.length) {
      ws.addRow([]);
      spec.summary.forEach(s => { const row = ws.addRow([s.label, s.value]); row.getCell(1).font = { bold: true }; });
    }
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function pageHtml<T>(spec: TableSpec<T>, rows: T[], page: number, pages: number, settings: StoreSettings, widthPx: number, last: boolean) {
  const urdu = settings.urduFont || 'Jameel Noori Nastaleeq';
  const head = spec.columns.map(c => `<th style="text-align:${c.numeric ? 'right' : 'left'}">${esc(c.header)}</th>`).join('');
  const body = rows.map((r, i) => `<tr style="background:${i % 2 ? '#f7f7f7' : '#fff'}">${spec.columns.map(c => {
    const v = c.value(r);
    return `<td style="text-align:${c.numeric ? 'right' : 'left'}">${esc(c.numeric && typeof v === 'number' ? v.toLocaleString('en-PK', { maximumFractionDigits: 2 }) : v)}</td>`;
  }).join('')}</tr>`).join('');
  const totals = last && spec.totals ? `<tr class="tot">${spec.columns.map(c => `<td style="text-align:${c.numeric ? 'right' : 'left'}">${esc(typeof spec.totals![c.header] === 'number' ? (spec.totals![c.header] as number).toLocaleString('en-PK', { maximumFractionDigits: 2 }) : spec.totals![c.header] ?? '')}</td>`).join('')}</tr>` : '';
  const summary = last && spec.summary?.length ? `<div class="sum">${spec.summary.map(s => `<div><span>${esc(s.label)}</span><b>${esc(s.value)}</b></div>`).join('')}</div>` : '';
  return `<div style="width:${widthPx}px;padding:28px;background:#fff;color:#111;font-family:'Plus Jakarta Sans','${urdu}',Arial,sans-serif;font-size:11px;box-sizing:border-box">
  <style>
    table{width:100%;border-collapse:collapse} th{background:#164e3a;color:#fff;padding:6px;font-size:10.5px}
    td{padding:5px 6px;border-bottom:1px solid #e5e5e5;vertical-align:top;word-break:break-word}
    tr.tot td{font-weight:800;border-top:2px solid #164e3a;background:#eef5f1}
    .sum{margin-top:12px;display:grid;grid-template-columns:repeat(2,1fr);gap:4px 24px}
    .sum div{display:flex;justify-content:space-between;border-bottom:1px dashed #ccc;padding:2px 0}
  </style>
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #c6a458;padding-bottom:8px;margin-bottom:10px">
    <div style="display:flex;gap:10px;align-items:center">
      ${settings.logoUrl ? `<img src="${settings.logoUrl}" style="height:42px;max-width:110px;object-fit:contain"/>` : ''}
      <div><div style="font-size:17px;font-weight:800;color:#164e3a">${esc(settings.storeName)}</div>
      <div style="color:#555">${esc(settings.address || '')}${settings.phone ? ` · ${esc(settings.phone)}` : ''}</div></div>
    </div>
    <div style="text-align:right"><div style="font-size:14px;font-weight:800">${esc(spec.title)}</div>
    <div style="color:#555">${esc(spec.subtitle || '')}</div></div>
  </div>
  <table><thead><tr>${head}</tr></thead><tbody>${body}${totals}</tbody></table>
  ${summary}
  <div style="margin-top:10px;display:flex;justify-content:space-between;color:#888;font-size:9px"><span>Generated ${esc(new Date().toLocaleString())}</span><span>Page ${page} of ${pages}</span></div>
</div>`;
}

async function renderHtml(html: string): Promise<HTMLCanvasElement> {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-20000px;top:0;z-index:-1';
  holder.innerHTML = html;
  document.body.appendChild(holder);
  try {
    try { await document.fonts?.ready; } catch { /* ignore */ }
    await Promise.all([...holder.querySelectorAll('img')].map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; }))));
    return await html2canvas(holder.firstElementChild as HTMLElement, { backgroundColor: '#fff', scale: 2, logging: false });
  } finally {
    holder.remove();
  }
}

export async function tableToPDF<T>(spec: TableSpec<T>, settings: StoreSettings): Promise<Uint8Array> {
  const landscape = spec.landscape ?? spec.columns.length > 7;
  const widthPx = landscape ? 1123 : 794;
  const perPage = landscape ? 24 : 34;
  const chunks: T[][] = [];
  for (let i = 0; i < Math.max(1, spec.rows.length); i += perPage) chunks.push(spec.rows.slice(i, i + perPage));
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' });
  const pw = doc.internal.pageSize.getWidth();
  for (let i = 0; i < chunks.length; i++) {
    const canvas = await renderHtml(pageHtml(spec, chunks[i], i + 1, chunks.length, settings, widthPx, i === chunks.length - 1));
    if (i > 0) doc.addPage('a4', landscape ? 'landscape' : 'portrait');
    const h = (canvas.height / canvas.width) * pw;
    doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pw, h);
  }
  return new Uint8Array(doc.output('arraybuffer'));
}

export async function tableToPNG<T>(spec: TableSpec<T>, settings: StoreSettings): Promise<Uint8Array> {
  const rows = spec.rows.slice(0, 400); // keep images shareable on WhatsApp
  const canvas = await renderHtml(pageHtml({ ...spec, rows }, rows, 1, 1, settings, spec.columns.length > 7 ? 1123 : 794, true));
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function exportTable<T>(spec: TableSpec<T>, format: ExportFormat, settings: StoreSettings) {
  const bytes = format === 'csv' ? tableToCSV(spec)
    : format === 'xlsx' ? await tableToXLSX(spec, settings)
      : format === 'pdf' ? await tableToPDF(spec, settings)
        : await tableToPNG(spec, settings);
  return { bytes, mime: MIME[format], fileName: `${slugify(spec.title)}-${fileStamp()}.${format}` };
}

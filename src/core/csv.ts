/**
 * CSV export/import with correct Urdu/English handling:
 *  - UTF-8 with BOM so Excel on Windows shows Urdu correctly
 *  - RFC 4180 quoting
 *  - formula-injection guard (cells starting with = + - @ are prefixed with ')
 */
export interface Column<T> { header: string; value: (row: T) => unknown }

const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'number' ? String(v) : String(v);
  if (typeof v !== 'number' && FORMULA.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV<T>(rows: T[], columns: Column<T>[]): string {
  const lines = [columns.map(c => csvCell(c.header)).join(',')];
  for (const r of rows) lines.push(columns.map(c => csvCell(c.value(r))).join(','));
  return '﻿' + lines.join('\r\n');
}

/** Minimal RFC 4180 parser (handles quotes, commas and newlines inside quotes, BOM). */
export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

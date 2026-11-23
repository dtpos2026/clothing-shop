/**
 * Six professional invoice / receipt templates.
 * All templates use inline styles only, so the exact same markup is used for screen preview,
 * printing (thermal + A4), PNG export and PDF export.
 */
import type { CSSProperties, ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { format, parseISO } from 'date-fns';
import type { InvoiceDesign, InvoiceTemplateId, PaperSize, Sale, StoreSettings } from '@/types';
import { amountInWords, salePayments } from '@/core/accounting';
import { effectiveSellUnit, unitLabel, round2 } from '@/core/inventory';

export interface InvoiceProps {
  sale: Sale;
  settings: StoreSettings;
  design: InvoiceDesign;
  cashierName?: string;
}

export const TEMPLATE_META: Record<InvoiceTemplateId, { name: string; description: string; best: PaperSize[] }> = {
  'classic-retail': { name: 'Classic Retail', description: 'Centered header, dashed rules, 4-column table. The familiar shop receipt.', best: ['80mm', '58mm', 'A5'] },
  'modern-minimal': { name: 'Modern Minimal', description: 'Left-aligned, generous whitespace, two-line items, accent total.', best: ['80mm', 'A5', 'A4'] },
  'premium-business': { name: 'Premium Business', description: 'Coloured header band, bill-to & invoice boxes, totals card, signature.', best: ['A4', 'A5'] },
  'detailed-table': { name: 'Detailed Product Table', description: 'Fully gridded table with S.No, SKU, unit, discount, tax; amount in words.', best: ['A4', 'A5', '80mm'] },
  'compact-thermal': { name: 'Compact Thermal', description: 'Monospace, minimal paper use, tuned for 58 mm printers.', best: ['58mm', '80mm'] },
  'professional-a4': { name: 'Professional A4', description: 'Letterhead, three-column parties, zebra table, terms, QR and signatures.', best: ['A4'] },
};

export const PAPER_PX: Record<PaperSize, number> = { '58mm': 219, '80mm': 302, A5: 559, A4: 794 };

// ---------- helpers ----------
const fmtDate = (iso: string) => format(parseISO(iso), 'dd/MM/yyyy');
const fmtTime = (iso: string) => format(parseISO(iso), 'hh:mm a');
const n = (v: number) => (Math.round(v * 100) / 100).toLocaleString('en-PK', { maximumFractionDigits: 2 });

function calc(sale: Sale, design: InvoiceDesign) {
  const isRet = sale.kind === 'return';
  const tax = design.taxRate > 0 ? round2(sale.total - sale.total / (1 + design.taxRate / 100)) : sale.taxAmount || 0;
  const pays = salePayments(sale);
  const paid = round2(pays.reduce((a, p) => a + p.amount, 0));
  const change = sale.saleType === 'cash' && !isRet && paid > sale.total ? round2(paid - sale.total) : 0;
  return { isRet, tax, pays, paid, change, balance: sale.creditAmount };
}

function itemName(it: Sale['items'][number]) {
  return `${it.product.brand} ${it.product.article}${it.color ? ` (${it.color})` : ''}`;
}
function itemUnit(it: Sale['items'][number]) {
  return unitLabel(effectiveSellUnit(it));
}
function qrValue(sale: Sale, settings: StoreSettings) {
  return JSON.stringify({ inv: sale.invoiceNumber, d: sale.createdAt.slice(0, 10), t: sale.total, s: settings.storeName.slice(0, 30) });
}

function Logo({ settings, design, max = 60 }: { settings: StoreSettings; design: InvoiceDesign; max?: number }) {
  if (!design.fields.logo || !settings.logoUrl) return null;
  return <img src={settings.logoUrl} alt="" style={{ maxHeight: max, maxWidth: max * 2.2, objectFit: 'contain', display: 'block' }} />;
}

function Row({ l, r, style }: { l: ReactNode; r: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...style }}><span>{l}</span><span style={{ textAlign: 'right' }}>{r}</span></div>;
}

function Qr({ sale, settings, design, size = 64 }: InvoiceProps & { size?: number }) {
  const show = design.fields.qr && (settings.enableInvoiceQr || (settings.enableCustomQr && settings.customQrUrl));
  if (!show) return null;
  return (
    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'flex-start' }}>
      {settings.enableInvoiceQr && <div style={{ textAlign: 'center' }}><QRCodeSVG value={qrValue(sale, settings)} size={size} /><div style={{ fontSize: 8 }}>Invoice</div></div>}
      {settings.enableCustomQr && settings.customQrUrl && <div style={{ textAlign: 'center' }}><img src={settings.customQrUrl} alt="" style={{ width: size, height: size }} /><div style={{ fontSize: 8 }}>Pay here</div></div>}
    </div>
  );
}

function Totals({ sale, settings, design, big = 15, accent }: InvoiceProps & { big?: number; accent?: string }) {
  const c = calc(sale, design);
  const cur = settings.currency;
  const f = design.fields;
  return (
    <div>
      <Row l="Subtotal" r={`${cur} ${n(sale.subtotal)}`} />
      {f.discount && sale.discountAmount !== 0 && <Row l="Discount" r={`- ${cur} ${n(Math.abs(sale.discountAmount))}`} />}
      {f.tax && c.tax > 0 && <Row l={`${design.taxLabel} ${design.taxRate}% (incl.)`} r={`${cur} ${n(c.tax)}`} />}
      <Row l={<b>{c.isRet ? 'REFUND TOTAL' : 'TOTAL'}</b>} r={<b>{cur} {n(sale.total)}</b>} style={{ fontSize: big, fontWeight: 900, color: accent, borderTop: '1.5px solid currentColor', paddingTop: 3, marginTop: 3 }} />
      {f.paid && c.pays.map((p, i) => <Row key={i} l={p.method === 'Exchange' ? `Exchange (${p.reference || 'return'})` : `${c.isRet ? 'Refunded' : 'Paid'} – ${p.method}`} r={`${cur} ${n(Math.abs(p.amount))}`} />)}
      {f.paid && c.change > 0 && <Row l="Change" r={`${cur} ${n(c.change)}`} />}
      {f.balance && c.balance > 0 && <Row l={<b>Remaining (Udhar)</b>} r={<b>{cur} {n(c.balance)}</b>} />}
    </div>
  );
}

function Footer({ settings, design, sale, center = true }: InvoiceProps & { center?: boolean }) {
  const f = design.fields;
  return (
    <div style={{ textAlign: center ? 'center' : 'left', fontSize: '0.9em' }}>
      {f.notes && sale.notes && <div style={{ marginBottom: 4 }}><b>Note:</b> {sale.notes}</div>}
      {f.terms && design.terms && <div style={{ fontSize: '0.85em', marginBottom: 4, opacity: 0.85 }}>{design.terms}</div>}
      {f.footer && settings.footerMessage && <div style={{ fontWeight: 700 }}>{settings.footerMessage}</div>}
      {f.footer && settings.footerNote && <div style={{ fontSize: '0.85em' }}>{settings.footerNote}</div>}
    </div>
  );
}

const base = (settings: StoreSettings, design: InvoiceDesign, mono = false): CSSProperties => ({
  width: PAPER_PX[design.paperSize],
  fontFamily: mono ? `'Courier New', monospace` : `'${settings.receiptFont}', 'Montserrat', Arial, sans-serif`,
  fontSize: (design.paperSize === '58mm' ? 10 : design.paperSize === '80mm' ? 11.5 : 12.5) * design.fontScale,
  lineHeight: 1.45, color: '#000', background: '#fff', boxSizing: 'border-box',
  padding: design.paperSize === 'A4' || design.paperSize === 'A5' ? 28 : 8,
});

/** Column set honoring visibility + configured widths; widths are renormalised to 100%. */
function columns(design: InvoiceDesign, compact: boolean) {
  const f = design.fields;
  const c = design.columns;
  const list = [
    { key: 'item', label: 'Item', w: c.item, align: 'left' as const },
    { key: 'qty', label: 'Qty', w: c.qty, align: 'center' as const },
    ...(f.unit && !compact ? [{ key: 'unit', label: 'Unit', w: c.unit, align: 'center' as const }] : []),
    { key: 'rate', label: 'Rate', w: c.rate, align: 'right' as const },
    ...(f.discount && !compact ? [{ key: 'discount', label: 'Disc', w: c.discount, align: 'right' as const }] : []),
    { key: 'total', label: 'Amount', w: c.total, align: 'right' as const },
  ];
  const sum = list.reduce((a, x) => a + x.w, 0) || 1;
  return list.map(x => ({ ...x, pct: `${((x.w / sum) * 100).toFixed(1)}%` }));
}

function cell(it: Sale['items'][number], key: string, design: InvoiceDesign) {
  switch (key) {
    case 'item': return <>{itemName(it)}{design.fields.sku && <div style={{ fontSize: '0.8em', opacity: 0.7 }}>{it.product.sku}</div>}</>;
    case 'qty': return `${n(it.quantity)}${design.fields.unit ? '' : ` ${itemUnit(it)}`}`;
    case 'unit': return itemUnit(it);
    case 'rate': return n(it.unitPrice);
    case 'discount': return it.discount ? n(it.discount) : '-';
    default: return n(it.lineTotal);
  }
}

// ---------- 1. Classic Retail ----------
export function ClassicRetail(props: InvoiceProps) {
  const { sale, settings, design, cashierName } = props;
  const f = design.fields;
  const thermal = design.paperSize === '58mm' || design.paperSize === '80mm';
  const cols = columns(design, thermal);
  const dash = '1px dashed #000';
  return (
    <div style={base(settings, design)}>
      <div style={{ textAlign: 'center', borderBottom: dash, paddingBottom: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><Logo settings={settings} design={design} /></div>
        <div style={{ fontSize: '1.5em', fontWeight: 900 }}>{settings.storeName}</div>
        {f.address && settings.address && <div style={{ fontSize: '0.9em' }}>{settings.address}</div>}
        {f.phone && settings.phone && <div style={{ fontSize: '0.9em' }}>Ph: {settings.phone}</div>}
        <div style={{ fontWeight: 800, marginTop: 4, letterSpacing: 1 }}>{sale.kind === 'return' ? 'RETURN RECEIPT' : design.title}</div>
      </div>
      <div style={{ fontSize: '0.92em', marginBottom: 6 }}>
        <Row l={`Invoice: ${sale.invoiceNumber}`} r={fmtDate(sale.createdAt)} />
        <Row l={f.cashier ? `Cashier: ${cashierName || sale.cashierName || '-'}` : ''} r={fmtTime(sale.createdAt)} />
        {sale.returnOfInvoice && <div>Against: {sale.returnOfInvoice}</div>}
        {f.customer && sale.customerName && <div>Customer: {sale.customerName}{sale.customerPhone ? ` · ${sale.customerPhone}` : ''}</div>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: dash, borderBottom: dash, tableLayout: 'fixed' }}>
        <thead><tr>{cols.map(c => <th key={c.key} style={{ width: c.pct, textAlign: c.align, padding: '4px 2px', borderBottom: dash, fontWeight: 900 }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {sale.items.map((it, i) => (
            <tr key={i}>{cols.map(c => <td key={c.key} style={{ textAlign: c.align, padding: '3px 2px', verticalAlign: 'top', wordBreak: 'break-word' }}>{cell(it, c.key, design)}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 6 }}><Totals {...props} /></div>
      <div style={{ marginTop: 10 }}><Qr {...props} /></div>
      <div style={{ borderTop: dash, marginTop: 8, paddingTop: 6 }}><Footer {...props} /></div>
    </div>
  );
}

// ---------- 2. Modern Minimal ----------
export function ModernMinimal(props: InvoiceProps) {
  const { sale, settings, design, cashierName } = props;
  const f = design.fields;
  const accent = design.accentColor;
  return (
    <div style={{ ...base(settings, design), padding: design.paperSize.endsWith('mm') ? 12 : 36 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <div style={{ fontSize: '1.7em', fontWeight: 300, letterSpacing: -0.5 }}>{settings.storeName}</div>
          {f.address && settings.address && <div style={{ color: '#555', fontSize: '0.85em' }}>{settings.address}</div>}
          {f.phone && settings.phone && <div style={{ color: '#555', fontSize: '0.85em' }}>{settings.phone}</div>}
        </div>
        <Logo settings={settings} design={design} max={44} />
      </div>
      <div style={{ height: 3, width: 48, background: accent, margin: '12px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.85em', color: '#444', marginBottom: 14 }}>
        <div><div style={{ textTransform: 'uppercase', fontSize: '0.75em', letterSpacing: 1.5 }}>{sale.kind === 'return' ? 'Return' : 'Invoice'}</div><div style={{ color: '#000', fontWeight: 700 }}>{sale.invoiceNumber}</div></div>
        <div style={{ textAlign: 'right' }}><div style={{ textTransform: 'uppercase', fontSize: '0.75em', letterSpacing: 1.5 }}>Date</div><div style={{ color: '#000' }}>{fmtDate(sale.createdAt)} {fmtTime(sale.createdAt)}</div></div>
        {f.customer && <div><div style={{ textTransform: 'uppercase', fontSize: '0.75em', letterSpacing: 1.5 }}>Billed to</div><div style={{ color: '#000' }}>{sale.customerName || 'Walk-in'}</div>{sale.customerPhone && <div>{sale.customerPhone}</div>}</div>}
        {f.cashier && <div style={{ textAlign: 'right' }}><div style={{ textTransform: 'uppercase', fontSize: '0.75em', letterSpacing: 1.5 }}>Served by</div><div style={{ color: '#000' }}>{cashierName || sale.cashierName || '-'}</div></div>}
      </div>
      <div>
        {sale.items.map((it, i) => (
          <div key={i} style={{ padding: '7px 8px', background: i % 2 ? '#fff' : '#f6f7f8', borderRadius: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{itemName(it)}</span>
              <span style={{ fontWeight: 700 }}>{n(it.lineTotal)}</span>
            </div>
            <div style={{ color: '#666', fontSize: '0.85em' }}>
              {n(it.quantity)} {itemUnit(it)} × {n(it.unitPrice)}{f.discount && it.discount ? ` − ${n(it.discount)}` : ''}{f.sku ? ` · ${it.product.sku}` : ''}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, marginLeft: design.paperSize.endsWith('mm') ? 0 : '45%' }}><Totals {...props} big={18} accent={accent} /></div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
        <div style={{ flex: 1, color: '#555' }}><Footer {...props} center={false} /></div>
        <Qr {...props} size={56} />
      </div>
    </div>
  );
}

// ---------- 3. Premium Business ----------
export function PremiumBusiness(props: InvoiceProps) {
  const { sale, settings, design, cashierName } = props;
  const f = design.fields;
  const A = design.accentColor;
  const G = design.secondaryColor;
  const thermal = design.paperSize.endsWith('mm');
  const cols = columns(design, thermal);
  return (
    <div style={{ ...base(settings, design), padding: 0 }}>
      <div style={{ background: A, color: '#fff', padding: thermal ? '10px 10px' : '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {f.logo && settings.logoUrl && <div style={{ background: '#fff', borderRadius: 6, padding: 4 }}><Logo settings={settings} design={design} max={thermal ? 34 : 54} /></div>}
          <div>
            <div style={{ fontSize: '1.45em', fontWeight: 800 }}>{settings.storeName}</div>
            {f.address && settings.address && <div style={{ fontSize: '0.8em', opacity: 0.85 }}>{settings.address}</div>}
            {f.phone && settings.phone && <div style={{ fontSize: '0.8em', opacity: 0.85 }}>{settings.phone}</div>}
          </div>
        </div>
        {!thermal && <div style={{ fontSize: '2em', fontWeight: 900, color: G, letterSpacing: 2 }}>{sale.kind === 'return' ? 'RETURN' : 'INVOICE'}</div>}
      </div>
      <div style={{ height: 4, background: G }} />
      <div style={{ padding: thermal ? 10 : '20px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: thermal ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ border: `1px solid ${G}`, borderRadius: 6, padding: 8 }}>
            <div style={{ color: A, fontWeight: 800, fontSize: '0.8em', textTransform: 'uppercase' }}>Bill to</div>
            <div style={{ fontWeight: 700 }}>{f.customer ? sale.customerName || 'Walk-in Customer' : 'Customer'}</div>
            {f.customer && sale.customerPhone && <div>{sale.customerPhone}</div>}
          </div>
          <div style={{ border: `1px solid ${G}`, borderRadius: 6, padding: 8, fontSize: '0.92em' }}>
            <Row l={<span style={{ color: A, fontWeight: 700 }}>Invoice #</span>} r={sale.invoiceNumber} />
            <Row l={<span style={{ color: A, fontWeight: 700 }}>Date</span>} r={`${fmtDate(sale.createdAt)} ${fmtTime(sale.createdAt)}`} />
            {f.cashier && <Row l={<span style={{ color: A, fontWeight: 700 }}>Cashier</span>} r={cashierName || sale.cashierName || '-'} />}
            {sale.returnOfInvoice && <Row l={<span style={{ color: A, fontWeight: 700 }}>Against</span>} r={sale.returnOfInvoice} />}
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead><tr>{cols.map(c => <th key={c.key} style={{ width: c.pct, background: A, color: '#fff', textAlign: c.align, padding: '6px 5px', fontWeight: 700 }}>{c.label}</th>)}</tr></thead>
          <tbody>{sale.items.map((it, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${G}55` }}>{cols.map(c => <td key={c.key} style={{ textAlign: c.align, padding: '6px 5px', verticalAlign: 'top', wordBreak: 'break-word' }}>{cell(it, c.key, design)}</td>)}</tr>
          ))}</tbody>
        </table>
        <div style={{ display: 'flex', gap: 14, marginTop: 14, flexDirection: thermal ? 'column' : 'row' }}>
          <div style={{ flex: 1 }}>
            {!thermal && <div style={{ fontSize: '0.85em', marginBottom: 8 }}><b>In words:</b> {settings.currency} {amountInWords(sale.total)}</div>}
            <Qr {...props} size={70} />
          </div>
          <div style={{ width: thermal ? '100%' : '42%', background: `${G}22`, border: `1px solid ${G}`, borderRadius: 6, padding: 10 }}><Totals {...props} big={16} accent={A} /></div>
        </div>
        {!thermal && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontSize: '0.85em' }}>
            <div style={{ borderTop: '1px solid #000', width: 180, textAlign: 'center', paddingTop: 4 }}>Customer Signature</div>
            <div style={{ borderTop: '1px solid #000', width: 180, textAlign: 'center', paddingTop: 4 }}>Authorised Signature</div>
          </div>
        )}
        <div style={{ marginTop: 14 }}><Footer {...props} /></div>
      </div>
      <div style={{ background: A, color: '#fff', textAlign: 'center', fontSize: '0.75em', padding: 5 }}>{settings.storeName}{settings.phone ? ` · ${settings.phone}` : ''}</div>
    </div>
  );
}

// ---------- 4. Detailed Product Table ----------
export function DetailedTable(props: InvoiceProps) {
  const { sale, settings, design, cashierName } = props;
  const f = design.fields;
  const c = calc(sale, design);
  const b = '1px solid #000';
  const showTaxCol = f.tax && design.taxRate > 0;
  const head = ['#', 'Description', ...(f.sku ? ['SKU'] : []), ...(f.unit ? ['Unit'] : []), 'Qty', 'Rate', ...(f.discount ? ['Disc'] : []), ...(showTaxCol ? [design.taxLabel] : []), 'Amount'];
  const th: CSSProperties = { border: b, padding: '4px 4px', background: '#e9e9e9', fontWeight: 800, fontSize: '0.85em' };
  const td: CSSProperties = { border: b, padding: '4px 4px', fontSize: '0.88em', verticalAlign: 'top', wordBreak: 'break-word' };
  return (
    <div style={base(settings, design)}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
        <tbody><tr>
          <td style={{ ...td, width: '60%', fontSize: '1em' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Logo settings={settings} design={design} max={40} />
              <div><div style={{ fontWeight: 900, fontSize: '1.3em' }}>{settings.storeName}</div>
                {f.address && settings.address && <div>{settings.address}</div>}
                {f.phone && settings.phone && <div>Ph: {settings.phone}</div>}</div>
            </div>
          </td>
          <td style={{ ...td, fontSize: '0.95em' }}>
            <div style={{ fontWeight: 900, textAlign: 'center', borderBottom: b, marginBottom: 3 }}>{sale.kind === 'return' ? 'RETURN NOTE' : design.title}</div>
            <div>No: <b>{sale.invoiceNumber}</b></div>
            <div>Date: {fmtDate(sale.createdAt)} {fmtTime(sale.createdAt)}</div>
            {f.cashier && <div>Cashier: {cashierName || sale.cashierName || '-'}</div>}
          </td>
        </tr>
        {f.customer && <tr><td colSpan={2} style={td}>Customer: <b>{sale.customerName || 'Walk-in'}</b>{sale.customerPhone ? ` · ${sale.customerPhone}` : ''}{sale.returnOfInvoice ? ` · Against ${sale.returnOfInvoice}` : ''}</td></tr>}
        </tbody>
      </table>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{head.map(h => <th key={h} style={{ ...th, textAlign: h === 'Description' ? 'left' : 'center' }}>{h}</th>)}</tr></thead>
        <tbody>
          {sale.items.map((it, i) => {
            const lineTax = showTaxCol ? round2(it.lineTotal - it.lineTotal / (1 + design.taxRate / 100)) : 0;
            return (
              <tr key={i}>
                <td style={{ ...td, textAlign: 'center' }}>{i + 1}</td>
                <td style={td}>{itemName(it)}</td>
                {f.sku && <td style={{ ...td, fontFamily: 'monospace' }}>{it.product.sku}</td>}
                {f.unit && <td style={{ ...td, textAlign: 'center' }}>{itemUnit(it)}</td>}
                <td style={{ ...td, textAlign: 'center' }}>{n(it.quantity)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{n(it.unitPrice)}</td>
                {f.discount && <td style={{ ...td, textAlign: 'right' }}>{it.discount ? n(it.discount) : '-'}</td>}
                {showTaxCol && <td style={{ ...td, textAlign: 'right' }}>{n(lineTax)}</td>}
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{n(it.lineTotal)}</td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={head.length - 1} style={{ ...td, textAlign: 'right', fontWeight: 800 }}>Items: {sale.items.length} · Qty: {n(sale.items.reduce((a, x) => a + x.quantity, 0))} · Subtotal</td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>{n(sale.subtotal)}</td>
          </tr>
        </tbody>
      </table>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
        <tbody><tr>
          <td style={{ ...td, width: '55%' }}>
            <b>Amount in words:</b><br />{settings.currency} {amountInWords(sale.total)}
            {f.paid && c.pays.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
                <thead><tr><th style={th}>Payment</th><th style={th}>Amount</th></tr></thead>
                <tbody>{c.pays.map((p, i) => <tr key={i}><td style={td}>{p.method}{p.reference ? ` (${p.reference})` : ''}</td><td style={{ ...td, textAlign: 'right' }}>{n(Math.abs(p.amount))}</td></tr>)}</tbody>
              </table>
            )}
          </td>
          <td style={td}>
            <Row l="Subtotal" r={n(sale.subtotal)} />
            {f.discount && <Row l="Discount" r={n(Math.abs(sale.discountAmount))} />}
            {f.tax && c.tax > 0 && <Row l={`${design.taxLabel} (incl.)`} r={n(c.tax)} />}
            <Row l={<b>Grand Total</b>} r={<b>{settings.currency} {n(sale.total)}</b>} style={{ borderTop: b, borderBottom: b, margin: '3px 0', padding: '2px 0', fontSize: '1.1em' }} />
            {f.paid && <Row l="Paid" r={n(Math.abs(c.paid))} />}
            {f.paid && c.change > 0 && <Row l="Change" r={n(c.change)} />}
            {f.balance && <Row l={<b>Balance</b>} r={<b>{n(c.balance)}</b>} />}
          </td>
        </tr></tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}><Footer {...props} center={false} /></div>
        <Qr {...props} size={60} />
      </div>
    </div>
  );
}

// ---------- 5. Compact Thermal ----------
export function CompactThermal(props: InvoiceProps) {
  const { sale, settings, design, cashierName } = props;
  const f = design.fields;
  const cur = settings.currency;
  const c = calc(sale, design);
  const line = <div style={{ borderTop: '1px dashed #000', margin: '3px 0' }} />;
  return (
    <div style={{ ...base(settings, design, true), padding: 4, fontSize: (design.paperSize === '58mm' ? 9.5 : 10.5) * design.fontScale, lineHeight: 1.3 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 900, fontSize: '1.25em' }}>{settings.storeName.toUpperCase()}</div>
        {f.phone && settings.phone && <div>{settings.phone}</div>}
      </div>
      {line}
      <div>{sale.kind === 'return' ? 'RET' : 'INV'} {sale.invoiceNumber} {fmtDate(sale.createdAt)} {fmtTime(sale.createdAt)}</div>
      {f.customer && sale.customerName && <div>CUST {sale.customerName}</div>}
      {f.cashier && <div>BY {cashierName || sale.cashierName || '-'}</div>}
      {line}
      {sale.items.map((it, i) => (
        <div key={i} style={{ marginBottom: 2 }}>
          <div style={{ fontWeight: 700 }}>{itemName(it)}</div>
          <Row l={`  ${n(it.quantity)}${itemUnit(it)} x ${n(it.unitPrice)}${it.discount ? ` -${n(it.discount)}` : ''}`} r={n(it.lineTotal)} />
        </div>
      ))}
      {line}
      {sale.discountAmount !== 0 && f.discount && <Row l="DISC" r={n(Math.abs(sale.discountAmount))} />}
      <Row l={<b>TOTAL {cur}</b>} r={<b>{n(sale.total)}</b>} style={{ fontSize: '1.25em' }} />
      {f.paid && c.pays.map((p, i) => <Row key={i} l={p.method.toUpperCase()} r={n(Math.abs(p.amount))} />)}
      {f.paid && c.change > 0 && <Row l="CHANGE" r={n(c.change)} />}
      {f.balance && c.balance > 0 && <Row l={<b>UDHAR</b>} r={<b>{n(c.balance)}</b>} />}
      {line}
      <div style={{ textAlign: 'center' }}>{f.footer && settings.footerMessage}</div>
      {design.fields.qr && settings.enableInvoiceQr && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}><QRCodeSVG value={sale.invoiceNumber} size={44} /></div>}
    </div>
  );
}

// ---------- 6. Professional A4 ----------
export function ProfessionalA4(props: InvoiceProps) {
  const { sale, settings, design, cashierName } = props;
  const f = design.fields;
  const A = design.accentColor;
  const cols = columns(design, design.paperSize.endsWith('mm'));
  const small = design.paperSize.endsWith('mm');
  const label: CSSProperties = { fontSize: '0.72em', textTransform: 'uppercase', letterSpacing: 1.2, color: A, fontWeight: 800, marginBottom: 2 };
  return (
    <div style={{ ...base(settings, design), padding: small ? 10 : 40, minHeight: small ? undefined : 1060, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingBottom: 12, borderBottom: `3px double ${A}` }}>
        <Logo settings={settings} design={design} max={small ? 40 : 70} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.6em', fontWeight: 900, color: A }}>{settings.storeName}</div>
          {f.address && settings.address && <div>{settings.address}</div>}
          {f.phone && settings.phone && <div>Tel: {settings.phone}</div>}
        </div>
      </div>
      <div style={{ textAlign: 'center', margin: '12px 0', fontSize: '1.2em', fontWeight: 800, letterSpacing: 3 }}>{sale.kind === 'return' ? 'CREDIT NOTE / RETURN' : design.title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: small ? '1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div><div style={label}>From</div><div style={{ fontWeight: 700 }}>{settings.storeName}</div>{settings.phone && <div>{settings.phone}</div>}</div>
        {f.customer && <div><div style={label}>Bill To</div><div style={{ fontWeight: 700 }}>{sale.customerName || 'Walk-in Customer'}</div>{sale.customerPhone && <div>{sale.customerPhone}</div>}</div>}
        <div><div style={label}>Invoice Details</div>
          <div>No: <b>{sale.invoiceNumber}</b></div>
          <div>Date: {fmtDate(sale.createdAt)}</div>
          <div>Time: {fmtTime(sale.createdAt)}</div>
          {f.cashier && <div>Cashier: {cashierName || sale.cashierName || '-'}</div>}
          {sale.returnOfInvoice && <div>Against: {sale.returnOfInvoice}</div>}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead><tr>
          <th style={{ width: '6%', borderBottom: `2px solid ${A}`, textAlign: 'center', padding: 6, color: A }}>#</th>
          {cols.map(c => <th key={c.key} style={{ width: c.pct, borderBottom: `2px solid ${A}`, textAlign: c.align, padding: 6, color: A }}>{c.label}</th>)}
        </tr></thead>
        <tbody>{sale.items.map((it, i) => (
          <tr key={i} style={{ background: i % 2 ? '#fafafa' : '#fff', borderBottom: '1px solid #e5e5e5' }}>
            <td style={{ textAlign: 'center', padding: 6 }}>{i + 1}</td>
            {cols.map(c => <td key={c.key} style={{ textAlign: c.align, padding: 6, verticalAlign: 'top', wordBreak: 'break-word' }}>{cell(it, c.key, design)}</td>)}
          </tr>
        ))}</tbody>
      </table>
      <div style={{ display: 'flex', gap: 16, marginTop: 14, flexDirection: small ? 'column' : 'row' }}>
        <div style={{ flex: 1, fontSize: '0.9em' }}>
          <div style={label}>Amount in words</div>
          <div style={{ marginBottom: 10 }}>{settings.currency} {amountInWords(sale.total)}</div>
          {f.terms && design.terms && (<><div style={label}>Terms & Conditions</div><div style={{ color: '#444' }}>{design.terms}</div></>)}
          {f.notes && sale.notes && (<><div style={{ ...label, marginTop: 8 }}>Notes</div><div>{sale.notes}</div></>)}
        </div>
        <div style={{ width: small ? '100%' : 260 }}>
          <Totals {...props} big={17} accent={A} />
          <div style={{ marginTop: 10 }}><Qr {...props} size={72} /></div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      {!small && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 50 }}>
          {['Prepared by', 'Received by', 'Authorised Signatory'].map(s => <div key={s} style={{ borderTop: '1px solid #000', width: 170, textAlign: 'center', paddingTop: 4, fontSize: '0.85em' }}>{s}</div>)}
        </div>
      )}
      <div style={{ marginTop: 16, borderTop: `1px solid ${A}`, paddingTop: 6, textAlign: 'center', fontSize: '0.8em', color: '#555' }}>
        {f.footer && settings.footerMessage}{f.footer && settings.footerNote ? ` · ${settings.footerNote}` : ''}
      </div>
    </div>
  );
}

export const TEMPLATES: Record<InvoiceTemplateId, (p: InvoiceProps) => JSX.Element> = {
  'classic-retail': ClassicRetail,
  'modern-minimal': ModernMinimal,
  'premium-business': PremiumBusiness,
  'detailed-table': DetailedTable,
  'compact-thermal': CompactThermal,
  'professional-a4': ProfessionalA4,
};

export const isNewTemplate = (t: string): t is InvoiceTemplateId => t in TEMPLATES;

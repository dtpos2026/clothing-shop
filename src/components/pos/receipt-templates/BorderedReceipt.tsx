import { useStore } from '@/store/useStore';
import type { Sale } from '@/types';
import { QRCodeSVG } from 'qrcode.react';
import { format, parseISO } from 'date-fns';

export function BorderedReceipt({ sale }: { sale: Sale }) {
  const settings = useStore((s) => s.settings);
  const currentUser = useStore((s) => s.currentUser);

  const qrData = JSON.stringify({
    inv: sale.invoiceNumber, date: sale.createdAt, total: sale.total,
    customer: sale.customerName || 'Walk-in',
  });

  const s: React.CSSProperties = {
    fontFamily: `'${settings.receiptFont}', Arial, sans-serif`,
    fontSize: '12px', fontWeight: 700, width: '302px',
    lineHeight: 1.7, letterSpacing: '0.3px',
    color: '#000', background: '#fff', padding: '10px 8px',
    border: '2px solid #000',
  };

  const cellStyle = (align = 'left'): React.CSSProperties => ({
    border: '1px solid #000', padding: '4px 5px', textAlign: align as any, lineHeight: 1.6,
  });

  return (
    <div className="print-receipt" style={s}>
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" style={{ width: settings.logoWidth, height: settings.logoHeight, margin: '0 auto 6px' }} />
        )}
        <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '1px' }}>{settings.storeName}</div>
        {settings.address && <div style={{ fontSize: '10px', marginTop: '3px' }}>{settings.address}</div>}
        {settings.phone && <div style={{ fontSize: '10px' }}>Ph: {settings.phone}</div>}
      </div>

      {/* Info Box */}
      <div style={{ border: '1px solid #000', padding: '6px 8px', marginBottom: '8px', fontSize: '11px', lineHeight: 1.8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Invoice:</strong> {sale.invoiceNumber}</span>
          <span><strong>Date:</strong> {format(parseISO(sale.createdAt), 'dd/MM/yyyy')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Cashier:</strong> {currentUser.name}</span>
          <span><strong>Time:</strong> {format(parseISO(sale.createdAt), 'hh:mm a')}</span>
        </div>
        {sale.customerName && <div><strong>Customer:</strong> {sale.customerName} {sale.customerPhone ? `| ${sale.customerPhone}` : ''}</div>}
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '8px' }}>
        <thead>
          <tr style={{ background: '#000', color: '#fff' }}>
            <th style={{ ...cellStyle(), border: '1px solid #000', fontWeight: 900 }}>Item</th>
            <th style={{ ...cellStyle('center'), border: '1px solid #000', fontWeight: 900 }}>Qty</th>
            <th style={{ ...cellStyle('right'), border: '1px solid #000', fontWeight: 900 }}>Price</th>
            <th style={{ ...cellStyle('right'), border: '1px solid #000', fontWeight: 900 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, i) => (
            <tr key={i}>
              <td style={cellStyle()}>{item.product.brand} {item.product.article}{item.color ? ` (${item.color})` : ''}</td>
              <td style={cellStyle('center')}>{item.quantity}</td>
              <td style={cellStyle('right')}>{item.unitPrice.toLocaleString()}</td>
              <td style={cellStyle('right')}>{item.lineTotal.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Box */}
      <div style={{ border: '2px solid #000', padding: '6px 8px', fontSize: '12px', lineHeight: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{settings.currency} {sale.subtotal.toLocaleString()}</span></div>
        {sale.discountAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>-{settings.currency} {sale.discountAmount.toLocaleString()}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '16px', borderTop: '2px solid #000', paddingTop: '4px', marginTop: '2px' }}>
          <span>TOTAL</span><span>{settings.currency} {sale.total.toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}><span>Payment: {sale.paymentMethod}</span><span>Paid: {settings.currency} {sale.amountPaid.toLocaleString()}</span></div>
        {sale.saleType === 'cash' && sale.amountPaid > sale.total && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '11px' }}><span>Change</span><span>{settings.currency} {(sale.amountPaid - sale.total).toLocaleString()}</span></div>
        )}
        {(sale.saleType === 'credit' || sale.saleType === 'partial') && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}><span>Udhar</span><span>{settings.currency} {sale.creditAmount.toLocaleString()}</span></div>
        )}
      </div>

      {/* QR */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '10px' }}>
        {settings.enableInvoiceQr && <div style={{ textAlign: 'center' }}><QRCodeSVG value={qrData} size={56} /><div style={{ fontSize: '9px', marginTop: '2px' }}>Invoice</div></div>}
        {settings.enableCustomQr && settings.customQrUrl && <div style={{ textAlign: 'center' }}><img src={settings.customQrUrl} alt="QR" style={{ width: '56px', height: '56px', margin: '0 auto' }} /><div style={{ fontSize: '9px', marginTop: '2px' }}>Pay</div></div>}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '10px', paddingTop: '6px', borderTop: '2px solid #000', lineHeight: 1.7 }}>
        <div style={{ fontSize: '11px', fontWeight: 800 }}>{settings.footerMessage}</div>
        {settings.footerNote && <div style={{ fontSize: '10px', marginTop: '2px' }}>{settings.footerNote}</div>}
      </div>
    </div>
  );
}

import { useStore } from '@/store/useStore';
import type { Sale } from '@/types';
import { QRCodeSVG } from 'qrcode.react';
import { format, parseISO } from 'date-fns';

export function CompactReceipt({ sale }: { sale: Sale }) {
  const settings = useStore((s) => s.settings);
  const currentUser = useStore((s) => s.currentUser);

  const qrData = JSON.stringify({
    inv: sale.invoiceNumber, date: sale.createdAt, total: sale.total,
    customer: sale.customerName || 'Walk-in',
  });

  const s: React.CSSProperties = {
    fontFamily: `'${settings.receiptFont}', Arial, sans-serif`,
    fontSize: '11px', fontWeight: 700, width: '302px',
    lineHeight: 1.6, letterSpacing: '0.2px',
    color: '#000', background: '#fff', padding: '8px 6px',
  };

  return (
    <div className="print-receipt" style={s}>
      {/* Header — Compact */}
      <div style={{ textAlign: 'center', paddingBottom: '6px', marginBottom: '6px', borderBottom: '1px solid #000' }}>
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" style={{ width: Math.min(settings.logoWidth, 80), height: 'auto', margin: '0 auto 4px' }} />
        )}
        <div style={{ fontSize: '15px', fontWeight: 900 }}>{settings.storeName}</div>
        {settings.phone && <span style={{ fontSize: '10px' }}>{settings.phone}</span>}
        {settings.phone && settings.address && <span style={{ fontSize: '10px' }}> | </span>}
        {settings.address && <span style={{ fontSize: '10px' }}>{settings.address}</span>}
      </div>

      {/* Info — Single line style */}
      <div style={{ fontSize: '10px', marginBottom: '6px', lineHeight: 1.7 }}>
        <div>{sale.invoiceNumber} | {format(parseISO(sale.createdAt), 'dd/MM/yy hh:mm a')} | {currentUser.name}</div>
        {sale.customerName && <div>Customer: {sale.customerName}{sale.customerPhone ? ` (${sale.customerPhone})` : ''}</div>}
      </div>

      {/* Items — Dense table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '6px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #000', padding: '2px 0', fontWeight: 900 }}>Item</th>
            <th style={{ textAlign: 'center', borderBottom: '1px solid #000', padding: '2px 0', fontWeight: 900, width: '28px' }}>Q</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #000', padding: '2px 0', fontWeight: 900 }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, i) => (
            <tr key={i}>
              <td style={{ padding: '3px 0', lineHeight: 1.6 }}>{item.product.brand} {item.product.article}{item.color ? ` (${item.color})` : ''}</td>
              <td style={{ textAlign: 'center', padding: '3px 0' }}>{item.quantity}</td>
              <td style={{ textAlign: 'right', padding: '3px 0' }}>{item.lineTotal.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals — Tight */}
      <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '11px', lineHeight: 1.8 }}>
        {sale.discountAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Disc</span><span>-{sale.discountAmount.toLocaleString()}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '15px', borderTop: '2px solid #000', paddingTop: '3px', marginTop: '2px' }}>
          <span>TOTAL</span><span>{settings.currency} {sale.total.toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}><span>{sale.paymentMethod} | Paid: {settings.currency} {sale.amountPaid.toLocaleString()}</span></div>
        {sale.saleType === 'cash' && sale.amountPaid > sale.total && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800 }}><span>Change</span><span>{settings.currency} {(sale.amountPaid - sale.total).toLocaleString()}</span></div>
        )}
        {(sale.saleType === 'credit' || sale.saleType === 'partial') && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '12px' }}><span>Udhar</span><span>{settings.currency} {sale.creditAmount.toLocaleString()}</span></div>
        )}
      </div>

      {/* QR — Small */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '8px' }}>
        {settings.enableInvoiceQr && <QRCodeSVG value={qrData} size={48} />}
        {settings.enableCustomQr && settings.customQrUrl && <img src={settings.customQrUrl} alt="QR" style={{ width: '48px', height: '48px' }} />}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '8px', paddingTop: '4px', borderTop: '1px solid #000', fontSize: '10px', lineHeight: 1.6 }}>
        <div style={{ fontWeight: 800 }}>{settings.footerMessage}</div>
      </div>
    </div>
  );
}

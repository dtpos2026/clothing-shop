import { useStore } from '@/store/useStore';
import type { Sale } from '@/types';
import { QRCodeSVG } from 'qrcode.react';
import { format, parseISO } from 'date-fns';

export function ModernReceipt({ sale }: { sale: Sale }) {
  const settings = useStore((s) => s.settings);
  const currentUser = useStore((s) => s.currentUser);

  const qrData = JSON.stringify({
    inv: sale.invoiceNumber, date: sale.createdAt, total: sale.total,
    customer: sale.customerName || 'Walk-in',
  });

  const s: React.CSSProperties = {
    fontFamily: `'${settings.receiptFont}', Arial, sans-serif`,
    fontSize: '12px', fontWeight: 700, width: '302px',
    lineHeight: 1.8, letterSpacing: '0.4px',
    color: '#000', background: '#fff', padding: '14px 12px',
  };

  return (
    <div className="print-receipt" style={s}>
      {/* Header — Modern centered */}
      <div style={{ textAlign: 'center', marginBottom: '14px' }}>
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" style={{ width: settings.logoWidth, height: settings.logoHeight, margin: '0 auto 10px' }} />
        )}
        <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' }}>{settings.storeName}</div>
        <div style={{ width: '60%', height: '2px', background: '#000', margin: '8px auto' }}></div>
        {settings.address && <div style={{ fontSize: '10px' }}>{settings.address}</div>}
        {settings.phone && <div style={{ fontSize: '10px' }}>{settings.phone}</div>}
      </div>

      {/* Info — Spacious */}
      <div style={{ fontSize: '11px', marginBottom: '14px', lineHeight: 2, padding: '8px 0', borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invoice</span><span style={{ fontWeight: 900 }}>{sale.invoiceNumber}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Date</span><span>{format(parseISO(sale.createdAt), 'dd MMM yyyy')}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Time</span><span>{format(parseISO(sale.createdAt), 'hh:mm a')}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cashier</span><span>{currentUser.name}</span></div>
        {sale.customerName && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Customer</span><span>{sale.customerName}</span></div>}
      </div>

      {/* Items — Clean list */}
      {sale.items.map((item, i) => (
        <div key={i} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dotted #ccc' }}>
          <div style={{ fontWeight: 800, fontSize: '12px' }}>{item.product.brand} {item.product.article}{item.color ? ` — ${item.color}` : ''}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px', color: '#333' }}>
            <span>{item.quantity} × {item.unitPrice.toLocaleString()}</span>
            <span style={{ fontWeight: 800 }}>{settings.currency} {item.lineTotal.toLocaleString()}</span>
          </div>
        </div>
      ))}

      {/* Totals — Prominent */}
      <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '2px solid #000', lineHeight: 2.2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Subtotal</span><span>{settings.currency} {sale.subtotal.toLocaleString()}</span></div>
        {sale.discountAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Discount</span><span>-{settings.currency} {sale.discountAmount.toLocaleString()}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '18px', marginTop: '6px', padding: '6px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
          <span>TOTAL</span><span>{settings.currency} {sale.total.toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}><span>Paid ({sale.paymentMethod})</span><span>{settings.currency} {sale.amountPaid.toLocaleString()}</span></div>
        {sale.saleType === 'cash' && sale.amountPaid > sale.total && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '11px' }}><span>Change</span><span>{settings.currency} {(sale.amountPaid - sale.total).toLocaleString()}</span></div>
        )}
        {(sale.saleType === 'credit' || sale.saleType === 'partial') && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '13px', color: '#c00' }}><span>Udhar Balance</span><span>{settings.currency} {sale.creditAmount.toLocaleString()}</span></div>
        )}
      </div>

      {/* QR */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '14px' }}>
        {settings.enableInvoiceQr && <div style={{ textAlign: 'center' }}><QRCodeSVG value={qrData} size={64} /><div style={{ fontSize: '8px', marginTop: '4px', letterSpacing: '1px', textTransform: 'uppercase' }}>Invoice</div></div>}
        {settings.enableCustomQr && settings.customQrUrl && <div style={{ textAlign: 'center' }}><img src={settings.customQrUrl} alt="QR" style={{ width: '64px', height: '64px', margin: '0 auto' }} /><div style={{ fontSize: '8px', marginTop: '4px', letterSpacing: '1px', textTransform: 'uppercase' }}>Payment</div></div>}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '16px', lineHeight: 1.8 }}>
        <div style={{ width: '40%', height: '1px', background: '#000', margin: '0 auto 8px' }}></div>
        <div style={{ fontSize: '12px', fontWeight: 800 }}>{settings.footerMessage}</div>
        {settings.footerNote && <div style={{ fontSize: '10px', marginTop: '4px', color: '#555' }}>{settings.footerNote}</div>}
      </div>
    </div>
  );
}

import { useStore } from '@/store/useStore';
import type { Sale } from '@/types';
import { QRCodeSVG } from 'qrcode.react';
import { format, parseISO } from 'date-fns';

export function ClassicReceipt({ sale }: { sale: Sale }) {
  const settings = useStore((s) => s.settings);
  const currentUser = useStore((s) => s.currentUser);

  const qrData = JSON.stringify({
    inv: sale.invoiceNumber, date: sale.createdAt, total: sale.total,
    customer: sale.customerName || 'Walk-in',
  });

  const s: React.CSSProperties = {
    fontFamily: `'${settings.receiptFont}', Arial, sans-serif`,
    fontSize: '13px', fontWeight: 700, width: '302px',
    lineHeight: 1.7, letterSpacing: '0.3px',
    color: '#000', background: '#fff', padding: '12px 10px',
  };

  return (
    <div className="print-receipt" style={s}>
      {/* Header */}
      <div style={{ textAlign: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px dashed #000' }}>
        {settings.logoUrl && (
          <img src={settings.logoUrl} alt="Logo" style={{ width: settings.logoWidth, height: settings.logoHeight, margin: '0 auto 8px' }} />
        )}
        <div style={{ fontSize: '18px', fontWeight: 900 }}>{settings.storeName}</div>
        {settings.address && <div style={{ fontSize: '11px', marginTop: '4px' }}>{settings.address}</div>}
        {settings.phone && <div style={{ fontSize: '11px' }}>Ph: {settings.phone}</div>}
      </div>

      {/* Info */}
      <div style={{ fontSize: '11px', marginBottom: '10px', lineHeight: 1.8 }}>
        <div>Invoice: {sale.invoiceNumber}</div>
        <div>Date: {format(parseISO(sale.createdAt), 'dd/MM/yyyy')} | {format(parseISO(sale.createdAt), 'hh:mm a')}</div>
        <div>Cashier: {currentUser.name}</div>
        {sale.customerName && <div>Customer: {sale.customerName}</div>}
        {sale.customerPhone && <div>Phone: {sale.customerPhone}</div>}
      </div>

      {/* Items */}
      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0', marginBottom: '8px' }}>
        <div style={{ display: 'flex', fontSize: '11px', fontWeight: 900, marginBottom: '4px' }}>
          <span style={{ flex: 2 }}>Item</span>
          <span style={{ flex: 0.5, textAlign: 'center' }}>Qty</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Price</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Total</span>
        </div>
        {sale.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', fontSize: '11px', lineHeight: 1.8, borderBottom: i < sale.items.length - 1 ? '1px dotted #ccc' : 'none', padding: '3px 0' }}>
            <span style={{ flex: 2 }}>{item.product.brand} {item.product.article}{item.color ? ` (${item.color})` : ''}</span>
            <span style={{ flex: 0.5, textAlign: 'center' }}>{item.quantity}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>{item.unitPrice.toLocaleString()}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>{item.lineTotal.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div style={{ fontSize: '12px', lineHeight: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{settings.currency} {sale.subtotal.toLocaleString()}</span></div>
        {sale.discountAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>-{settings.currency} {sale.discountAmount.toLocaleString()}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '16px', borderTop: '2px solid #000', paddingTop: '4px', marginTop: '4px' }}>
          <span>TOTAL</span><span>{settings.currency} {sale.total.toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}><span>Payment</span><span style={{ fontWeight: 800 }}>{sale.paymentMethod}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Paid</span><span style={{ fontWeight: 800 }}>{settings.currency} {sale.amountPaid.toLocaleString()}</span></div>
        {sale.saleType === 'cash' && sale.amountPaid > sale.total && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}><span>Change</span><span>{settings.currency} {(sale.amountPaid - sale.total).toLocaleString()}</span></div>
        )}
        {(sale.saleType === 'credit' || sale.saleType === 'partial') && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}><span>Udhar</span><span>{settings.currency} {sale.creditAmount.toLocaleString()}</span></div>
        )}
      </div>

      {/* QR */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px' }}>
        {settings.enableInvoiceQr && <div style={{ textAlign: 'center' }}><QRCodeSVG value={qrData} size={60} /><div style={{ fontSize: '9px', marginTop: '3px' }}>Invoice QR</div></div>}
        {settings.enableCustomQr && settings.customQrUrl && <div style={{ textAlign: 'center' }}><img src={settings.customQrUrl} alt="QR" style={{ width: '60px', height: '60px', margin: '0 auto' }} /><div style={{ fontSize: '9px', marginTop: '3px' }}>Payment QR</div></div>}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed #000', lineHeight: 1.7 }}>
        <div style={{ fontSize: '11px', fontWeight: 800 }}>{settings.footerMessage}</div>
        {settings.footerNote && <div style={{ fontSize: '10px', marginTop: '3px' }}>{settings.footerNote}</div>}
      </div>
    </div>
  );
}

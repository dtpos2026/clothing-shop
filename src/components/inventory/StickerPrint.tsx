import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer } from 'lucide-react';
import type { Product, StoreSettings } from '@/types';

interface Props {
  product: Product;
  settings: StoreSettings;
  open: boolean;
  onClose: () => void;
}

export function StickerPrint({ product, settings, open, onClose }: Props) {
  const stickerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<'80mm' | '58mm'>('80mm');

  const widthMM = size === '80mm' ? 72 : 50; // usable print area
  const fontSize = size === '80mm'
    ? { name: 11, detail: 8, sku: 9, price: 14, qr: 60, store: 12 }
    : { name: 9, detail: 7, sku: 8, price: 11, qr: 44, store: 10 };

  const handlePrint = () => {
    if (!stickerRef.current) return;
    const content = stickerRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=400,height=300');
    if (!win) return;
    win.document.write(`
      <html><head><title>Sticker</title>
      <style>
        @page { size: ${size} auto; margin: 2mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: ${widthMM}mm; font-family: Arial, sans-serif; background: #fff; color: #000; }
        .sticker { border: 1px solid #000; border-radius: 4px; padding: 3mm; text-align: center; width: 100%; }
        .sticker .store-name { font-size: ${fontSize.store}px; font-weight: bold; margin: 0; }
        .sticker .store-phone { font-size: ${fontSize.detail}px; margin: 1px 0; }
        .sticker hr { border: none; border-top: 0.5px solid #000; margin: 2mm 0; }
        .sticker .brand { font-size: ${fontSize.detail}px; font-weight: 600; }
        .sticker .article { font-size: ${fontSize.detail}px; }
        .sticker .sku { font-family: monospace; font-size: ${fontSize.sku}px; letter-spacing: 1px; }
        .sticker .qr-wrap { display: flex; justify-content: center; margin: 2mm 0; }
        .sticker .meta { font-size: ${fontSize.detail}px; }
        .sticker .price { font-size: ${fontSize.price}px; font-weight: bold; margin-top: 2mm; }
        .sticker img.logo { max-height: ${size === '80mm' ? '12mm' : '8mm'}; max-width: ${size === '80mm' ? '30mm' : '20mm'}; object-fit: contain; margin: 0 auto 1mm; display: block; }
        @media print { body { margin: 0; padding: 0; } }
      </style></head>
      <body>${content}</body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const qrData = JSON.stringify({
    sku: product.sku,
    brand: product.brand,
    article: product.article,
    price: product.salePrice,
    category: product.category,
    fabric: product.fabricCategory,
  });

  const previewWidth = size === '80mm' ? 280 : 200;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Product Sticker / QR Label</DialogTitle></DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-muted-foreground">Paper Size:</span>
          <Select value={size} onValueChange={v => setSize(v as '80mm' | '58mm')}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="80mm">80mm</SelectItem>
              <SelectItem value="58mm">58mm</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Preview */}
        <div className="flex justify-center">
          <div ref={stickerRef}>
            <div className="sticker" style={{ width: previewWidth, background: '#fff', color: '#000', border: '1.5px solid #000', borderRadius: 6, padding: 10, textAlign: 'center' }}>
              {settings.logoUrl && settings.logoUrl.startsWith('data:') && (
                <img src={settings.logoUrl} alt="" className="logo" style={{ maxHeight: size === '80mm' ? 42 : 30, maxWidth: size === '80mm' ? 110 : 76, objectFit: 'contain', margin: '0 auto 4px', display: 'block' }} />
              )}
              <p className="store-name" style={{ fontSize: fontSize.store, fontWeight: 'bold', margin: 0 }}>{settings.storeName}</p>
              <p className="store-phone" style={{ fontSize: fontSize.detail, margin: '1px 0' }}>{settings.phone}</p>
              <hr style={{ border: 'none', borderTop: '0.5px solid #000', margin: '4px 0' }} />
              <p className="brand" style={{ fontSize: fontSize.detail, fontWeight: 600 }}>{product.brand}</p>
              <p className="article" style={{ fontSize: fontSize.detail }}>{product.article}</p>
              <p className="sku" style={{ fontSize: fontSize.sku, fontFamily: 'monospace', letterSpacing: 1, marginTop: 2 }}>{product.sku}</p>

              <div className="qr-wrap" style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                <QRCodeSVG value={qrData} size={fontSize.qr} />
              </div>

              <p className="meta" style={{ fontSize: fontSize.detail }}>{product.category} · {product.fabricCategory}</p>
              {product.color && <p className="meta" style={{ fontSize: fontSize.detail }}>Color: {product.color}</p>}
              <p className="price" style={{ fontSize: fontSize.price, fontWeight: 'bold', marginTop: 4 }}>{settings.currency} {product.salePrice.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handlePrint}><Printer className="w-4 h-4 mr-2" /> Print Sticker</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

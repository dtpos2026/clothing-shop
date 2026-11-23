import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CameraScannerDialog } from './CameraScannerDialog';
import { scanNative } from '@/platform/scanner';
import { useKeyboardWedge } from '@/hooks/useKeyboardWedge';
import { findProductByCode } from '@/core/barcode';
import { useStore } from '@/store/useStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types';
import { isColorProduct, unitLabel, baseUnit } from '@/core/inventory';

type Handler = (code: string) => void;

interface ScanCtx {
  /** Scan once with the best available scanner and get the raw code. */
  scan: (onCode: Handler) => void;
  /** Pages (e.g. POS) can take over hardware-scanner input while mounted. */
  setPageHandler: (h: Handler | null) => void;
  lookup: (code: string) => void;
}

const Ctx = createContext<ScanCtx | null>(null);
export const useScanner = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useScanner outside ScanProvider');
  return c;
};

export function ScanProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [cameraOpen, setCameraOpen] = useState(false);
  const pending = useRef<Handler | null>(null);
  const pageHandler = useRef<Handler | null>(null);
  const [found, setFound] = useState<Product | null>(null);

  const lookup = useCallback((code: string) => {
    const products = useStore.getState().products;
    const p = findProductByCode(products, code);
    if (!p) { toast.error(`No product found for code “${code}”`); return; }
    setFound(p);
  }, []);

  const scan = useCallback(async (onCode: Handler) => {
    const r = await scanNative();
    if ('code' in r) { onCode(r.code); return; }
    if ('cancelled' in r) return;
    pending.current = onCode;
    setCameraOpen(true);
  }, []);

  // Hardware scanners: page handler first (POS adds to cart), otherwise global lookup
  useKeyboardWedge(code => (pageHandler.current ? pageHandler.current(code) : lookup(code)));

  const setPageHandler = useCallback((h: Handler | null) => { pageHandler.current = h; }, []);

  const addToCart = (p: Product) => {
    if (isColorProduct(p) && p.colorStocks.length > 0) {
      navigate(`/pos?add=${encodeURIComponent(p.id)}`);
    } else {
      useStore.getState().addToCart(p);
      toast.success(`${p.brand} ${p.article} added to cart`);
      navigate('/pos');
    }
    setFound(null);
  };

  const cur = useStore(s => s.settings.currency);

  return (
    <Ctx.Provider value={{ scan, setPageHandler, lookup }}>
      {children}
      <CameraScannerDialog
        open={cameraOpen}
        onClose={() => { setCameraOpen(false); pending.current = null; }}
        onResult={(code) => { setCameraOpen(false); const h = pending.current; pending.current = null; h?.(code); }}
      />
      <Dialog open={!!found} onOpenChange={v => !v && setFound(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{found?.brand} — {found?.article}</DialogTitle></DialogHeader>
          {found && (
            <div className="space-y-3">
              {found.imageUrl && <img src={found.imageUrl} alt="" className="w-full max-h-48 object-contain rounded-lg bg-muted" />}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">SKU</div><div className="font-mono">{found.sku}</div>
                {found.barcode && <><div className="text-muted-foreground">Barcode</div><div className="font-mono">{found.barcode}</div></>}
                <div className="text-muted-foreground">Price</div><div className="font-bold">{cur} {found.salePrice.toLocaleString()}</div>
                <div className="text-muted-foreground">Stock</div><div>{found.stockQty} {unitLabel(baseUnit(found))}</div>
                {found.rolls && found.rolls.filter(r => r.status === 'active').length > 0 && (
                  <><div className="text-muted-foreground">Thaans</div><div>{found.rolls.filter(r => r.status === 'active').length} active</div></>
                )}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => addToCart(found)}>Add to cart</Button>
                <Button className="flex-1" variant="outline" onClick={() => { navigate(`/inventory?product=${found.id}`); setFound(null); }}>Open record</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

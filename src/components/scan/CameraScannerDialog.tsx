import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Keyboard } from 'lucide-react';

const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.QR_CODE, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
]);
hints.set(DecodeHintType.TRY_HARDER, true);

/**
 * In-app camera scanner (webcam on Windows, camera on Android when the Google scanner
 * isn't available). Camera permission is requested only when this dialog opens.
 */
export function CameraScannerDialog({ open, onClose, onResult, title = 'Scan barcode / QR code' }: {
  open: boolean; onClose: () => void; onResult: (code: string) => void; title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
    (async () => {
      try {
        const constraints: MediaStreamConstraints = { video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } } };
        const controls = await reader.decodeFromConstraints(constraints, videoRef.current!, (result) => {
          if (result && !cancelled) {
            cancelled = true;
            controls.stop();
            try { navigator.vibrate?.(60); } catch { /* optional */ }
            onResult(result.getText());
          }
        });
        controlsRef.current = controls;
        if (cancelled) controls.stop();
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!cancelled) setDevices(list);
      } catch (e) {
        const name = e instanceof Error ? e.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access for this app in system settings, or type the code below.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'No camera found. Connect a webcam, use a USB/Bluetooth scanner, or type the code below.'
              : `Camera could not start: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, deviceId, onResult]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera className="w-5 h-5" /> {title}</DialogTitle>
          <DialogDescription>Point the camera at a product barcode or QR label. USB and Bluetooth scanners work anywhere in the app.</DialogDescription>
        </DialogHeader>
        <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 border-white/80 rounded-lg pointer-events-none" />
          <div className="absolute inset-x-10 top-1/2 h-0.5 bg-red-500/80 animate-pulse pointer-events-none" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {devices.length > 1 && (
          <select className="w-full border border-input rounded-md h-9 px-2 bg-background text-sm" value={deviceId || ''} onChange={e => setDeviceId(e.target.value || undefined)}>
            <option value="">Default camera</option>
            {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 6)}`}</option>)}
          </select>
        )}
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (manual.trim()) { onResult(manual.trim()); setManual(''); } }}>
          <div className="relative flex-1">
            <Keyboard className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Or type code / SKU" value={manual} onChange={e => setManual(e.target.value)} />
          </div>
          <Button type="submit" variant="secondary">Find</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

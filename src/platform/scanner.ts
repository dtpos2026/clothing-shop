/**
 * Barcode / QR scanning.
 *  - Android: Google ML Kit code scanner (EAN-13/8, Code128, QR…). The Google scanner UI
 *    runs in Play services and needs no camera permission; if unavailable we fall back to
 *    the in-app camera scanner (which asks for camera permission at that moment only).
 *  - Windows / browser: in-app camera scanner (ZXing) – webcam.
 *  - USB & Bluetooth (HID) scanners on any platform: see useKeyboardWedge().
 */
import { Capacitor } from '@capacitor/core';

export type NativeScanResult = { code: string; format?: string } | { cancelled: true } | { unavailable: true };

export async function scanNative(): Promise<NativeScanResult> {
  if (!Capacitor.isNativePlatform()) return { unavailable: true };
  try {
    const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
    const { supported } = await BarcodeScanner.isSupported();
    if (!supported) return { unavailable: true };
    try {
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        return { unavailable: true }; // module downloads in background; use in-app scanner meanwhile
      }
    } catch { /* older play services – try scan anyway */ }
    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode, BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.Code128, BarcodeFormat.Code39, BarcodeFormat.UpcA, BarcodeFormat.UpcE],
    });
    const b = barcodes[0];
    return b?.rawValue ? { code: b.rawValue, format: String(b.format) } : { cancelled: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel/i.test(msg)) return { cancelled: true };
    return { unavailable: true };
  }
}

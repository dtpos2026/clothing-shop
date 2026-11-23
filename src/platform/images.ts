/**
 * Product photos & logos: camera (Android), gallery, or file picker → compressed JPEG data URL.
 * Camera permission is requested by the OS only when the user taps "Take photo".
 */
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { pickFile } from './files';

export async function compressImage(src: string, maxSize = 640, quality = 0.78, mime = 'image/jpeg'): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mime, quality);
}

const toDataUrl = (bytes: Uint8Array, type: string) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(new Blob([bytes as BlobPart], { type }));
  });

export async function captureImage(source: 'camera' | 'gallery', opts: { maxSize?: number; keepPng?: boolean } = {}): Promise<string | null> {
  const mime = opts.keepPng ? 'image/png' : 'image/jpeg';
  if (Capacitor.isNativePlatform()) {
    try {
      const photo = await Camera.getPhoto({
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        resultType: CameraResultType.DataUrl, quality: 80, width: 1200, correctOrientation: true,
      });
      return photo.dataUrl ? compressImage(photo.dataUrl, opts.maxSize, 0.78, mime) : null;
    } catch (e) {
      if (e instanceof Error && /cancel/i.test(e.message)) return null;
      throw e;
    }
  }
  const f = await pickFile('image/*');
  if (!f) return null;
  return compressImage(await toDataUrl(f.bytes, f.type || 'image/jpeg'), opts.maxSize, 0.78, mime);
}

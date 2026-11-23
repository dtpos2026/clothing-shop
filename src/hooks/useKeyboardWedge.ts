import { useEffect, useRef } from 'react';

/**
 * USB / Bluetooth HID barcode scanners type the code very fast and end with Enter.
 * This hook distinguishes them from a human typing (keys < `maxGapMs` apart) and
 * calls onScan(code). It works on Windows and Android (BT scanners in HID mode).
 *
 * When focus is inside a text input the scan is still captured if it arrived at
 * scanner speed; the typed characters are then removed from that input.
 */
export function useKeyboardWedge(onScan: (code: string) => void, opts: { enabled?: boolean; minLength?: number; maxGapMs?: number } = {}) {
  const { enabled = true, minLength = 4, maxGapMs = 35 } = opts;
  const buf = useRef<{ chars: string; last: number; first: number; target: EventTarget | null }>({ chars: '', last: 0, first: 0, target: null });
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const now = performance.now();
      const b = buf.current;
      if (now - b.last > maxGapMs * 3) { b.chars = ''; b.first = now; b.target = e.target; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const fast = b.chars.length >= minLength && (now - b.first) / Math.max(1, b.chars.length) < maxGapMs;
        if (fast) {
          e.preventDefault();
          e.stopPropagation();
          const code = b.chars;
          const t = b.target as HTMLInputElement | null;
          if (t && 'value' in t && typeof t.value === 'string' && t.value.endsWith(code)) {
            const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(t), 'value')?.set;
            setter?.call(t, t.value.slice(0, -code.length));
            t.dispatchEvent(new Event('input', { bubbles: true }));
          }
          cb.current(code);
        }
        b.chars = '';
        b.last = now;
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        b.chars += e.key;
        b.last = now;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [enabled, minLength, maxGapMs]);
}

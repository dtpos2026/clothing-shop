import html2canvas from 'html2canvas';

const PAPER_WIDTH_MM = 80;
const MM_TO_PX = 3.7795275591;
const TARGET_WIDTH_PX = Math.round(PAPER_WIDTH_MM * MM_TO_PX); // ~302px

/**
 * Direct thermal print: captures receipt as image, opens print dialog (no PDF download).
 */
export async function printReceiptElement(elementId: string): Promise<boolean> {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error('printReceiptElement: element not found:', elementId);
    return false;
  }

  try {
    const canvas = await captureReceipt(el);
    const imageData = canvas.toDataURL('image/png');

    // Build a minimal HTML page with the receipt image and trigger print
    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { margin: 0; padding: 0; }
          body { width: 80mm; background: #fff; }
          img { width: 80mm; height: auto; display: block; }
        </style>
      </head>
      <body>
        <img src="${imageData}" />
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
            window.onafterprint = function() { window.close(); };
          };
        <\/script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
    } else {
      // Fallback: use iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '0';
      iframe.style.width = '302px';
      iframe.style.height = '0';
      document.body.appendChild(iframe);
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.write(printHtml);
        iframeDoc.close();
      }
      setTimeout(() => document.body.removeChild(iframe), 10000);
    }

    return true;
  } catch (err) {
    console.error('printReceiptElement error:', err);
    return false;
  }
}

/**
 * Save receipt as PNG image (download).
 */
export async function saveReceiptAsPng(elementId: string, filename = 'receipt.png'): Promise<boolean> {
  const el = document.getElementById(elementId);
  if (!el) return false;

  try {
    const canvas = await captureReceipt(el);
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    return true;
  } catch (err) {
    console.error('saveReceiptAsPng error:', err);
    return false;
  }
}

/**
 * Shared capture logic: renders the element to a canvas with bold, high-contrast settings.
 */
async function captureReceipt(el: HTMLElement): Promise<HTMLCanvasElement> {
  // Force bold, dark text for thermal clarity
  const origStyles: { el: HTMLElement; color: string; fontWeight: string; bg: string }[] = [];
  const allElements = el.querySelectorAll('*') as NodeListOf<HTMLElement>;

  // Save and override styles
  allElements.forEach(child => {
    origStyles.push({
      el: child,
      color: child.style.color,
      fontWeight: child.style.fontWeight,
      bg: child.style.background,
    });
    child.style.color = '#000';
    child.style.background = '#fff';
    // Make text bolder for thermal print
    const computed = window.getComputedStyle(child);
    const currentWeight = parseInt(computed.fontWeight) || 400;
    if (currentWeight < 700) {
      child.style.fontWeight = '700'; // bold minimum for thermal
    }
  });

  // Also style the root element
  const origRoot = { color: el.style.color, fontWeight: el.style.fontWeight, bg: el.style.background };
  el.style.color = '#000';
  el.style.background = '#fff';
  el.style.fontWeight = '700';

  await new Promise(r => setTimeout(r, 100));

  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 4, // Higher scale for sharper thermal print
    useCORS: true,
    logging: false,
    width: TARGET_WIDTH_PX,
    windowWidth: TARGET_WIDTH_PX,
    scrollX: 0,
    scrollY: -window.scrollY,
  });

  // Restore original styles
  origStyles.forEach(({ el: child, color, fontWeight, bg }) => {
    child.style.color = color;
    child.style.fontWeight = fontWeight;
    child.style.background = bg;
  });
  el.style.color = origRoot.color;
  el.style.fontWeight = origRoot.fontWeight;
  el.style.background = origRoot.bg;

  return canvas;
}

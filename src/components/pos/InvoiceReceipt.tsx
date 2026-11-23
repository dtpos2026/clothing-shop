import { useStore } from '@/store/useStore';
import type { ReceiptTemplate, Sale, PaperSize } from '@/types';
import { ClassicReceipt } from './receipt-templates/ClassicReceipt';
import { BorderedReceipt } from './receipt-templates/BorderedReceipt';
import { ModernReceipt } from './receipt-templates/ModernReceipt';
import { CompactReceipt } from './receipt-templates/CompactReceipt';
import { TEMPLATES, isNewTemplate } from '@/components/invoice/templates';
import { getInvoiceDesign } from '@/core/defaults';

/**
 * Renders a sale with the selected template. The four v1 receipt templates are still
 * available ("legacy") so nothing that worked before was removed.
 */
export function InvoiceReceipt({ sale, template, paperSize }: { sale: Sale; template?: ReceiptTemplate; paperSize?: PaperSize }) {
  const settings = useStore((s) => s.settings);
  const currentUser = useStore((s) => s.currentUser);
  const tpl = template || settings.receiptTemplate;

  if (isNewTemplate(tpl)) {
    const Tpl = TEMPLATES[tpl];
    const design = getInvoiceDesign(settings);
    return <div className="print-receipt"><Tpl sale={sale} settings={settings} design={paperSize ? { ...design, paperSize } : design} cashierName={sale.cashierName || currentUser.name} /></div>;
  }
  switch (tpl) {
    case 'bordered': return <BorderedReceipt sale={sale} />;
    case 'modern': return <ModernReceipt sale={sale} />;
    case 'compact': return <CompactReceipt sale={sale} />;
    case 'classic':
    default: return <ClassicReceipt sale={sale} />;
  }
}

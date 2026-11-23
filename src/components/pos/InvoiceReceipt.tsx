import { useStore } from '@/store/useStore';
import type { Sale } from '@/types';
import { ClassicReceipt } from './receipt-templates/ClassicReceipt';
import { BorderedReceipt } from './receipt-templates/BorderedReceipt';
import { ModernReceipt } from './receipt-templates/ModernReceipt';
import { CompactReceipt } from './receipt-templates/CompactReceipt';

export function InvoiceReceipt({ sale }: { sale: Sale }) {
  const template = useStore((s) => s.settings.receiptTemplate);

  switch (template) {
    case 'bordered': return <BorderedReceipt sale={sale} />;
    case 'modern': return <ModernReceipt sale={sale} />;
    case 'compact': return <CompactReceipt sale={sale} />;
    case 'classic':
    default: return <ClassicReceipt sale={sale} />;
  }
}

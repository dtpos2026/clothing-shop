import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_CATEGORIES, DEFAULT_FABRICS, DEFAULT_PRODUCT_TYPES, getNotificationPrefs } from '@/core/defaults';
import { notificationPermission, requestNotificationPermission, notify, scheduleBackupReminder } from '@/platform/notifications';
import { isElectron } from '@/platform/device';
import type { BarcodeFormat, NotificationPrefs } from '@/types';

export function LanguageSettings() {
  const { settings, updateSettings } = useStore();
  return (
    <div className="bg-card rounded-xl border border-border p-5 max-w-2xl space-y-4">
      <Label className="text-base font-bold">Language / زبان</Label>
      <div className="grid grid-cols-2 gap-3">
        {([['en', 'English', 'Left-to-right'], ['ur', 'اردو', 'دائیں سے بائیں (RTL)']] as const).map(([id, name, d]) => (
          <button key={id} onClick={() => updateSettings({ language: id })}
            className={`p-4 rounded-xl border-2 text-start ${(settings.language || 'en') === id ? 'border-primary bg-primary/10' : 'border-border'}`}>
            <div className="font-bold text-lg">{name}</div><div className="text-xs text-muted-foreground">{d}</div>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Menus, POS and common actions are translated; Urdu uses the selected Urdu font and right-to-left layout. Product names, customer names and invoices accept Urdu text in any language mode.</p>
    </div>
  );
}

const PREF_LABELS: Record<keyof NotificationPrefs, string> = {
  lowStock: 'Low stock', outOfStock: 'Out of stock', sales: 'Large sales (≥ 50,000)', backupReminder: 'Backup reminders',
  license: 'License expiry', syncErrors: 'Synchronisation errors', updates: 'App updates & announcements',
};

export function NotificationSettings() {
  const { settings, updateSettings } = useStore();
  const prefs = getNotificationPrefs(settings);
  const [perm, setPerm] = useState<string>('…');
  useEffect(() => { notificationPermission().then(setPerm); }, []);
  const set = (k: keyof NotificationPrefs, v: boolean) => updateSettings({ notificationPrefs: { ...prefs, [k]: v } });
  return (
    <div className="bg-card rounded-xl border border-border p-5 max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><Label className="text-base font-bold">Notifications</Label><p className="text-xs text-muted-foreground">Permission: <b>{perm}</b>. Local alerts work offline; cloud alerts need Firebase.</p></div>
        {perm !== 'granted'
          ? <Button size="sm" onClick={async () => { const ok = await requestNotificationPermission(); setPerm(ok ? 'granted' : 'denied'); if (!ok) toast.error('Permission denied – enable notifications for this app in system settings'); }}>Allow notifications</Button>
          : <Button size="sm" variant="outline" onClick={() => notify('Test notification', 'Notifications are working.', { dedupeMs: 0 })}>Send test</Button>}
      </div>
      {(Object.keys(PREF_LABELS) as (keyof NotificationPrefs)[]).map(k => (
        <label key={k} className="flex items-center justify-between text-sm"><span>{PREF_LABELS[k]}</span><Switch checked={prefs[k]} onCheckedChange={v => set(k, v)} /></label>
      ))}
      <div className="flex items-center gap-2 text-sm">
        <span>Remind me to back up every</span>
        <Input type="number" min={1} max={60} className="w-20 h-8" value={settings.backupReminderDays ?? 7}
          onChange={e => { const d = Math.max(1, parseInt(e.target.value) || 7); updateSettings({ backupReminderDays: d }); void scheduleBackupReminder(d, settings.lastBackupAt); }} />
        <span>days</span>
      </div>
    </div>
  );
}

function ListEditor({ title, defaults, custom, onChange }: { title: string; defaults: string[]; custom: string[]; onChange: (v: string[]) => void }) {
  const [v, setV] = useState('');
  const add = () => {
    const x = v.trim();
    if (!x || defaults.includes(x) || custom.includes(x)) return;
    onChange([...custom, x]); setV('');
  };
  return (
    <div className="space-y-2">
      <Label className="font-semibold">{title}</Label>
      <div className="flex flex-wrap gap-1.5">
        {defaults.map(d => <span key={d} className="px-2 py-0.5 rounded-full bg-muted text-xs">{d}</span>)}
        {custom.map(d => <span key={d} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs inline-flex items-center gap-1">{d}<button onClick={() => onChange(custom.filter(c => c !== d))}><Trash2 className="w-3 h-3" /></button></span>)}
      </div>
      <div className="flex gap-2"><Input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Add custom…" className="h-8" /><Button size="sm" onClick={add}>Add</Button></div>
    </div>
  );
}

export function CatalogueSettings() {
  const { settings, updateSettings } = useStore();
  return (
    <div className="bg-card rounded-xl border border-border p-5 max-w-2xl space-y-5">
      <ListEditor title="Categories" defaults={DEFAULT_CATEGORIES} custom={settings.customCategories || []} onChange={v => updateSettings({ customCategories: v })} />
      <ListEditor title="Fabrics" defaults={DEFAULT_FABRICS} custom={settings.customFabrics || []} onChange={v => updateSettings({ customFabrics: v })} />
      <ListEditor title="Product types" defaults={DEFAULT_PRODUCT_TYPES} custom={settings.customProductTypes || []} onChange={v => updateSettings({ customProductTypes: v })} />
      <div className="space-y-1">
        <Label className="font-semibold">Default code type for new products</Label>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={settings.defaultBarcodeFormat || 'CODE128'} onChange={e => updateSettings({ defaultBarcodeFormat: e.target.value as BarcodeFormat })}>
          <option value="CODE128">Barcode – Code 128</option><option value="EAN13">Barcode – EAN-13</option><option value="EAN8">Barcode – EAN-8</option><option value="QR">QR code</option>
        </select>
      </div>
    </div>
  );
}

/** Windows: choose an installed printer for silent receipt printing. */
export function PrinterPicker() {
  const { settings, updateSettings } = useStore();
  const [list, setList] = useState<{ name: string; displayName: string; isDefault: boolean }[]>([]);
  useEffect(() => { if (isElectron()) window.electronAPI!.listPrinters().then(setList).catch(() => setList([])); }, []);
  if (!isElectron()) return <p className="text-xs text-muted-foreground">Installed printers are listed in the Windows app. On Android, printing uses the system print service (install your printer's print plugin, e.g. RawBT for Bluetooth thermal printers).</p>;
  return (
    <div className="space-y-1">
      <Label>Installed printers (for silent printing)</Label>
      <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={settings.printerName} onChange={e => updateSettings({ printerName: e.target.value })}>
        <option value="Default Printer">System default (show print dialog)</option>
        {list.map(p => <option key={p.name} value={p.name}>{p.displayName}{p.isDefault ? ' (default)' : ''}</option>)}
      </select>
      <p className="text-xs text-muted-foreground">With "Auto print" on and "Print preview" off, receipts print directly to this printer at the configured paper width.</p>
    </div>
  );
}

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Database, Download, Upload, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';

export default function Backup() {
  const { createBackup, restoreBackup, backups } = useStore();
  const [restoreStatus, setRestoreStatus] = useState('');

  const handleBackup = () => {
    const data = createBackup();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const success = restoreBackup(reader.result as string);
        setRestoreStatus(success ? 'Backup restored successfully!' : 'Failed to restore backup.');
        setTimeout(() => setRestoreStatus(''), 3000);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="w-6 h-6" /> Backup / Restore</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <div className="bg-card rounded-xl border border-border p-6 text-center space-y-3">
          <Download className="w-10 h-10 mx-auto text-primary" />
          <h3 className="font-semibold">Create Backup</h3>
          <p className="text-xs text-muted-foreground">Download all data as a JSON file</p>
          <Button onClick={handleBackup} className="w-full">Download Backup</Button>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 text-center space-y-3">
          <Upload className="w-10 h-10 mx-auto text-warning" />
          <h3 className="font-semibold">Restore Backup</h3>
          <p className="text-xs text-muted-foreground">Upload a backup file to restore data</p>
          <Button variant="outline" onClick={handleRestore} className="w-full">Upload & Restore</Button>
        </div>
      </div>

      {restoreStatus && (
        <div className={`rounded-lg p-3 text-sm ${restoreStatus.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {restoreStatus}
        </div>
      )}

      {/* History */}
      <div className="bg-card rounded-xl border border-border p-5 max-w-2xl">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Backup History</h3>
        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No backups created yet</p>
        ) : (
          <div className="space-y-2">
            {backups.slice().reverse().map(b => (
              <div key={b.id} className="flex justify-between items-center py-2 border-b border-border last:border-0 text-sm">
                <span>{format(parseISO(b.date), 'dd MMM yyyy, hh:mm a')}</span>
                <span className="text-muted-foreground">{b.size}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

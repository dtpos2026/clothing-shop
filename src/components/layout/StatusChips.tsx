import { useNavigate } from 'react-router-dom';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useCloudStatus } from '@/cloud/status';
import { cn } from '@/lib/utils';

/** Sync + license state; shown in the sidebar (desktop) and top bar (mobile). */
export function StatusChips() {
  const { online, sync, pending, license, syncError } = useCloudStatus();
  const navigate = useNavigate();
  const lic = license;
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => navigate('/cloud')} title={syncError || `Sync: ${sync}`}
        className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border',
          !online ? 'bg-muted text-muted-foreground border-border'
            : sync === 'error' ? 'bg-destructive/10 text-destructive border-destructive/30'
              : sync === 'syncing' ? 'bg-info/10 text-info border-info/30'
                : sync === 'idle' ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground border-border')}>
        {!online ? <CloudOff className="w-3 h-3" /> : sync === 'syncing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : sync === 'error' ? <AlertTriangle className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
        <span className="hidden sm:inline">{!online ? 'Offline' : sync === 'disabled' ? 'Local only' : sync === 'idle' ? 'Synced' : sync === 'syncing' ? `Syncing${pending ? ` ${pending}` : ''}` : sync === 'error' ? 'Sync error' : 'Offline'}</span>
      </button>
      {lic && (
        <button onClick={() => navigate('/cloud')} title={lic.state === 'invalid' ? lic.reason : 'License'}
          className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border',
            lic.state === 'valid' ? 'bg-success/10 text-success border-success/30' : lic.state === 'grace' ? 'bg-warning/10 text-warning border-warning/30' : 'bg-destructive/10 text-destructive border-destructive/30')}>
          {lic.state === 'valid' ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
          <span className="hidden sm:inline">{lic.state === 'valid' ? `${lic.daysLeft}d` : lic.state === 'grace' ? `Grace ${lic.graceDaysLeft}d` : 'Unlicensed'}</span>
        </button>
      )}
    </div>
  );
}

import { ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, KeyRound, Database, Clock } from 'lucide-react';
import { useCloudStatus } from '@/cloud/status';
import { licenseEnforced, trialDaysLeft } from '@/cloud/licenseService';
import { Button } from '@/components/ui/button';

/** Pages that stay reachable without a valid license so data can always be exported. */
const ALWAYS_OPEN = ['/cloud', '/backup', '/export'];

export function LicenseGate({ children }: { children: ReactNode }) {
  const license = useCloudStatus(s => s.license);
  const location = useLocation();
  const navigate = useNavigate();
  const [trial, setTrial] = useState(trialDaysLeft());
  useEffect(() => { const t = setInterval(() => setTrial(trialDaysLeft()), 3600_000); return () => clearInterval(t); }, []);

  if (!licenseEnforced() || !license || license.state !== 'invalid') return <>{children}</>;
  const noToken = license.reason === 'No license installed';
  if (noToken && trial > 0) {
    return (
      <>
        <div className="no-print fixed top-0 inset-x-0 z-40 bg-warning text-warning-foreground text-xs text-center py-1 flex items-center justify-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Trial: {trial} day(s) left.
          <button className="underline font-semibold" onClick={() => navigate('/cloud')}>Activate license</button>
        </div>
        {children}
      </>
    );
  }
  if (ALWAYS_OPEN.includes(location.pathname)) return <>{children}</>;
  return (
    <div className="h-[100dvh] flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center space-y-4 shadow-xl">
        <ShieldAlert className="w-12 h-12 mx-auto text-destructive" />
        <h1 className="text-xl font-bold">License required</h1>
        <p className="text-sm text-muted-foreground">{noToken ? 'The trial period has ended.' : license.reason}. Your data is safe on this device — you can still back it up and export it.</p>
        <div className="grid gap-2">
          <Button onClick={() => navigate('/cloud')}><KeyRound className="w-4 h-4 me-2" />Activate / renew license</Button>
          <Button variant="outline" onClick={() => navigate('/backup')}><Database className="w-4 h-4 me-2" />Backup my data</Button>
        </div>
      </div>
    </div>
  );
}

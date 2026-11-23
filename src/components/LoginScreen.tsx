import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const { users, setCurrentUser, settings } = useStore();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const activeUsers = users.filter(u => u.active);

  // If no users exist, auto-login as default admin
  if (activeUsers.length === 0) {
    return null; // no login needed
  }

  const handleLogin = () => {
    const user = activeUsers.find(u => u.id === selectedUser);
    if (!user) return;
    if (user.pin === pin) {
      setCurrentUser({ role: user.role as 'admin' | 'cashier' | 'father' | 'son', name: user.name });
      onLogin();
    } else {
      setError('❌ Wrong PIN! Try again.');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, hsl(160, 43%, 12%) 0%, hsl(160, 30%, 8%) 100%)' }}>

      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, transparent, #C6A458, transparent)' }} />

      <div className="bg-card rounded-2xl shadow-2xl border border-border p-8 w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 mx-auto rounded-xl object-contain mb-3" />
          ) : (
            <div className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center text-2xl font-black mb-3"
              style={{ background: 'linear-gradient(135deg, #C6A458, #8B7336)', color: '#fff' }}>
              {settings.storeName.charAt(0)}
            </div>
          )}
          <h1 className="text-xl font-bold">{settings.storeName}</h1>
          <p className="text-xs text-muted-foreground mt-1">Select user & enter PIN</p>
        </div>

        {/* User Selection */}
        {!selectedUser ? (
          <div className="space-y-2">
            {activeUsers.map(u => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{u.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Logging in as</p>
              <p className="font-bold text-lg">{activeUsers.find(u => u.id === selectedUser)?.name}</p>
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  maxLength={6}
                  placeholder="Enter PIN..."
                  value={pin}
                  onChange={e => { setPin(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="pl-9 text-center text-2xl tracking-[0.5em] font-mono"
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-destructive text-center mt-1">{error}</p>}
            </div>

            <Button onClick={handleLogin} className="w-full" disabled={pin.length < 4}>
              <Lock className="w-4 h-4 mr-2" /> Login
            </Button>

            <Button variant="ghost" size="sm" className="w-full" onClick={() => { setSelectedUser(null); setPin(''); setError(''); }}>
              ← Back to users
            </Button>
          </div>
        )}

        <p className="text-[10px] text-center text-muted-foreground">
          Developed by {settings.developerCompany || 'Digital Target'}
        </p>
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { Settings as SettingsIcon, Upload, Printer, Tag, Type, Receipt, UserPlus, Trash2, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { UserRole } from '@/types';

export default function SettingsPage() {
  const { settings, updateSettings, users, addUser, deleteUser, updateUser } = useStore();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);
  const devLogoRef = useRef<HTMLInputElement>(null);

  // User form
  const [showUserForm, setShowUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('cashier');
  const [newUserPin, setNewUserPin] = useState('');

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateSettings({ logoUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateSettings({ customQrUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleDevLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateSettings({ developerLogoUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleAddUser = () => {
    if (!newUserName || newUserPin.length < 4) return;
    addUser({ name: newUserName, role: newUserRole, pin: newUserPin, active: true });
    setNewUserName('');
    setNewUserPin('');
    setShowUserForm(false);
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold flex items-center gap-2"><SettingsIcon className="w-6 h-6" /> Settings</h1>

      <Tabs defaultValue="branding">
        <TabsList className="flex-wrap">
          <TabsTrigger value="branding">Store Branding</TabsTrigger>
          <TabsTrigger value="receipt">Receipt Template</TabsTrigger>
          <TabsTrigger value="fonts">Fonts</TabsTrigger>
          <TabsTrigger value="printer">Printer</TabsTrigger>
          <TabsTrigger value="qr">QR Codes</TabsTrigger>
          <TabsTrigger value="promo">Promotions</TabsTrigger>
          <TabsTrigger value="developer">Developer</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-5 max-w-2xl space-y-4">
            <div><Label>Store Name</Label><Input value={settings.storeName} onChange={e => updateSettings({ storeName: e.target.value })} /></div>
            <div>
              <Label>Logo</Label>
              <div className="flex items-center gap-4 mt-1">
                {settings.logoUrl && <img src={settings.logoUrl} alt="Logo" style={{ width: settings.logoWidth, height: settings.logoHeight }} className="border rounded" />}
                <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" /> Upload Logo
                </Button>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Logo Width (px)</Label><Input type="number" value={settings.logoWidth} onChange={e => updateSettings({ logoWidth: parseInt(e.target.value) || 120 })} /></div>
              <div><Label>Logo Height (px)</Label><Input type="number" value={settings.logoHeight} onChange={e => updateSettings({ logoHeight: parseInt(e.target.value) || 60 })} /></div>
            </div>
            <div><Label>Phone</Label><Input value={settings.phone} onChange={e => updateSettings({ phone: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={settings.address} onChange={e => updateSettings({ address: e.target.value })} /></div>
            <div><Label>Footer Thank-you Message</Label><Input value={settings.footerMessage} onChange={e => updateSettings({ footerMessage: e.target.value })} /></div>
            <div><Label>Footer Note (optional)</Label><Input value={settings.footerNote} onChange={e => updateSettings({ footerNote: e.target.value })} /></div>
            <div><Label>Currency Symbol</Label><Input value={settings.currency} onChange={e => updateSettings({ currency: e.target.value })} className="w-24" /></div>
          </div>
        </TabsContent>

        <TabsContent value="receipt" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-5 max-w-2xl space-y-4">
            <Label className="text-base font-bold">Choose Receipt Template</Label>
            <p className="text-sm text-muted-foreground">Select the style for your thermal receipt printout</p>
            <div className="grid grid-cols-2 gap-4 mt-3">
              {([
                { id: 'classic' as const, name: 'Classic Simple', desc: 'Clean dashed lines, minimal design' },
                { id: 'bordered' as const, name: 'Bordered Professional', desc: 'Box borders, table layout, formal look' },
                { id: 'modern' as const, name: 'Modern Minimal', desc: 'Spacious layout, bold headings, contemporary' },
                { id: 'compact' as const, name: 'Compact Dense', desc: 'Maximum info in minimum space' },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => updateSettings({ receiptTemplate: t.id })}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    settings.receiptTemplate === t.id
                      ? 'border-primary bg-primary/10 shadow-md'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-bold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
                  {settings.receiptTemplate === t.id && (
                    <div className="mt-2 text-xs font-bold text-primary">✓ Active</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="fonts" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-5 max-w-2xl space-y-5">
            <div>
              <Label>Display Font (UI)</Label>
              <p className="text-xs text-muted-foreground mb-1">Used for headings and interface text</p>
              <Select value={settings.displayFont} onValueChange={v => updateSettings({ displayFont: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Plus Jakarta Sans">Plus Jakarta Sans</SelectItem>
                  <SelectItem value="Montserrat">Montserrat</SelectItem>
                  <SelectItem value="Norvas Demo">Norvas Demo (Expanded)</SelectItem>
                  <SelectItem value="Regaltion Highter">Regaltion Highter</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 p-3 border border-border rounded-lg" style={{ fontFamily: `'${settings.displayFont}', sans-serif` }}>
                <p className="text-lg font-bold">Preview: {settings.storeName}</p>
                <p className="text-sm">The quick brown fox jumps over the lazy dog</p>
              </div>
            </div>

            <div>
              <Label>Receipt Font</Label>
              <p className="text-xs text-muted-foreground mb-1">Used on printed receipts</p>
              <Select value={settings.receiptFont} onValueChange={v => updateSettings({ receiptFont: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Montserrat">Montserrat</SelectItem>
                  <SelectItem value="Plus Jakarta Sans">Plus Jakarta Sans</SelectItem>
                  <SelectItem value="Arial">Arial (System)</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 p-3 border border-border rounded-lg bg-white text-black" style={{ fontFamily: `'${settings.receiptFont}', Arial, sans-serif`, fontSize: '13px', fontWeight: 700 }}>
                <p className="text-base font-bold">{settings.storeName}</p>
                <p>Invoice: INV-01001</p>
                <p>Total: {settings.currency} 5,000</p>
              </div>
            </div>

            <div>
              <Label>Urdu Font</Label>
              <p className="text-xs text-muted-foreground mb-1">Used for Urdu text on receipts and items</p>
              <Select value={settings.urduFont} onValueChange={v => updateSettings({ urduFont: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Jameel Noori Nastaleeq">Jameel Noori Nastaleeq</SelectItem>
                  <SelectItem value="Jameel Noori Kasheeda">Jameel Noori Kasheeda</SelectItem>
                  <SelectItem value="Aseer Unicode">Aseer Unicode</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2 p-3 border border-border rounded-lg" style={{ fontFamily: `'${settings.urduFont}', serif`, fontSize: '20px', direction: 'rtl', lineHeight: 2 }}>
                <p>خوش آمدید — {settings.storeName}</p>
                <p style={{ fontSize: '16px' }}>شکریہ آپ کی خریداری کا</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="printer" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-5 max-w-lg space-y-4">
            <div><Label>Printer Name</Label><Input value={settings.printerName} onChange={e => updateSettings({ printerName: e.target.value })} /></div>
            <div>
              <Label>Printer Type</Label>
              <div className="mt-1 px-3 py-2 rounded-md bg-muted text-sm font-medium">Thermal 80mm</div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto Print After Payment</Label>
              <Switch checked={settings.autoPrint} onCheckedChange={v => updateSettings({ autoPrint: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Print Preview</Label>
              <Switch checked={settings.printPreview} onCheckedChange={v => updateSettings({ printPreview: v })} />
            </div>
            <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Test Print</Button>
          </div>
        </TabsContent>

        <TabsContent value="qr" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-5 max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Auto Invoice QR</Label>
              <Switch checked={settings.enableInvoiceQr} onCheckedChange={v => updateSettings({ enableInvoiceQr: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enable Custom QR on Receipt</Label>
              <Switch checked={settings.enableCustomQr} onCheckedChange={v => updateSettings({ enableCustomQr: v })} />
            </div>
            {settings.enableCustomQr && (
              <div>
                <Label>Custom QR Image</Label>
                <div className="flex items-center gap-4 mt-1">
                  {settings.customQrUrl && <img src={settings.customQrUrl} alt="QR" className="w-16 h-16 border rounded" />}
                  <Button variant="outline" size="sm" onClick={() => qrInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> Upload QR
                  </Button>
                  <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="promo" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-5 max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Promotional Sale</Label>
                <p className="text-xs text-muted-foreground">Applies discount automatically to all bills</p>
              </div>
              <Switch checked={settings.promoEnabled} onCheckedChange={v => updateSettings({ promoEnabled: v })} />
            </div>
            {settings.promoEnabled && (
              <div>
                <Label>Promotional Discount (%)</Label>
                <Input type="number" value={settings.promoDiscount} onChange={e => updateSettings({ promoDiscount: parseFloat(e.target.value) || 0 })} className="w-32" />
              </div>
            )}
          </div>
        </TabsContent>

        {/* Developer Branding Tab */}
        <TabsContent value="developer" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-5 max-w-2xl space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Shield className="w-4 h-4" /> Developer Branding</h3>
            <p className="text-xs text-muted-foreground">Appears on splash screen, PDF reports footer, and receipts</p>
            <div><Label>Developer Name</Label><Input value={settings.developerName} onChange={e => updateSettings({ developerName: e.target.value })} placeholder="e.g. Taimoor Younas" /></div>
            <div><Label>Company Name</Label><Input value={settings.developerCompany} onChange={e => updateSettings({ developerCompany: e.target.value })} placeholder="e.g. Digital Target" /></div>
            <div>
              <Label>Developer Logo</Label>
              <div className="flex items-center gap-4 mt-1">
                {settings.developerLogoUrl && <img src={settings.developerLogoUrl} alt="Dev Logo" className="h-10 object-contain border rounded" />}
                <Button variant="outline" size="sm" onClick={() => devLogoRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" /> Upload Logo
                </Button>
                <input ref={devLogoRef} type="file" accept="image/*" className="hidden" onChange={handleDevLogoUpload} />
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg text-xs text-muted-foreground">
              <p>Preview: "Developed by <strong>{settings.developerCompany || 'Digital Target'}</strong>"</p>
              {settings.developerName && <p className="mt-1">{settings.developerName}</p>}
            </div>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-5 max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold flex items-center gap-2"><UserPlus className="w-4 h-4" /> User Management</h3>
                <p className="text-xs text-muted-foreground">Create users with PIN-based offline login</p>
              </div>
              <Button size="sm" onClick={() => setShowUserForm(!showUserForm)}>
                <UserPlus className="w-4 h-4 mr-2" /> Add User
              </Button>
            </div>

            {showUserForm && (
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div><Label>Name</Label><Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="User name" /></div>
                <div>
                  <Label>Role</Label>
                  <Select value={newUserRole} onValueChange={v => setNewUserRole(v as UserRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>PIN (4-6 digits)</Label><Input type="password" maxLength={6} value={newUserPin} onChange={e => setNewUserPin(e.target.value)} placeholder="Enter PIN" /></div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddUser} disabled={!newUserName || newUserPin.length < 4}>Create User</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowUserForm(false)}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {users.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No users created. Default admin login is active.</p>
              )}
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{u.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{u.role} · {u.active ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => updateUser(u.id, { active: !u.active })}>
                      {u.active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteUser(u.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Budget Tab */}
        <TabsContent value="budget" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-5 max-w-lg space-y-4">
            <h3 className="font-bold">Monthly Budget Limits</h3>
            <p className="text-xs text-muted-foreground">یہ بجٹ سیٹ کریں تاکہ AI Advisor آپ کو بتائے کہ خرچے بجٹ سے زیادہ ہو گئے ہیں۔ Expenses اور Accounting پیج پر warnings آئیں گی۔</p>
            <div><Label>Monthly Home Expense Budget ({settings.currency})</Label><Input type="number" value={settings.monthlyHomeExpenseBudget} onChange={e => updateSettings({ monthlyHomeExpenseBudget: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Monthly Shop Expense Budget ({settings.currency})</Label><Input type="number" value={settings.monthlyShopExpenseBudget} onChange={e => updateSettings({ monthlyShopExpenseBudget: parseFloat(e.target.value) || 0 })} /></div>
            <hr className="border-border" />
            <h3 className="font-bold">PDF Report Style</h3>
            <div className="flex items-center justify-between">
              <div>
                <Label>Black & White Reports</Label>
                <p className="text-xs text-muted-foreground">آن کریں تو سب PDF رپورٹس بلیک اینڈ وائٹ ہوں گی</p>
              </div>
              <Switch checked={settings.bwReports} onCheckedChange={v => updateSettings({ bwReports: v })} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Plus, Trash2, Phone, MessageCircle, Search, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { exportLeadsReportPDF } from '@/lib/pdfExport';
import type { Lead, LeadStatus, LeadSource } from '@/types';

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  interested: 'bg-emerald-100 text-emerald-700',
  converted: 'bg-primary/10 text-primary',
  lost: 'bg-muted text-muted-foreground',
};

export default function Leads() {
  const { leads, addLead, updateLead, deleteLead, settings } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Lead, 'id' | 'createdAt'>>({
    name: '', phone: '', source: 'walk-in', status: 'new', interest: '', notes: '', followUpDate: '',
  });

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const q = search.toLowerCase();
      const match = !q || l.name.toLowerCase().includes(q) || l.phone.includes(q);
      const matchStatus = statusFilter === 'all' || l.status === statusFilter;
      return match && matchStatus;
    });
  }, [leads, search, statusFilter]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    addLead(form);
    setForm({ name: '', phone: '', source: 'walk-in', status: 'new', interest: '', notes: '', followUpDate: '' });
    setShowForm(false);
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">{leads.length} leads tracked</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportLeadsReportPDF(leads, settings)}><FileText className="w-4 h-4 mr-2" /> PDF Report</Button>
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> Add Lead</Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="interested">Interested</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Leads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(lead => (
          <div key={lead.id} className="bg-card rounded-2xl border border-border p-5 space-y-3 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{lead.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[lead.status]}`}>{lead.status}</span>
            </div>
            <p className="text-sm text-muted-foreground">{lead.phone}</p>
            <p className="text-xs text-muted-foreground">Source: <span className="capitalize">{lead.source}</span></p>
            {lead.interest && <p className="text-xs">Interest: {lead.interest}</p>}
            {lead.followUpDate && <p className="text-xs text-amber-600">Follow up: {lead.followUpDate}</p>}
            <div className="flex gap-1 pt-2 border-t border-border">
              <Select value={lead.status} onValueChange={v => updateLead(lead.id, { status: v as LeadStatus })}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => window.open(`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`, '_blank')}>
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => window.open(`tel:${lead.phone}`)}>
                <Phone className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm('Delete lead?')) deleteLead(lead.id); }}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Lead Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+92..." /></div>
            <div>
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm({ ...form, source: v as LeadSource })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Interest</Label><Input placeholder="e.g. Wholesale Wash & Wear" value={form.interest} onChange={e => setForm({ ...form, interest: e.target.value })} /></div>
            <div><Label>Follow-up Date</Label><Input type="date" value={form.followUpDate} onChange={e => setForm({ ...form, followUpDate: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name.trim()}>Add Lead</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, SectionCard, InputField, TextAreaField, Button, Spinner, Badge, Field } from '@/components/admin/ui';
import { ArrowLeft, Save, Mail, Plus, GitMerge, Receipt, Inbox, MapPin, Search, FileText, Upload, Trash2 } from 'lucide-react';

interface CEmail { email: string; is_primary: number }
interface CBooking { id: string; request_number: string | null; package_title: string; start_date: string; status: string; total_price: number; created_at: string; email: string }
interface CInvoice { id: string; invoice_number: string; total_amount: number; paid_amount: number; status: string; invoice_date: string }
interface CDoc { id: string; category: string; categoryLabel: string; title: string; filename: string; mime: string; size: number; booking_id: string; visible: number; created_at: string }
const DOC_CATS: { value: string; label: string }[] = [
  { value: 'ticket', label: 'Ticket' }, { value: 'hotel', label: 'Hotel-Info' }, { value: 'voucher', label: 'Voucher' },
  { value: 'offer', label: 'Angebot' }, { value: 'invoice', label: 'Rechnung' }, { value: 'other', label: 'Dokument' },
];
function fsize(n: number) { return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; }
interface Detail {
  id: string; salutation: string; first_name: string; last_name: string; name: string; company: string; phone: string;
  street: string; zip: string; city: string; country: string; notes: string;
  emails: CEmail[]; bookings: CBooking[]; invoices: CInvoice[];
}
interface MergeHit { id: string; name: string; primary_email: string }

function eur(n: number) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0); }
function date(s?: string) { if (!s) return '–'; try { return new Date(s).toLocaleDateString('de-DE'); } catch { return s; } }
const STATUS: Record<string, { label: string; color: string }> = {
  new: { label: 'Neu', color: '#2563eb' }, in_progress: { label: 'In Arbeit', color: '#d97706' },
  booked: { label: 'Gebucht', color: '#16a34a' }, rejected: { label: 'Verloren', color: '#dc2626' },
};

export default function KundenakteePage() {
  const params = useParams();
  const id = String(params.id || '');
  const [c, setC] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Detail>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [mergeQ, setMergeQ] = useState('');
  const [hits, setHits] = useState<MergeHit[]>([]);
  const [merging, setMerging] = useState(false);
  const [docs, setDocs] = useState<CDoc[]>([]);
  const [docCat, setDocCat] = useState('ticket');
  const [docTitle, setDocTitle] = useState('');
  const [docBooking, setDocBooking] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 4000); };

  const loadDocs = useCallback(async () => {
    const res = await fetch(`/api/admin/customers/${id}/documents`).then((r) => r.json()).catch(() => null);
    if (res?.success) setDocs(res.data || []);
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`).then((r) => r.json());
      if (res.success) {
        setC(res.data);
        setForm({
          salutation: res.data.salutation, first_name: res.data.first_name || '', last_name: res.data.last_name || '',
          company: res.data.company, phone: res.data.phone,
          street: res.data.street, zip: res.data.zip, city: res.data.city, country: res.data.country, notes: res.data.notes,
        });
      }
      await loadDocs();
    } finally { setLoading(false); }
  }, [id, loadDocs]);
  useEffect(() => { load(); }, [load]);

  const uploadDoc = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { flash(false, 'Bitte eine Datei wählen.'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', docCat);
      fd.append('title', docTitle);
      fd.append('booking_id', docBooking);
      const res = await fetch(`/api/admin/customers/${id}/documents`, { method: 'POST', body: fd }).then((r) => r.json());
      if (res.success) { setDocTitle(''); if (fileRef.current) fileRef.current.value = ''; flash(true, 'Dokument hochgeladen – im Portal sichtbar.'); await loadDocs(); }
      else flash(false, res.error || 'Upload fehlgeschlagen.');
    } catch { flash(false, 'Verbindungsfehler.'); } finally { setUploading(false); }
  };

  const deleteDoc = async (docId: string, label: string) => {
    if (!confirm(`„${label}" wirklich löschen? Der Kunde kann es dann nicht mehr abrufen.`)) return;
    const res = await fetch(`/api/admin/customers/${id}/documents?docId=${encodeURIComponent(docId)}`, { method: 'DELETE' }).then((r) => r.json());
    if (res.success) { flash(true, 'Dokument gelöscht.'); await loadDocs(); } else flash(false, res.error || 'Fehler.');
  };

  const set = (k: keyof Detail, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).then((r) => r.json());
      if (res.success) { flash(true, 'Stammdaten gespeichert.'); await load(); } else flash(false, res.error || 'Fehler.');
    } catch { flash(false, 'Verbindungsfehler.'); } finally { setSaving(false); }
  };

  const addEmail = async () => {
    if (!newEmail.trim()) return;
    const res = await fetch(`/api/admin/customers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addEmail: newEmail }) }).then((r) => r.json());
    if (res.success) { setNewEmail(''); flash(true, 'Alias-E-Mail hinzugefügt.'); await load(); } else flash(false, res.error || 'Fehler.');
  };

  const searchMerge = async (q: string) => {
    setMergeQ(q);
    if (!q.trim()) { setHits([]); return; }
    const res = await fetch(`/api/admin/customers?search=${encodeURIComponent(q)}`).then((r) => r.json());
    if (res.success) setHits((res.data || []).filter((x: MergeHit) => x.id !== id).slice(0, 6));
  };

  const doMerge = async (sourceId: string, label: string) => {
    if (!confirm(`„${label}" in diesen Kunden zusammenführen? Anfragen/Buchungen wandern hierher, die E-Mail bleibt als Alias erhalten.`)) return;
    setMerging(true);
    try {
      const res = await fetch('/api/admin/customers/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId: id, sourceId }) }).then((r) => r.json());
      if (res.success) { setMergeQ(''); setHits([]); flash(true, 'Kunden zusammengeführt.'); await load(); } else flash(false, res.error || 'Merge fehlgeschlagen.');
    } finally { setMerging(false); }
  };

  if (loading) return <AdminShell title="Kundenakte"><div className="py-16 text-center"><Spinner /></div></AdminShell>;
  if (!c) return <AdminShell title="Kundenakte"><p className="text-gray-500">Kunde nicht gefunden. <Link href="/admin/kunden" className="underline">Zurück</Link></p></AdminShell>;

  const revenue = c.bookings.filter((b) => b.status === 'booked').reduce((s, b) => s + (b.total_price || 0), 0);

  return (
    <AdminShell title="Kundenakte">
      {toast && (
        <div className="mb-5 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: toast.ok ? '#ecfdf5' : '#fef2f2', color: toast.ok ? '#047857' : '#b91c1c', border: `1px solid ${toast.ok ? '#a7f3d0' : '#fecaca'}` }}>{toast.msg}</div>
      )}

      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link href="/admin/kunden" className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-gray-500"><ArrowLeft className="h-3.5 w-3.5" /> Alle Kunden</Link>
          <h2 className="text-2xl font-extrabold" style={{ color: COLORS.navy }}>{c.name || '(ohne Name)'}</h2>
          <div className="text-sm text-gray-500">{c.emails.find((e) => e.is_primary)?.email || c.emails[0]?.email}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold" style={{ color: COLORS.navy }}>{eur(revenue)}</div>
          <div className="text-xs text-gray-400">{c.bookings.length} Anfragen · {c.bookings.filter((b) => b.status === 'booked').length} gebucht</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Stammdaten & Rechnungsadresse" icon={<MapPin className="h-5 w-5" />}
          actions={<Button variant="accent" size="sm" onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4 border-white" /> : <Save className="h-4 w-4" />} Speichern</Button>}>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Anrede">
                <select
                  value={form.salutation || ''}
                  onChange={(e) => set('salutation', e.target.value)}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  style={{ borderColor: COLORS.stroke, color: COLORS.navy }}
                >
                  <option value="">Keine Angabe</option>
                  <option value="herr">Herr</option>
                  <option value="frau">Frau</option>
                  <option value="divers">Divers</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField label="Vorname" value={form.first_name || ''} onChange={(e) => set('first_name', e.target.value)} />
              <InputField label="Nachname" value={form.last_name || ''} onChange={(e) => set('last_name', e.target.value)} />
            </div>
            <InputField label="Firma" value={form.company || ''} onChange={(e) => set('company', e.target.value)} />
            <InputField label="Telefon" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
            <InputField label="Strasse & Nr." value={form.street || ''} onChange={(e) => set('street', e.target.value)} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <InputField label="PLZ" value={form.zip || ''} onChange={(e) => set('zip', e.target.value)} />
              <InputField label="Ort" value={form.city || ''} onChange={(e) => set('city', e.target.value)} />
              <InputField label="Land" value={form.country || ''} onChange={(e) => set('country', e.target.value)} />
            </div>
            <TextAreaField label="Notizen" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} rows={3} />
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="E-Mail-Adressen" description="Primär + Aliase (z.B. nach Merge). Neue Anfragen dieser Adressen landen wieder bei diesem Kunden." icon={<Mail className="h-5 w-5" />}>
            <div className="grid gap-2">
              {c.emails.map((e) => (
                <div key={e.email} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: '#f5f7fa' }}>
                  <span className="text-gray-800">{e.email}</span>
                  {e.is_primary ? <Badge tone="navy">Primär</Badge> : <Badge tone="muted">Alias</Badge>}
                </div>
              ))}
              <Field label="Alias-E-Mail hinzufügen">
                <div className="flex gap-2">
                  <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="weitere@email.com" className="flex-1 rounded-lg border px-3 py-2 text-sm text-gray-900" style={{ borderColor: '#d8dde4' }} />
                  <Button type="button" variant="secondary" onClick={addEmail}><Plus className="h-4 w-4" /> Hinzufügen</Button>
                </div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Dubletten zusammenführen" description="Anderen Kunden in diesen mergen – Historie wandert hierher, dessen E-Mail bleibt als Alias." icon={<GitMerge className="h-5 w-5" />}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={mergeQ} onChange={(e) => searchMerge(e.target.value)} placeholder="Anderen Kunden suchen (Name/E-Mail)…" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm text-gray-900" style={{ borderColor: '#d8dde4' }} />
            </div>
            {hits.length > 0 && (
              <div className="mt-2 grid gap-1.5">
                {hits.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                    <span><span className="font-semibold" style={{ color: COLORS.navy }}>{h.name || '(ohne Name)'}</span> · <span className="text-gray-500">{h.primary_email}</span></span>
                    <Button type="button" variant="secondary" size="sm" onClick={() => doMerge(h.id, h.name || h.primary_email)} disabled={merging}><GitMerge className="h-3.5 w-3.5" /> Mergen</Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title={`Anfragen & Buchungen (${c.bookings.length})`} icon={<Inbox className="h-5 w-5" />}>
          {c.bookings.length === 0 ? <p className="text-sm text-gray-400">Noch keine Anfragen.</p> : (
            <div className="grid gap-2">
              {c.bookings.map((b) => {
                const st = STATUS[b.status] || { label: b.status, color: '#6b7280' };
                return (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: '#eef2f7' }}>
                    <div>
                      <div className="font-semibold" style={{ color: COLORS.navy }}>{b.request_number || b.id.slice(0, 8)} · {b.package_title}</div>
                      <div className="text-xs text-gray-400">{date(b.created_at)} · Reise {date(b.start_date)}</div>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: st.color }}>{st.label}</span>
                      <div className="mt-0.5 text-xs font-bold" style={{ color: COLORS.navy }}>{eur(b.total_price)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title={`Rechnungen (${c.invoices.length})`} icon={<Receipt className="h-5 w-5" />}>
          {c.invoices.length === 0 ? <p className="text-sm text-gray-400">Noch keine Rechnungen.</p> : (
            <div className="grid gap-2">
              {c.invoices.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: '#eef2f7' }}>
                  <div>
                    <div className="font-semibold" style={{ color: COLORS.navy }}>{i.invoice_number}</div>
                    <div className="text-xs text-gray-400">{date(i.invoice_date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{i.status}</div>
                    <div className="text-sm font-bold" style={{ color: COLORS.navy }}>{eur(i.paid_amount)} / {eur(i.total_amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title={`Reiseakte & Dokumente (${docs.length})`} description="Tickets, Hotel-Infos, Voucher, Angebote – sichtbar im Kundenportal." icon={<FileText className="h-5 w-5" />}>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {docs.length === 0 ? <p className="text-sm text-gray-400">Noch keine Dokumente hinterlegt.</p> : (
                <div className="grid gap-2">
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: '#eef2f7' }}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge tone="navy">{d.categoryLabel}</Badge>
                          <span className="truncate font-semibold" style={{ color: COLORS.navy }}>{d.title || d.filename}</span>
                        </div>
                        <div className="text-xs text-gray-400">{d.filename} · {fsize(d.size)}{d.booking_id ? ' · einer Anfrage zugeordnet' : ''}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a href={`/api/admin/customers/${id}/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg px-2.5 py-1.5 text-xs font-semibold" style={{ background: '#f5f7fa', color: COLORS.navy }}>Öffnen</a>
                        <button onClick={() => deleteDoc(d.id, d.title || d.filename)} className="rounded-lg px-2 py-1.5 text-xs font-semibold" style={{ background: '#fef2f2', color: '#b91c1c' }}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: '#e5e8ed', background: '#fcfdfe' }}>
              <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">Hochladen</div>
              <div className="grid gap-2.5">
                <Field label="Kategorie">
                  <select value={docCat} onChange={(e) => setDocCat(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900" style={{ borderColor: '#d8dde4' }}>
                    {DOC_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <InputField label="Titel (optional)" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="z.B. Flugticket Hinflug" />
                <Field label="Anfrage zuordnen (optional)">
                  <select value={docBooking} onChange={(e) => setDocBooking(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900" style={{ borderColor: '#d8dde4' }}>
                    <option value="">Allgemein (keine)</option>
                    {c.bookings.map((b) => <option key={b.id} value={b.id}>{b.request_number || b.id.slice(0, 8)} · {b.package_title}</option>)}
                  </select>
                </Field>
                <input ref={fileRef} type="file" className="text-xs text-gray-600" />
                <Button type="button" variant="accent" onClick={uploadDoc} disabled={uploading}>{uploading ? <Spinner className="h-4 w-4 border-white" /> : <Upload className="h-4 w-4" />} Hochladen</Button>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}

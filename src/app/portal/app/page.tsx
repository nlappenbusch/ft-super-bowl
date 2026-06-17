'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const NAVY = '#143047';
const ACCENT = '#d9531e';

interface Attachment { id: string; filename: string; mime: string; size: number }
interface Message { id: string; direction: 'in' | 'out'; subject: string; body: string; created_at: string; attachments: Attachment[] }
interface DocItem { id: string; category: string; categoryLabel: string; title: string; filename: string; mime: string; size: number; booking_id: string; created_at: string }
interface InvoiceItem { id: string; invoice_number: string; total_amount: number; paid_amount: number; status: string; invoice_date: string }
interface RequestItem {
  id: string; request_number: string | null; package_title: string; start_date: string; status: string;
  total_price: number; created_at: string; messages: Message[]; documents: DocItem[]; invoices: InvoiceItem[];
}
interface Profile { salutation: string; first_name: string; last_name: string; name: string; company: string; phone: string; street: string; zip: string; city: string; country: string }
interface Me { success: boolean; email: string; emails: string[]; profile: Profile; requests: RequestItem[]; generalDocuments: DocItem[] }

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'Eingegangen', color: '#1d4ed8', bg: '#eff6ff' },
  in_progress: { label: 'In Bearbeitung', color: '#b45309', bg: '#fffbeb' },
  booked: { label: 'Gebucht', color: '#15803d', bg: '#f0fdf4' },
  rejected: { label: 'Abgeschlossen', color: '#6b7280', bg: '#f3f4f6' },
};

const eur = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 0 }).format(n || 0);
const fdate = (s?: string) => { if (!s) return '–'; try { return new Date(s).toLocaleDateString('de-CH'); } catch { return s; } }
const fsize = (n: number) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export default function PortalApp() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'requests' | 'profile' | 'docs'>('requests');

  const load = useCallback(async () => {
    const r = await fetch('/api/portal/me');
    if (r.status === 401) { router.replace('/portal'); return; }
    const j = await r.json();
    if (j.success) setMe(j);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const logout = async () => { await fetch('/api/portal/logout', { method: 'POST' }); router.replace('/portal'); };

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>Lädt…</div>;
  if (!me) return null;

  const greetName = me.profile.first_name || me.profile.name || '';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: '0 0 2px', fontSize: 26, fontWeight: 800, color: NAVY }}>
            Hallo{greetName ? ` ${greetName}` : ''}!
          </h1>
          <div style={{ fontSize: 14, color: '#6b7280' }}>{me.email}</div>
        </div>
        <button onClick={logout} style={{ background: '#fff', border: '1px solid #d8dde4', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: NAVY, cursor: 'pointer' }}>Abmelden</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        {([['requests', 'Meine Anfragen'], ['docs', 'Dokumente'], ['profile', 'Meine Daten']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ background: tab === k ? NAVY : '#fff', color: tab === k ? '#fff' : NAVY, border: `1px solid ${tab === k ? NAVY : '#d8dde4'}`, borderRadius: 999, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {label}{k === 'requests' ? ` (${me.requests.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'requests' && <RequestsView requests={me.requests} reload={load} />}
      {tab === 'docs' && <DocsView docs={me.generalDocuments} />}
      {tab === 'profile' && <ProfileView profile={me.profile} emails={me.emails} onSaved={load} />}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 18px rgba(20,48,71,0.06)', padding: 22, ...style }}>{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return <span style={{ background: s.bg, color: s.color, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999 }}>{s.label}</span>;
}

function DownloadRow({ href, label, sub }: { href: string; label: string; sub?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none', background: '#f5f7fa', border: '1px solid #e5e8ed', borderRadius: 10, padding: '10px 14px', marginTop: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 12, color: ACCENT, fontWeight: 700, whiteSpace: 'nowrap' }}>{sub || 'Öffnen'} ↗</span>
    </a>
  );
}

function RequestsView({ requests, reload }: { requests: RequestItem[]; reload: () => void }) {
  const [open, setOpen] = useState<string | null>(requests[0]?.id ?? null);
  if (requests.length === 0) {
    return <Card><p style={{ margin: 0, color: '#6b7280' }}>Sie haben aktuell keine Anfragen.</p></Card>;
  }
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {requests.map((r) => (
        <Card key={r.id} style={{ padding: 0, overflow: 'hidden' }}>
          <button onClick={() => setOpen(open === r.id ? null : r.id)}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5 }}>{r.request_number || 'Anfrage'} · {fdate(r.created_at)}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, marginTop: 2 }}>{r.package_title || 'Reiseanfrage'}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Reisedatum: {fdate(r.start_date)}{r.total_price ? ` · Richtpreis ${eur(r.total_price)}` : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <StatusBadge status={r.status} />
              <span style={{ color: '#9ca3af', fontSize: 18 }}>{open === r.id ? '▾' : '▸'}</span>
            </div>
          </button>

          {open === r.id && (
            <div style={{ borderTop: '1px solid #eef1f5', padding: 20, background: '#fcfdfe' }}>
              {r.invoices.length > 0 && (
                <Section title="Rechnungen">
                  {r.invoices.map((i) => (
                    <DownloadRow key={i.id} href={`/api/portal/invoices/${i.id}/pdf`}
                      label={`${i.invoice_number} · ${eur(i.total_amount)}`}
                      sub={i.status === 'paid' ? 'Bezahlt' : 'PDF'} />
                  ))}
                </Section>
              )}

              {r.documents.length > 0 && (
                <Section title="Reiseunterlagen">
                  {r.documents.map((d) => (
                    <DownloadRow key={d.id} href={`/api/portal/documents/${d.id}`} label={`${d.categoryLabel}: ${d.title}`} sub={fsize(d.size)} />
                  ))}
                </Section>
              )}

              <Section title="Nachrichten">
                <MessageThread messages={r.messages} />
                <ReplyBox bookingId={r.id} reload={reload} />
              </Section>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function MessageThread({ messages }: { messages: Message[] }) {
  if (messages.length === 0) return <p style={{ margin: '0 0 8px', fontSize: 14, color: '#6b7280' }}>Noch keine Nachrichten zu dieser Anfrage.</p>;
  return (
    <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
      {messages.map((m) => {
        const fromUs = m.direction === 'out';
        return (
          <div key={m.id} style={{ display: 'flex', justifyContent: fromUs ? 'flex-start' : 'flex-end' }}>
            <div style={{ maxWidth: '85%', background: fromUs ? '#fff' : '#143047', color: fromUs ? '#374151' : '#fff', border: fromUs ? '1px solid #e5e8ed' : 'none', borderRadius: 14, padding: '12px 15px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, marginBottom: 4 }}>{fromUs ? 'Faltin Travel' : 'Sie'} · {fdate(m.created_at)}</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.body}</div>
              {m.attachments.map((a) => (
                <a key={a.id} href={`/api/portal/attachments/${a.id}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-block', marginTop: 8, fontSize: 13, fontWeight: 700, color: fromUs ? ACCENT : '#ffd9c7', textDecoration: 'underline' }}>
                  📎 {a.filename} ({fsize(a.size)})
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReplyBox({ bookingId, reload }: { bookingId: string; reload: () => void }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const send = async () => {
    const files = fileRef.current?.files;
    if (!text.trim() && (!files || files.length === 0)) { setMsg('Bitte Nachricht oder Anhang angeben.'); return; }
    setSending(true); setMsg('');
    const fd = new FormData();
    fd.append('bookingId', bookingId);
    fd.append('body', text);
    if (files) for (const f of Array.from(files)) fd.append('files', f);
    try {
      const r = await fetch('/api/portal/messages', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok || !j.success) { setMsg(j.error || 'Senden fehlgeschlagen.'); }
      else { setText(''); if (fileRef.current) fileRef.current.value = ''; reload(); }
    } catch { setMsg('Verbindungsfehler.'); }
    finally { setSending(false); }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e8ed', borderRadius: 12, padding: 14 }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Ihre Nachricht an uns…"
        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d8dde4', borderRadius: 9, padding: '10px 12px', fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <input ref={fileRef} type="file" multiple style={{ fontSize: 13, color: '#6b7280' }} />
        <button onClick={send} disabled={sending}
          style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
          {sending ? 'Senden…' : 'Senden →'}
        </button>
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 13, color: '#b91c1c' }}>{msg}</div>}
    </div>
  );
}

function DocsView({ docs }: { docs: DocItem[] }) {
  if (docs.length === 0) {
    return <Card><p style={{ margin: 0, color: '#6b7280' }}>Hier finden Sie allgemeine Unterlagen. Aktuell ist nichts hinterlegt – reisespezifische Dokumente sehen Sie direkt bei der jeweiligen Anfrage.</p></Card>;
  }
  return (
    <Card>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', marginBottom: 4 }}>Allgemeine Dokumente</div>
      {docs.map((d) => (
        <DownloadRow key={d.id} href={`/api/portal/documents/${d.id}`} label={`${d.categoryLabel}: ${d.title}`} sub={fsize(d.size)} />
      ))}
    </Card>
  );
}

function ProfileView({ profile, emails, onSaved }: { profile: Profile; emails: string[]; onSaved: () => void }) {
  const [f, setF] = useState<Profile>(profile);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const set = (k: keyof Profile, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setToast('');
    try {
      const r = await fetch('/api/portal/me', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salutation: f.salutation, first_name: f.first_name, last_name: f.last_name, company: f.company,
          phone: f.phone, street: f.street, zip: f.zip, city: f.city, country: f.country,
        }),
      });
      const j = await r.json();
      if (j.success) { setToast('Gespeichert ✓'); onSaved(); } else setToast(j.error || 'Fehler beim Speichern');
    } catch { setToast('Verbindungsfehler'); }
    finally { setSaving(false); setTimeout(() => setToast(''), 3000); }
  };

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d8dde4', borderRadius: 9, padding: '10px 12px', fontSize: 14, outline: 'none', fontFamily: 'inherit' };
  const lab: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 5 };
  const Field = ({ label, k }: { label: string; k: keyof Profile }) => (
    <div><label style={lab}>{label}</label><input style={inp} value={f[k] || ''} onChange={(e) => set(k, e.target.value)} /></div>
  );

  return (
    <Card>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div>
            <label style={lab}>Anrede</label>
            <select style={inp} value={f.salutation || ''} onChange={(e) => set('salutation', e.target.value)}>
              <option value="">–</option><option value="Herr">Herr</option><option value="Frau">Frau</option>
            </select>
          </div>
          <Field label="Vorname" k="first_name" />
          <Field label="Nachname" k="last_name" />
        </div>
        <Field label="Firma" k="company" />
        <Field label="Telefon" k="phone" />
        <Field label="Strasse & Nr." k="street" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 14 }}>
          <Field label="PLZ" k="zip" />
          <Field label="Ort" k="city" />
          <Field label="Land" k="country" />
        </div>
        <div>
          <label style={lab}>E-Mail-Adresse(n)</label>
          <div style={{ fontSize: 14, color: '#374151', background: '#f5f7fa', border: '1px solid #e5e8ed', borderRadius: 9, padding: '10px 12px' }}>
            {emails.join(', ')}
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Zum Ändern Ihrer E-Mail-Adresse kontaktieren Sie uns bitte direkt.</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={save} disabled={saving}
            style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
          {toast && <span style={{ fontSize: 14, fontWeight: 700, color: toast.includes('✓') ? '#047857' : '#b91c1c' }}>{toast}</span>}
        </div>
      </div>
    </Card>
  );
}

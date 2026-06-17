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
  stage: number; closed: boolean;
  total_price: number; created_at: string; messages: Message[]; documents: DocItem[]; invoices: InvoiceItem[];
}
interface Profile { salutation: string; first_name: string; last_name: string; name: string; company: string; phone: string; street: string; zip: string; city: string; country: string }
interface Me { success: boolean; email: string; emails: string[]; profile: Profile; requests: RequestItem[]; generalDocuments: DocItem[] }

const STAGES = ['Anfrage eingegangen', 'Angebot erhalten', 'Gebucht', 'Unterlagen bereit', 'Reise'];
const STAGE_BADGE = ['Eingegangen', 'Angebot erhalten', 'Gebucht', 'Unterlagen bereit', 'Reise'];
const STAGE_COLOR = ['#1d4ed8', '#b45309', '#15803d', '#0f766e', '#143047'];
const STAGE_BG = ['#eff6ff', '#fffbeb', '#f0fdf4', '#f0fdfa', '#eef2f7'];

const eur = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 0 }).format(n || 0);
const fdate = (s?: string) => { if (!s) return '–'; try { return new Date(s).toLocaleDateString('de-CH'); } catch { return s; } }
const fsize = (n: number) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** E-Mail-/HTML-Nachrichten in lesbaren Text umwandeln (Tags raus, Entities dekodieren). */
function cleanBody(s: string): string {
  if (!s) return '';
  let t = s
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  t = t.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
  return t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '').trim();
}

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
        {([['requests', '📋 Meine Anfragen'], ['docs', '📄 Dokumente & Angebote'], ['profile', '👤 Meine Daten']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ background: tab === k ? NAVY : '#fff', color: tab === k ? '#fff' : NAVY, border: `1px solid ${tab === k ? NAVY : '#d8dde4'}`, borderRadius: 999, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {label}{k === 'requests' ? ` (${me.requests.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'requests' && <RequestsView requests={me.requests} reload={load} />}
      {tab === 'docs' && <DocsView requests={me.requests} generalDocuments={me.generalDocuments} />}
      {tab === 'profile' && <ProfileView profile={me.profile} emails={me.emails} onSaved={load} />}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 18px rgba(20,48,71,0.06)', padding: 22, ...style }}>{children}</div>;
}

function JourneyBadge({ stage, closed }: { stage: number; closed: boolean }) {
  const s = closed
    ? { label: 'Abgeschlossen', color: '#6b7280', bg: '#f3f4f6' }
    : { label: STAGE_BADGE[stage] || 'Eingegangen', color: STAGE_COLOR[stage] || '#1d4ed8', bg: STAGE_BG[stage] || '#eff6ff' };
  return <span style={{ background: s.bg, color: s.color, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{s.label}</span>;
}

function Timeline({ stage, closed }: { stage: number; closed: boolean }) {
  if (closed) {
    return <div style={{ fontSize: 14, color: '#6b7280', background: '#f3f4f6', borderRadius: 10, padding: '12px 14px' }}>Diese Anfrage wurde abgeschlossen.</div>;
  }
  return (
    <div>
      {STAGES.map((label, i) => {
        const done = i < stage; const current = i === stage; const active = done || current;
        return (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, background: done ? ACCENT : '#fff', border: `2px solid ${active ? ACCENT : '#d1d5db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: done ? '#fff' : ACCENT }}>
                {done ? '✓' : current ? '•' : ''}
              </div>
              {i < STAGES.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 16, background: i < stage ? ACCENT : '#e5e8ed' }} />}
            </div>
            <div style={{ paddingBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: current ? 800 : 600, color: active ? NAVY : '#9ca3af' }}>{label}</div>
              {current && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>Aktueller Stand</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
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
              <span style={{ display: 'inline-block', background: '#fff1ea', color: ACCENT, fontSize: 14, fontWeight: 800, letterSpacing: 1, padding: '5px 14px', borderRadius: 9, border: '1px solid #ffd2bd' }}>
                {r.request_number || 'Anfrage'}
              </span>
              <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginTop: 10 }}>{r.package_title || 'Reiseanfrage'}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>Angefragt am {fdate(r.created_at)} · Reisedatum: {fdate(r.start_date)}{r.total_price ? ` · Richtpreis ${eur(r.total_price)}` : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <JourneyBadge stage={r.stage} closed={r.closed} />
              <span style={{ color: '#9ca3af', fontSize: 18 }}>{open === r.id ? '▾' : '▸'}</span>
            </div>
          </button>

          {open === r.id && (
            <div style={{ borderTop: '1px solid #eef1f5', padding: 20, background: '#fcfdfe' }}>
              <Section title="Status Ihrer Reise">
                <Timeline stage={r.stage} closed={r.closed} />
              </Section>

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
              <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{cleanBody(m.body)}</div>
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
  const [fileNames, setFileNames] = useState<string[]>([]);
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
      else { setText(''); setFileNames([]); if (fileRef.current) fileRef.current.value = ''; reload(); }
    } catch { setMsg('Verbindungsfehler.'); }
    finally { setSending(false); }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e8ed', borderRadius: 12, padding: 14 }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Ihre Nachricht an uns…"
        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d8dde4', borderRadius: 9, padding: '10px 12px', fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
      <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
        onChange={(e) => setFileNames(Array.from(e.target.files || []).map((f) => f.name))} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f5f7fa', color: NAVY, border: '1px solid #d8dde4', borderRadius: 9, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            📎 Datei anhängen
          </button>
          <span style={{ fontSize: 12.5, color: fileNames.length ? NAVY : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileNames.length ? fileNames.join(', ') : 'Keine Datei gewählt'}
          </span>
        </div>
        <button onClick={send} disabled={sending}
          style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
          {sending ? 'Senden…' : 'Senden →'}
        </button>
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 13, color: '#b91c1c' }}>{msg}</div>}
    </div>
  );
}

interface ConsolidatedDoc { key: string; category: string; categoryLabel: string; title: string; sub: string; href: string; assignment: string; general: boolean }
const CAT_ORDER: { cat: string; label: string }[] = [
  { cat: 'offer', label: 'Angebote' },
  { cat: 'invoice', label: 'Rechnungen' },
  { cat: 'ticket', label: 'Tickets' },
  { cat: 'hotel', label: 'Hotel-Infos' },
  { cat: 'voucher', label: 'Voucher' },
  { cat: 'other', label: 'Weitere Dokumente' },
];

function AssignmentChip({ general, label }: { general: boolean; label: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
      background: general ? '#eef1f5' : '#fff1ea', color: general ? '#6b7280' : ACCENT,
      border: `1px solid ${general ? '#e5e8ed' : '#ffd2bd'}`,
    }}>{general ? 'Allgemein' : label}</span>
  );
}

function DocRow({ d }: { d: ConsolidatedDoc }) {
  return (
    <a href={d.href} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textDecoration: 'none', background: '#f5f7fa', border: '1px solid #e5e8ed', borderRadius: 10, padding: '11px 14px', marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <AssignmentChip general={d.general} label={d.assignment} />
        <span style={{ fontSize: 14, fontWeight: 600, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
      </div>
      <span style={{ fontSize: 12, color: ACCENT, fontWeight: 700, whiteSpace: 'nowrap' }}>{d.sub} ↗</span>
    </a>
  );
}

function DocsView({ requests, generalDocuments }: { requests: RequestItem[]; generalDocuments: DocItem[] }) {
  // Alle Dokumente konsolidieren: allgemeine + pro Anfrage + Rechnungen.
  const items: ConsolidatedDoc[] = [];
  for (const d of generalDocuments) {
    items.push({ key: `g-${d.id}`, category: d.category, categoryLabel: d.categoryLabel, title: d.title || d.filename, sub: fsize(d.size), href: `/api/portal/documents/${d.id}`, assignment: 'Allgemein', general: true });
  }
  for (const r of requests) {
    const rq = r.request_number || 'Anfrage';
    for (const d of r.documents) {
      items.push({ key: `d-${d.id}`, category: d.category, categoryLabel: d.categoryLabel, title: d.title || d.filename, sub: fsize(d.size), href: `/api/portal/documents/${d.id}`, assignment: rq, general: false });
    }
    for (const i of r.invoices) {
      items.push({ key: `i-${i.id}`, category: 'invoice', categoryLabel: 'Rechnung', title: `${i.invoice_number} · ${eur(i.total_amount)}`, sub: i.status === 'paid' ? 'Bezahlt' : 'PDF', href: `/api/portal/invoices/${i.id}/pdf`, assignment: rq, general: false });
    }
  }

  if (items.length === 0) {
    return <Card><p style={{ margin: 0, color: '#6b7280' }}>Hier sammeln sich künftig alle Ihre Unterlagen – Angebote, Rechnungen, Tickets, Hotel-Infos und Voucher. Aktuell ist noch nichts hinterlegt.</p></Card>;
  }

  const known = new Set(CAT_ORDER.map((c) => c.cat));
  const groups = CAT_ORDER.map((c) => ({ ...c, docs: items.filter((d) => d.category === c.cat) }));
  const rest = items.filter((d) => !known.has(d.category));
  if (rest.length) groups.push({ cat: 'rest', label: 'Sonstiges', docs: rest });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card style={{ padding: '14px 18px', background: '#fcfdfe' }}>
        <p style={{ margin: 0, fontSize: 13.5, color: '#6b7280', lineHeight: 1.6 }}>
          Alle Ihre Unterlagen an einem Ort. Das Etikett zeigt, ob ein Dokument <strong style={{ color: '#6b7280' }}>allgemein</strong> gilt oder zu einer bestimmten <strong style={{ color: ACCENT }}>Anfrage</strong> gehört.
        </p>
      </Card>
      {groups.filter((g) => g.docs.length > 0).map((g) => (
        <Card key={g.cat}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, letterSpacing: 0.3 }}>{g.label}</div>
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 700 }}>{g.docs.length}</span>
          </div>
          {g.docs.map((d) => <DocRow key={d.key} d={d} />)}
        </Card>
      ))}
    </div>
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

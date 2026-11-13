'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, PageHeader, Badge, Button, EmptyState, Spinner, SectionCard, Field, TextInput, TextArea, SelectInput } from '@/components/admin/ui';
import { Ticket, ClipboardPaste, Eye, Mail, Pencil, Trash2, Check, X, ExternalLink, Smartphone, Apple, RefreshCw } from 'lucide-react';
import {
  eventDefaults, resolveTicket, groupForMail, holderName, seatRange, longDate, mailSubject,
  type EventTicket, type TicketBranding, type TicketEventSource, type TicketStatus, type MailLang,
} from '@/lib/eventTicketModel';

type EventOption = TicketEventSource & { name: string };
interface Mailbox { address: string; name: string; canSend: boolean }

const SPIEL_FIELDS = ['event_id', 'event_title', 'match_title', 'event_date', 'kickoff', 'venue', 'venue_address', 'entrance', 'category', 'branding', 'lang', 'hide_holder'] as const;
type Spiel = Record<(typeof SPIEL_FIELDS)[number], string>;
const EMPTY_SPIEL: Spiel = { event_id: '', event_title: '', match_title: '', event_date: '', kickoff: '', venue: '', venue_address: '', entrance: '', category: '', branding: 'ft', lang: 'de', hide_holder: '' };
/** Felder, die nicht aus dem Event kommen. */
const OWN_FIELDS = new Set<string>(['event_id', 'branding', 'lang', 'hide_holder']);

const STATUS_TONE: Record<TicketStatus, 'muted' | 'warn' | 'ok'> = { offen: 'muted', entwurf: 'warn', gesendet: 'ok' };
const STATUS_LABEL: Record<TicketStatus, string> = { offen: 'offen', entwurf: 'Entwurf liegt bereit', gesendet: 'gesendet' };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.success === false) throw new Error(d.error || `Fehler ${r.status}`);
  return d as T;
}

/* ─── Branding-Schalter ─────────────────────────────────────────────────────── */

function BrandingSwitch({ value, onChange, disabled }: { value: string; onChange: (v: TicketBranding) => void; disabled?: boolean }) {
  const opts: Array<[TicketBranding, string]> = [['ft', 'Faltin Travel'], ['neutral', 'White-Label']];
  return (
    <div className="inline-flex rounded-xl border p-0.5" style={{ borderColor: COLORS.stroke }} role="radiogroup" aria-label="Branding der Mail">
      {opts.map(([v, label]) => (
        <button
          key={v} type="button" role="radio" aria-checked={value === v} disabled={disabled}
          onClick={() => onChange(v)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
          style={value === v ? { background: v === 'ft' ? '#02235e' : '#1c2430', color: '#fff' } : { color: COLORS.textMuted }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function LangSwitch({ value, onChange, disabled }: { value: string; onChange: (v: MailLang) => void; disabled?: boolean }) {
  const opts: Array<[MailLang, string]> = [['de', 'Deutsch'], ['en', 'English']];
  return (
    <div className="inline-flex rounded-xl border p-0.5" style={{ borderColor: COLORS.stroke }} role="radiogroup" aria-label="Sprache der Mail">
      {opts.map(([v, label]) => (
        <button
          key={v} type="button" role="radio" aria-checked={value === v} disabled={disabled}
          onClick={() => onChange(v)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
          style={value === v ? { background: COLORS.navy, color: '#fff' } : { color: COLORS.textMuted }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function HolderToggle({ hidden, onChange, disabled }: { hidden: boolean; onChange: (hide: boolean) => void; disabled?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: COLORS.textMuted }}>
      <input type="checkbox" checked={!hidden} disabled={disabled} onChange={(e) => onChange(!e.target.checked)} />
      Ticketinhaber nennen
    </label>
  );
}

/* ─── Spielangaben (Import + Bearbeiten) ────────────────────────────────────── */

function SpielFields({ value, onChange, events }: { value: Spiel; onChange: (v: Spiel) => void; events: EventOption[] }) {
  const set = (k: keyof Spiel, v: string) => onChange({ ...value, [k]: v });
  const pickEvent = (id: string) => {
    const ev = events.find((e) => e.id === id);
    const d = eventDefaults(ev) as Partial<Spiel>;
    const next: Spiel = { ...value, event_id: id };
    // Event-Vorgaben füllen nur leere Felder — Eingetipptes bleibt.
    for (const k of SPIEL_FIELDS) if (!OWN_FIELDS.has(k) && !next[k] && d[k]) next[k] = String(d[k]);
    onChange(next);
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Event in next (optional)" hint="Füllt leere Felder; was hier leer bleibt, kommt später aus dem Event." className="sm:col-span-2">
        <SelectInput value={value.event_id} onChange={(e) => pickEvent(e.target.value)}>
          <option value="">– kein Event verknüpft –</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </SelectInput>
      </Field>
      <Field label="Event-Titel"><TextInput value={value.event_title} onChange={(e) => set('event_title', e.target.value)} placeholder="NFL Munich Game 2026" /></Field>
      <Field label="Spiel"><TextInput value={value.match_title} onChange={(e) => set('match_title', e.target.value)} placeholder="New England Patriots vs. Detroit Lions" /></Field>
      <Field label="Datum"><TextInput type="date" value={value.event_date} onChange={(e) => set('event_date', e.target.value)} /></Field>
      <Field label="Kickoff"><TextInput type="time" value={value.kickoff} onChange={(e) => set('kickoff', e.target.value)} /></Field>
      <Field label="Stadion"><TextInput value={value.venue} onChange={(e) => set('venue', e.target.value)} placeholder="FC Bayern Munich Stadium" /></Field>
      <Field label="Adresse"><TextInput value={value.venue_address} onChange={(e) => set('venue_address', e.target.value)} placeholder="Werner-Heisenberg-Allee 25, 80939 München" /></Field>
      <Field label="Eingang"><TextInput value={value.entrance} onChange={(e) => set('entrance', e.target.value)} placeholder="Kern J" /></Field>
      <Field label="Kategorie"><TextInput value={value.category} onChange={(e) => set('category', e.target.value)} placeholder="Sitzplatz 2 – On Location" /></Field>
      <Field label="Mail" hint="White-Label: ohne Faltin-Logo und -Fusszeile. Ohne Inhaber: keine Zeile «Ticket auf», neutrale Anrede (z. B. für Wiederverkäufer)." className="sm:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <BrandingSwitch value={value.branding} onChange={(v) => set('branding', v)} />
          <LangSwitch value={value.lang} onChange={(v) => set('lang', v)} />
          <HolderToggle hidden={value.hide_holder === '1'} onChange={(h) => set('hide_holder', h ? '1' : '')} />
        </div>
      </Field>
    </div>
  );
}

/* ─── Dialog-Rahmen ─────────────────────────────────────────────────────────── */

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} rounded-2xl bg-white shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: COLORS.stroke }}>
          <h2 className="text-base font-bold" style={{ color: COLORS.navy }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Schliessen" className="rounded-lg p-1.5 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ─── Seite ─────────────────────────────────────────────────────────────────── */

export default function EventTicketsPage() {
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [spiel, setSpiel] = useState<Spiel>(EMPTY_SPIEL);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<EventTicket | null>(null);
  const [preview, setPreview] = useState<{ ids: string[]; subject: string; html: string; errors: string[] } | null>(null);
  const [mobileView, setMobileView] = useState(true);
  const [draftFor, setDraftFor] = useState<EventTicket[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ data: EventTicket[]; events: EventOption[] }>('/api/admin/event-tickets');
      setTickets(d.data);
      setEvents(d.events);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const groups = useMemo(() => {
    const resolved = tickets.map((t) => resolveTicket(t, t.event_id ? eventById.get(t.event_id) : null));
    return [...groupForMail(resolved).values()];
  }, [tickets, eventById]);

  const doImport = async () => {
    setBusy(true);
    try {
      const d = await api<{ count: number }>('/api/admin/event-tickets', { method: 'POST', body: JSON.stringify({ import: paste, defaults: spiel }) });
      setNotice(`${d.count} Ticket${d.count === 1 ? '' : 's'} übernommen.`);
      setPaste('');
      setImportOpen(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const patchMany = async (ids: string[], body: Record<string, unknown>) => {
    setBusy(true);
    try {
      for (const id of ids) await api(`/api/admin/event-tickets/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: EventTicket) => {
    if (!confirm(`Ticket für ${holderName(t) || 'diesen Platz'} (Platz ${t.seat || '?'}) löschen?`)) return;
    try {
      await api(`/api/admin/event-tickets/${t.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openPreview = async (ids: string[]) => {
    try {
      const d = await api<{ subject: string; html: string; errors: string[] }>('/api/admin/event-tickets/mail', { method: 'POST', body: JSON.stringify({ ids, action: 'preview' }) });
      setPreview({ ids, ...d });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <AdminShell title="Event-Tickets">
      <PageHeader
        title="Event-Tickets"
        description="E-Tickets an Kund:innen: Liste vom Lieferanten einfügen, Branding wählen (Faltin Travel oder White-Label), Mail mit Wallet-Knöpfen als Outlook-Entwurf anlegen."
        actions={(
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw size={16} /> Aktualisieren</Button>
            <Button onClick={() => setImportOpen((v) => !v)}><ClipboardPaste size={16} /> Liste einfügen</Button>
          </div>
        )}
      />

      {error && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#fecaca', background: '#fef2f2', color: COLORS.danger }} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Meldung schliessen"><X size={16} /></button>
        </div>
      )}
      {notice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#bbf7d0', background: '#f0fdf4', color: COLORS.ok }} role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Meldung schliessen"><X size={16} /></button>
        </div>
      )}

      {importOpen && (
        <SectionCard
          title="Lieferantenliste einfügen"
          description="Tabelle aus der Mail kopieren (Kunde, Apple, Android, Area, Row, Seat, E-Mail) und hier einfügen. Die Spielangaben gelten für alle eingefügten Plätze."
          icon={<ClipboardPaste size={18} />}
          className="mb-6"
        >
          <SpielFields value={spiel} onChange={setSpiel} events={events} />
          <Field label="Liste" className="mt-4">
            <TextArea rows={8} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Mr. WEEGE, Fredrik\thttps://…type=0\thttps://…type=1\t231\t13\t14\tname@firma.com'} className="font-mono text-xs" />
          </Field>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Abbrechen</Button>
            <Button onClick={doImport} disabled={busy || !paste.trim()}>{busy ? <Spinner /> : <Check size={16} />} Tickets übernehmen</Button>
          </div>
        </SectionCard>
      )}

      {loading && !tickets.length ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !groups.length ? (
        <EmptyState
          icon={<Ticket size={28} />}
          title="Noch keine Tickets"
          description="Füge die Liste vom Ticketlieferanten ein. Pro Empfänger und Spiel entsteht eine Mail mit allen Plätzen."
          action={<Button onClick={() => setImportOpen(true)}><ClipboardPaste size={16} /> Liste einfügen</Button>}
        />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const t = g[0];
            const ids = g.map((x) => x.id);
            const sameRow = new Set(g.map((x) => `${x.area}|${x.row_no}`)).size === 1;
            const allSent = g.every((x) => x.status === 'gesendet');
            const drafted = g.find((x) => x.draft_web_link);
            return (
              <SectionCard
                key={ids.join(',')}
                title={t.match_title || t.event_title || 'Ohne Spiel'}
                description={[t.event_title !== t.match_title ? t.event_title : '', longDate(t.event_date), t.kickoff ? `${t.kickoff} Uhr` : ''].filter(Boolean).join(' · ')}
                icon={<Ticket size={18} />}
                actions={(
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <HolderToggle hidden={t.hide_holder} disabled={busy} onChange={(h) => patchMany(ids, { hide_holder: h })} />
                    <LangSwitch value={t.lang} disabled={busy} onChange={(v) => patchMany(ids, { lang: v })} />
                    <BrandingSwitch value={t.branding} disabled={busy} onChange={(v) => patchMany(ids, { branding: v })} />
                  </div>
                )}
              >
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: COLORS.textMuted }}>
                  <span>An <strong style={{ color: COLORS.navy }}>{t.recipient_email || 'keine E-Mail'}</strong></span>
                  <span>{g.length} Ticket{g.length === 1 ? '' : 's'}{sameRow ? ` · Block ${t.area}, Reihe ${t.row_no}, Platz ${seatRange(g.map((x) => x.seat))}` : ''}</span>
                  {t.entrance && <span>Eingang {t.entrance}</span>}
                  <span className="truncate">Betreff: {mailSubject(g, t.lang)}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
                        <th className="py-2 pr-3 font-semibold">Ticket auf</th>
                        <th className="py-2 pr-3 font-semibold">Block / Reihe / Platz</th>
                        <th className="py-2 pr-3 font-semibold">Wallet</th>
                        <th className="py-2 pr-3 font-semibold">Status</th>
                        <th className="py-2 font-semibold"><span className="sr-only">Aktionen</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.map((x) => (
                        <tr key={x.id} className="border-t" style={{ borderColor: COLORS.stroke }}>
                          <td className="py-2 pr-3">
                            <div className="font-semibold" style={{ color: COLORS.navy }}>{holderName(x) || '–'}</div>
                            {x.holder_raw && x.holder_raw !== holderName(x) && <div className="text-xs" style={{ color: COLORS.textMuted }}>{x.holder_raw}</div>}
                          </td>
                          <td className="py-2 pr-3 tabular-nums">{x.area || '–'} / {x.row_no || '–'} / <strong>{x.seat || '–'}</strong></td>
                          <td className="py-2 pr-3">
                            <div className="flex gap-2">
                              {x.apple_url ? <a href={x.apple_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold underline" style={{ color: COLORS.info }}><Apple size={14} /> Apple</a> : <Badge tone="danger">kein Apple</Badge>}
                              {x.android_url ? <a href={x.android_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold underline" style={{ color: COLORS.info }}><Smartphone size={14} /> Android</a> : <Badge tone="warn">kein Android</Badge>}
                            </div>
                          </td>
                          <td className="py-2 pr-3"><Badge tone={STATUS_TONE[x.status]}>{STATUS_LABEL[x.status]}</Badge></td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <button type="button" onClick={() => setEditing(tickets.find((y) => y.id === x.id) || x)} className="rounded-lg p-1.5 hover:bg-gray-100" aria-label={`Platz ${x.seat} bearbeiten`}><Pencil size={15} /></button>
                            <button type="button" onClick={() => remove(x)} className="rounded-lg p-1.5 hover:bg-red-50" aria-label={`Platz ${x.seat} löschen`} style={{ color: COLORS.danger }}><Trash2 size={15} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={() => openPreview(ids)}><Eye size={16} /> Vorschau</Button>
                  <Button onClick={() => setDraftFor(g)} disabled={!t.recipient_email}><Mail size={16} /> Als Entwurf anlegen</Button>
                  {drafted && (
                    <a href={drafted.draft_web_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold underline" style={{ color: COLORS.info }}>
                      <ExternalLink size={14} /> Entwurf in {drafted.draft_mailbox} öffnen
                    </a>
                  )}
                  {!allSent && drafted && (
                    <Button variant="ghost" size="sm" onClick={() => patchMany(ids, { status: 'gesendet' })} disabled={busy}><Check size={14} /> Als gesendet markieren</Button>
                  )}
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}

      {editing && (
        <EditDialog
          ticket={editing}
          events={events}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
          onError={setError}
        />
      )}

      {preview && (
        <Modal title={`Vorschau: ${preview.subject}`} onClose={() => setPreview(null)} wide>
          {preview.errors.length > 0 && (
            <ul className="mb-3 list-disc rounded-xl border px-8 py-3 text-sm" style={{ borderColor: '#fde68a', background: '#fffbeb', color: COLORS.warn }}>
              {preview.errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs" style={{ color: COLORS.textMuted }}>Die Wallet-Knöpfe in der Vorschau sind die echten Links.</span>
            <div className="inline-flex rounded-xl border p-0.5" style={{ borderColor: COLORS.stroke }}>
              {([[true, 'Handy'], [false, 'Desktop']] as const).map(([m, l]) => (
                <button key={l} type="button" onClick={() => setMobileView(m)} className="rounded-lg px-3 py-1 text-xs font-semibold" style={mobileView === m ? { background: COLORS.navy, color: '#fff' } : { color: COLORS.textMuted }}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-center rounded-xl p-3" style={{ background: COLORS.surfaceMuted }}>
            <iframe title="Mail-Vorschau" srcDoc={preview.html} sandbox="allow-popups allow-popups-to-escape-sandbox" className="rounded-lg border bg-white" style={{ width: mobileView ? 390 : 680, height: 720, borderColor: COLORS.stroke }} />
          </div>
        </Modal>
      )}

      {draftFor && (
        <DraftDialog
          tickets={draftFor}
          onClose={() => setDraftFor(null)}
          onDone={async (msg) => { setDraftFor(null); setNotice(msg); await load(); }}
        />
      )}
    </AdminShell>
  );
}

/* ─── Ticket bearbeiten ─────────────────────────────────────────────────────── */

function EditDialog({ ticket, events, onClose, onSaved, onError }: {
  ticket: EventTicket; events: EventOption[]; onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const [spiel, setSpiel] = useState<Spiel>(() => Object.fromEntries(SPIEL_FIELDS.map((k) => [k, k === 'hide_holder' ? (ticket.hide_holder ? '1' : '') : String(ticket[k] ?? '')])) as Spiel);
  const [f, setF] = useState({
    holder_raw: ticket.holder_raw, holder_salutation: ticket.holder_salutation, holder_first: ticket.holder_first, holder_last: ticket.holder_last,
    recipient_email: ticket.recipient_email, area: ticket.area, row_no: ticket.row_no, seat: ticket.seat,
    apple_url: ticket.apple_url, android_url: ticket.android_url, booking_ref: ticket.booking_ref, internal_note: ticket.internal_note,
    status: ticket.status,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/admin/event-tickets/${ticket.id}`, { method: 'PATCH', body: JSON.stringify({ ...spiel, ...f }) });
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Ticket bearbeiten · Platz ${ticket.seat || '?'}`} onClose={onClose} wide>
      <h3 className="mb-2 text-sm font-bold" style={{ color: COLORS.navy }}>Ticketinhaber & Empfänger</h3>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Anrede">
          <SelectInput value={f.holder_salutation} onChange={(e) => set('holder_salutation', e.target.value)}>
            <option value="">–</option><option value="Herr">Herr</option><option value="Frau">Frau</option>
          </SelectInput>
        </Field>
        <Field label="Vorname"><TextInput value={f.holder_first} onChange={(e) => set('holder_first', e.target.value)} /></Field>
        <Field label="Nachname" className="sm:col-span-2"><TextInput value={f.holder_last} onChange={(e) => set('holder_last', e.target.value)} /></Field>
        <Field label="E-Mail des Empfängers" hint="An diese Adresse geht die Mail (z. B. Wiederverkäufer)." className="sm:col-span-2"><TextInput type="email" value={f.recipient_email} onChange={(e) => set('recipient_email', e.target.value)} /></Field>
        <Field label="Name laut Liste" className="sm:col-span-2"><TextInput value={f.holder_raw} onChange={(e) => set('holder_raw', e.target.value)} /></Field>
      </div>
      <h3 className="mb-2 mt-5 text-sm font-bold" style={{ color: COLORS.navy }}>Platz & Wallet</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Block / Area"><TextInput value={f.area} onChange={(e) => set('area', e.target.value)} /></Field>
        <Field label="Reihe / Row"><TextInput value={f.row_no} onChange={(e) => set('row_no', e.target.value)} /></Field>
        <Field label="Platz / Seat"><TextInput value={f.seat} onChange={(e) => set('seat', e.target.value)} /></Field>
        <Field label="Apple-Wallet-Link" className="sm:col-span-3"><TextInput value={f.apple_url} onChange={(e) => set('apple_url', e.target.value)} /></Field>
        <Field label="Android-/Google-Wallet-Link" className="sm:col-span-3"><TextInput value={f.android_url} onChange={(e) => set('android_url', e.target.value)} /></Field>
      </div>
      <h3 className="mb-2 mt-5 text-sm font-bold" style={{ color: COLORS.navy }}>Spiel</h3>
      <SpielFields value={spiel} onChange={setSpiel} events={events} />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Buchung / Referenz"><TextInput value={f.booking_ref} onChange={(e) => set('booking_ref', e.target.value)} placeholder="RQ-… / FT…" /></Field>
        <Field label="Status">
          <SelectInput value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="offen">offen</option><option value="entwurf">Entwurf liegt bereit</option><option value="gesendet">gesendet</option>
          </SelectInput>
        </Field>
        <Field label="Interne Notiz" hint="Geht nie raus." className="sm:col-span-3"><TextArea rows={2} value={f.internal_note} onChange={(e) => set('internal_note', e.target.value)} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button onClick={save} disabled={saving}>{saving ? <Spinner /> : <Check size={16} />} Speichern</Button>
      </div>
    </Modal>
  );
}

/* ─── Entwurf anlegen ───────────────────────────────────────────────────────── */

function DraftDialog({ tickets, onClose, onDone }: { tickets: EventTicket[]; onClose: () => void; onDone: (msg: string) => void }) {
  const [mailboxes, setMailboxes] = useState<Mailbox[] | null>(null);
  const [mailbox, setMailbox] = useState('');
  const [attach, setAttach] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<{ mailboxes: Mailbox[] }>('/api/admin/mailbox/accounts')
      .then((d) => {
        const list = d.mailboxes.filter((m) => m.canSend);
        setMailboxes(list);
        const pref = list.find((m) => /^(faltin|kontakt)@/.test(m.address)) || list[0];
        if (pref) setMailbox(pref.address);
      })
      .catch((e) => { setMailboxes([]); setErr((e as Error).message); });
  }, []);

  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ mailbox: string; to: string; attached: number; notAttached: string[] }>('/api/admin/event-tickets/mail', {
        method: 'POST', body: JSON.stringify({ ids: tickets.map((t) => t.id), action: 'draft', mailbox, attach }),
      });
      const miss = r.notAttached.length ? ` Wallet-Datei nicht geladen für Platz ${r.notAttached.join(', ')} (Knopf bleibt in der Mail).` : '';
      onDone(`Entwurf an ${r.to} liegt in ${r.mailbox} bereit${r.attached ? ` (${r.attached} Wallet-Datei${r.attached === 1 ? '' : 'en'} angehängt)` : ''}. Bitte in Outlook prüfen und senden.${miss}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const t = tickets[0];
  return (
    <Modal title="Mail als Entwurf anlegen" onClose={onClose}>
      <p className="mb-4 text-sm" style={{ color: COLORS.textMuted }}>
        Die Mail an <strong style={{ color: COLORS.navy }}>{t.recipient_email}</strong> mit {tickets.length} Ticket{tickets.length === 1 ? '' : 's'} ({t.branding === 'neutral' ? 'White-Label' : 'Faltin Travel'}, {t.lang === 'en' ? 'Englisch' : 'Deutsch'}{t.hide_holder ? ', ohne Inhaber' : ''}) wird im gewählten Postfach als Entwurf abgelegt. Gesendet wird erst, wenn du sie in Outlook abschickst.
      </p>
      <Field label="Absender-Postfach">
        {mailboxes === null ? <Spinner /> : (
          <SelectInput value={mailbox} onChange={(e) => setMailbox(e.target.value)}>
            {!mailboxes.length && <option value="">Kein Postfach mit Senderecht</option>}
            {mailboxes.map((m) => <option key={m.address} value={m.address}>{m.name ? `${m.name} <${m.address}>` : m.address}</option>)}
          </SelectInput>
        )}
      </Field>
      <label className="mt-3 flex items-center gap-2 text-sm" style={{ color: COLORS.navy }}>
        <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
        Apple-Wallet-Dateien (.pkpass) zusätzlich anhängen
      </label>
      {err && <p className="mt-3 text-sm" style={{ color: COLORS.danger }} role="alert">{err}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button onClick={go} disabled={busy || !mailbox}>{busy ? <Spinner /> : <Mail size={16} />} Entwurf anlegen</Button>
      </div>
    </Modal>
  );
}

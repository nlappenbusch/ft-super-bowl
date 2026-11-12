'use client';

/**
 * InquiriesPanel — Anfragen an Leistungsträger (Hotel, Bus, Yacht, Veranstalter …)
 * je Kalkulation. Entwürfe ablegen, direkt aus der Kalkulation senden (Graph,
 * Portal-Postfach), Status nachführen. Gesendete Anfragen sind gesperrt und
 * bleiben mit Verlauf als Nachweis erhalten.
 */
import { useCallback, useEffect, useState } from 'react';
import { COLORS, SectionCard, Button, Field, TextInput, TextArea, SelectInput, Badge, Spinner } from '@/components/admin/ui';
import { Mail, Plus, Send, Trash2, ChevronDown, ChevronUp, Copy, Save, AlertTriangle } from 'lucide-react';
import { CALC_CATEGORIES, categoryLabel, type CalcItem } from '@/lib/calcModel';
import {
  INQUIRY_STATUSES, inquiryStatusLabel, checkSendable, hasInternalMarker, countByStatus,
  type CalcInquiry, type InquiryStatus,
} from '@/lib/inquiryModel';

type Tone = 'navy' | 'accent' | 'ok' | 'warn' | 'danger' | 'info' | 'muted';
const toneOf = (s: string): Tone => (INQUIRY_STATUSES.find((x) => x.id === s)?.tone || 'muted') as Tone;
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

type Draft = Pick<CalcInquiry, 'supplier' | 'category' | 'item_id' | 'to_addr' | 'cc_addr' | 'subject' | 'body' | 'internal_note'>;
const EMPTY: Draft = { supplier: '', category: '', item_id: '', to_addr: '', cc_addr: '', subject: '', body: '', internal_note: '' };

export default function InquiriesPanel({ calcId, items }: { calcId: string; items: CalcItem[] }) {
  const [list, setList] = useState<CalcInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mailbox, setMailbox] = useState('');
  const [mailReady, setMailReady] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const base = `/api/admin/calculations/${calcId}/inquiries`;

  const load = useCallback(async () => {
    const res = await fetch(base).then((r) => r.json()).catch(() => null);
    if (res?.success) {
      setList(res.data || []);
      setMailbox(res.mailbox || '');
      setMailReady(!!res.mail_ready);
    }
    setLoading(false);
  }, [base]);

  useEffect(() => { load(); }, [load]);

  const replace = (inq: CalcInquiry) => setList((prev) => prev.map((x) => (x.id === inq.id ? inq : x)));

  const open = (inq: CalcInquiry) => {
    if (openId === inq.id) { setOpenId(null); return; }
    setOpenId(inq.id);
    setEdit({
      supplier: inq.supplier, category: inq.category, item_id: inq.item_id, to_addr: inq.to_addr,
      cc_addr: inq.cc_addr, subject: inq.subject, body: inq.body, internal_note: inq.internal_note,
    });
    setConfirmSend(null);
    setConfirmDelete(null);
    setErr(null);
  };

  const add = async (preset?: Partial<Draft>) => {
    setBusy('new');
    setErr(null);
    const res = await fetch(base, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...EMPTY, ...preset }),
    }).then((r) => r.json()).catch(() => null);
    setBusy(null);
    if (!res?.success) { setErr(res?.error || 'Anlegen fehlgeschlagen'); return; }
    setList((prev) => [...prev, res.data]);
    open(res.data);
  };

  const save = async (id: string, extra?: { status?: InquiryStatus }) => {
    setBusy(id);
    setErr(null);
    const inq = list.find((x) => x.id === id);
    const payload = inq?.sent_at ? { internal_note: edit.internal_note, ...extra } : { ...edit, ...extra };
    const res = await fetch(`${base}/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }).then((r) => r.json()).catch(() => null);
    setBusy(null);
    if (!res?.success) { setErr(res?.error || 'Speichern fehlgeschlagen'); return null; }
    replace(res.data);
    setNotice('Gespeichert.');
    return res.data as CalcInquiry;
  };

  const send = async (id: string) => {
    if (confirmSend !== id) { setConfirmSend(id); return; }
    setConfirmSend(null);
    // Erst die aktuellen Eingaben speichern, dann senden — gesendet wird, was gespeichert ist.
    const saved = await save(id);
    if (!saved) return;
    setBusy(id);
    const res = await fetch(`${base}/${id}/send`, { method: 'POST' }).then((r) => r.json()).catch(() => null);
    setBusy(null);
    if (!res?.success) { setErr(res?.error || 'Versand fehlgeschlagen'); load(); return; }
    replace(res.data);
    setNotice(`Gesendet an ${res.data.to_addr}.`);
  };

  const remove = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setConfirmDelete(null);
    const res = await fetch(`${base}/${id}`, { method: 'DELETE' }).then((r) => r.json()).catch(() => null);
    if (!res?.success) { setErr(res?.error || 'Löschen fehlgeschlagen'); return; }
    setList((prev) => prev.filter((x) => x.id !== id));
    setOpenId(null);
  };

  const duplicate = (inq: CalcInquiry) => add({
    supplier: inq.supplier, category: inq.category, item_id: inq.item_id, to_addr: inq.to_addr,
    cc_addr: inq.cc_addr, subject: inq.subject, body: inq.body, internal_note: inq.internal_note,
  });

  const counts = countByStatus(list);
  const itemOptions = items.filter((i) => i.description.trim());

  return (
    <SectionCard
      title="Anfragen an Leistungsträger"
      description={`Mail-Entwürfe an Hotels, Busunternehmen, Veranstalter … — direkt von hier senden (Postfach ${mailbox || 'des Portals'}) und den Status nachführen.`}
      icon={<Mail className="h-5 w-5" />}
      actions={
        <Button variant="secondary" size="sm" onClick={() => add()} disabled={busy === 'new'}>
          {busy === 'new' ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} Anfrage
        </Button>
      }
    >
      {loading ? (
        <div className="py-4 text-center"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          {list.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {INQUIRY_STATUSES.filter((s) => counts[s.id]).map((s) => (
                <Badge key={s.id} tone={s.tone as Tone}>{counts[s.id]} × {s.label}</Badge>
              ))}
            </div>
          )}
          {!mailReady && (
            <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: COLORS.warn }}>
              <AlertTriangle className="h-3.5 w-3.5" /> Mailversand (Microsoft Graph) ist nicht eingerichtet — Entwürfe lassen sich speichern, aber nicht senden.
            </p>
          )}
          {(err || notice) && (
            <div className="rounded-xl border px-3 py-2 text-sm font-medium"
              style={err ? { borderColor: '#fecaca', background: '#fef2f2', color: COLORS.danger } : { borderColor: '#bbf7d0', background: '#f0fdf4', color: COLORS.ok }}>
              {err || notice}
            </div>
          )}
          {list.length === 0 && (
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              Noch keine Anfragen. Mit „Anfrage“ einen Entwurf anlegen — z. B. Gruppenanfrage Hotel, Bus, Yacht, Restaurant.
            </p>
          )}

          {list.map((inq) => {
            const isOpen = openId === inq.id;
            const locked = !!inq.sent_at;
            const check = checkSendable(isOpen && !locked ? { ...inq, ...edit } : inq);
            return (
              <div key={inq.id} className="overflow-hidden rounded-xl border" style={{ borderColor: COLORS.stroke }}>
                <button onClick={() => open(inq)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left" style={{ background: COLORS.surfaceMuted }}>
                  <Badge tone={toneOf(inq.status)}>{inquiryStatusLabel(inq.status)}</Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold" style={{ color: COLORS.navy }}>
                      {inq.supplier || inq.subject || 'Neue Anfrage'}
                    </span>
                    <span className="block truncate text-xs" style={{ color: COLORS.textMuted }}>
                      {inq.to_addr || 'kein Empfänger'}
                      {inq.category ? ` · ${categoryLabel(inq.category)}` : ''}
                      {inq.sent_at ? ` · gesendet ${fmtDateTime(inq.sent_at)}${inq.sent_by ? ` von ${inq.sent_by}` : ''}` : ''}
                    </span>
                  </span>
                  {inq.send_error && !inq.sent_at && <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: COLORS.danger }} />}
                  {isOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="space-y-3 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Leistungsträger">
                        <TextInput disabled={locked} value={edit.supplier} placeholder="z. B. Nikki Beach Marbella"
                          onChange={(e) => setEdit({ ...edit, supplier: e.target.value })} />
                      </Field>
                      <Field label="Bezug in der Kalkulation">
                        <SelectInput disabled={locked} value={edit.item_id || (edit.category ? `cat:${edit.category}` : '')}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v.startsWith('cat:')) setEdit({ ...edit, category: v.slice(4), item_id: '' });
                            else {
                              const it = items.find((i) => i.id === v);
                              setEdit({ ...edit, item_id: v, category: it?.category || '' });
                            }
                          }}>
                          <option value="">— ohne Bezug —</option>
                          {CALC_CATEGORIES.map((c) => <option key={c.id} value={`cat:${c.id}`}>Kategorie: {c.label}</option>)}
                          {itemOptions.map((i) => <option key={i.id} value={i.id}>{categoryLabel(i.category)}: {i.description.slice(0, 70)}</option>)}
                        </SelectInput>
                      </Field>
                      <Field label="An" hint="Mehrere Adressen mit Komma trennen">
                        <TextInput disabled={locked} value={edit.to_addr} placeholder="events@hotel.com"
                          onChange={(e) => setEdit({ ...edit, to_addr: e.target.value })} />
                      </Field>
                      <Field label="Kopie (CC)">
                        <TextInput disabled={locked} value={edit.cc_addr} placeholder="optional"
                          onChange={(e) => setEdit({ ...edit, cc_addr: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Betreff">
                      <TextInput disabled={locked} value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />
                    </Field>
                    <Field label="Mailtext" hint="Wird genau so gesendet (Klartext). Interne Hinweise gehören ins Feld darunter.">
                      <TextArea disabled={locked} rows={12} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
                    </Field>
                    {!locked && hasInternalMarker(edit.body) && (
                      <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: COLORS.danger }}>
                        <AlertTriangle className="h-3.5 w-3.5" /> Der Text enthält einen [INTERN]-Hinweis — so kann die Anfrage nicht gesendet werden.
                      </p>
                    )}
                    <Field label="Interne Notiz" hint="Wird nie mitgesendet — z. B. Kontaktperson, Preisannahme, Rückruf-Termin.">
                      <TextArea rows={2} value={edit.internal_note} onChange={(e) => setEdit({ ...edit, internal_note: e.target.value })} />
                    </Field>

                    <div className="flex flex-wrap items-center gap-2">
                      <SelectInput className="w-56" value={inq.status} onChange={(e) => save(inq.id, { status: e.target.value as InquiryStatus })}>
                        {INQUIRY_STATUSES.filter((s) => !(locked && s.id === 'entwurf')).map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </SelectInput>
                      <Button variant="secondary" size="sm" onClick={() => save(inq.id)} disabled={busy === inq.id}>
                        <Save className="h-3.5 w-3.5" /> Speichern
                      </Button>
                      {!locked && (
                        <Button
                          variant="accent" size="sm" onClick={() => send(inq.id)}
                          disabled={busy === inq.id || !mailReady || !check.ok}
                          title={check.ok ? `Senden aus ${mailbox}` : check.error}
                        >
                          {busy === inq.id ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                          {confirmSend === inq.id ? `Wirklich an ${edit.to_addr} senden?` : 'Senden'}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => duplicate(inq)} title="Als neuen Entwurf kopieren">
                        <Copy className="h-3.5 w-3.5" /> Duplizieren
                      </Button>
                      {!locked && (
                        <Button variant="ghost" size="sm" onClick={() => remove(inq.id)}>
                          <Trash2 className="h-3.5 w-3.5" /> {confirmDelete === inq.id ? 'Wirklich löschen?' : 'Löschen'}
                        </Button>
                      )}
                    </div>
                    {!locked && !check.ok && (
                      <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Senden noch nicht möglich: {check.error}</p>
                    )}
                    {inq.send_error && !locked && (
                      <p className="text-xs" style={{ color: COLORS.danger }}>Letzter Versandfehler: {inq.send_error}</p>
                    )}

                    {inq.history.length > 0 && (
                      <div className="border-t pt-2 text-[11px]" style={{ borderColor: COLORS.stroke, color: COLORS.textMuted }}>
                        <span className="font-bold uppercase tracking-wider">Verlauf</span>
                        <ul className="mt-1 space-y-0.5">
                          {[...inq.history].reverse().slice(0, 12).map((h, i) => (
                            <li key={i}>
                              {fmtDateTime(h.at)} · {h.action.startsWith('status:') ? `Status → ${inquiryStatusLabel(h.action.slice(7))}` : h.action}
                              {h.by ? ` · ${h.by}` : ''}{h.note ? ` · ${h.note}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Plus, Trash2, Check, Paperclip, Download, Clock, Mail, Send, StickyNote, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button, TextArea, Spinner, Badge, COLORS } from './ui';

type TaskStatus = 'offen' | 'in_arbeit' | 'warten_requester' | 'warten_dritte' | 'erledigt';

interface Task {
  id: string;
  ticket_number?: number | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'niedrig' | 'normal' | 'hoch';
  due_date: string | null;
  assignee_id?: string | null;
  booking_id?: string | null;
  created_by?: string | null;
  created_at?: string;
}
interface Subtask { id: string; title: string; done: number }
interface Att { id: string; filename: string; mime: string; size: number }
interface TimeEntry { id: string; minutes: number; note: string; work_date?: string }
interface Msg { id: string; direction: 'in' | 'out' | 'note'; from_email: string; to_email: string; subject: string; body: string; created_at: string; created_by: string }
interface Emp { id: string; name: string; email?: string; active?: boolean }

const PRIO_TONE = { niedrig: 'muted', normal: 'info', hoch: 'danger' } as const;
const STATUS_LABEL: Record<TaskStatus, string> = {
  offen: 'Offen',
  in_arbeit: 'In Arbeit',
  warten_requester: 'Wartet auf Rückmeldung (Requester)',
  warten_dritte: 'Wartet auf Extern (Dritte)',
  erledigt: 'Erledigt',
};

function fmtMin(m: number): string {
  if (!m) return '0 min';
  const h = Math.floor(m / 60), mm = m % 60;
  return h ? `${h}h ${mm}min` : `${mm} min`;
}

function ticketNo(n: number | null | undefined): string {
  return n && n > 0 ? `TASK-${String(n).padStart(5, '0')}` : '';
}

function todayISO(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
}

export default function TaskDrawer({ task, onClose, onChanged }: { task: Task; onClose: () => void; onChanged?: () => void }) {
  const [desc, setDesc] = useState(task.description || '');
  const [savingDesc, setSavingDesc] = useState(false);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [subs, setSubs] = useState<Subtask[]>([]);
  const [newSub, setNewSub] = useState('');
  const [loading, setLoading] = useState(true);
  const [atts, setAtts] = useState<Att[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mins, setMins] = useState('');
  const [timeNote, setTimeNote] = useState('');
  const [timeDate, setTimeDate] = useState(todayISO());
  const [times, setTimes] = useState<TimeEntry[]>([]);
  const [totalMin, setTotalMin] = useState(0);
  // Mail-Verlauf
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [mode, setMode] = useState<'email' | 'note'>('email');
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sending, setSending] = useState(false);
  const [msgErr, setMsgErr] = useState<string | null>(null);

  const loadSubs = () => {
    setLoading(true);
    fetch(`/api/admin/tasks/${task.id}/subtasks`)
      .then((r) => r.json())
      .then((r) => { if (r.success) setSubs(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  const loadAtts = () => {
    fetch(`/api/admin/tasks/${task.id}/attachments`).then((r) => r.json()).then((r) => { if (r.success) setAtts(r.data); }).catch(() => {});
  };
  const loadTimes = () => {
    fetch(`/api/admin/tasks/${task.id}/time`).then((r) => r.json()).then((r) => { if (r.success) { setTimes(r.data.entries); setTotalMin(r.data.totalMinutes); } }).catch(() => {});
  };
  const loadMsgs = () => {
    fetch(`/api/admin/tasks/${task.id}/messages`).then((r) => r.json()).then((r) => { if (r.success) setMsgs(r.data); }).catch(() => {});
  };
  useEffect(() => { loadSubs(); loadAtts(); loadTimes(); loadMsgs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [task.id]);

  // Mitarbeiter laden + Standard-Empfänger vorbelegen: Ticket-Ersteller > Assignee > erster aktiver.
  useEffect(() => {
    fetch('/api/admin/team').then((r) => r.json()).then((r) => {
      if (!r.success) return;
      const list: Emp[] = r.data.map((e: Emp) => ({ id: e.id, name: e.name, email: e.email, active: e.active }));
      setEmps(list);
      const creatorName = (task.created_by || '').trim().toLowerCase();
      const creator = creatorName ? list.find((e) => e.name.trim().toLowerCase() === creatorName) : null;
      const assignee = task.assignee_id ? list.find((e) => e.id === task.assignee_id) : null;
      const fallback = list.find((e) => e.active && e.email) || list.find((e) => e.email);
      setToEmail((creator?.email || assignee?.email || fallback?.email || '').trim());
    }).catch(() => {});
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [task.id]);

  const changeStatus = async (s: TaskStatus) => {
    setStatus(s);
    await fetch(`/api/admin/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: s }),
    }).catch(() => {});
    onChanged?.();
  };

  const saveDesc = async () => {
    setSavingDesc(true);
    try {
      await fetch(`/api/admin/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: desc }),
      });
      onChanged?.();
    } finally { setSavingDesc(false); }
  };

  const addSub = async () => {
    const t = newSub.trim();
    if (!t) return;
    setNewSub('');
    await fetch(`/api/admin/tasks/${task.id}/subtasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t }),
    });
    loadSubs();
  };
  const toggleSub = async (s: Subtask) => {
    setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, done: x.done ? 0 : 1 } : x)));
    await fetch(`/api/admin/tasks/${task.id}/subtasks`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subtaskId: s.id, done: !s.done }),
    });
  };
  const delSub = async (s: Subtask) => {
    setSubs((prev) => prev.filter((x) => x.id !== s.id));
    await fetch(`/api/admin/tasks/${task.id}/subtasks?subtaskId=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
  };
  const onUpload = async (f: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      await fetch(`/api/admin/tasks/${task.id}/attachments`, { method: 'POST', body: fd });
      loadAtts();
    } finally { setUploading(false); }
  };
  const delAtt = async (a: Att) => {
    setAtts((prev) => prev.filter((x) => x.id !== a.id));
    await fetch(`/api/admin/tasks/${task.id}/attachments?attId=${encodeURIComponent(a.id)}`, { method: 'DELETE' });
  };
  const bookTime = async () => {
    const m = Math.round(Number(mins));
    if (!m || m <= 0) return;
    const wd = timeDate;
    setMins(''); setTimeNote('');
    await fetch(`/api/admin/tasks/${task.id}/time`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: m, note: timeNote, work_date: wd }) });
    loadTimes();
  };
  const delTime = async (t: TimeEntry) => {
    setTimes((prev) => prev.filter((x) => x.id !== t.id));
    await fetch(`/api/admin/tasks/${task.id}/time?entryId=${encodeURIComponent(t.id)}`, { method: 'DELETE' });
    loadTimes();
  };
  const sendMsg = async () => {
    const text = msgBody.trim();
    if (!text) return;
    if (mode === 'email' && !toEmail.trim()) { setMsgErr('Bitte einen Empfänger angeben.'); return; }
    setSending(true); setMsgErr(null);
    try {
      const r = await fetch(`/api/admin/tasks/${task.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: mode, to: toEmail.trim(), subject: subject.trim() || undefined, body: text }),
      }).then((x) => x.json());
      if (r.success) { setMsgBody(''); setSubject(''); loadMsgs(); }
      else setMsgErr(r.error || 'Senden fehlgeschlagen.');
    } catch { setMsgErr('Verbindungsfehler.'); }
    finally { setSending(false); }
  };

  const doneCount = subs.filter((s) => s.done).length;
  const pct = subs.length ? Math.round((doneCount / subs.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {ticketNo(task.ticket_number) && (
              <span className="mb-1 inline-block rounded px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wide" style={{ background: COLORS.surfaceMuted, color: COLORS.accent }}>
                {ticketNo(task.ticket_number)}
              </span>
            )}
            <h2 className="text-lg font-bold" style={{ color: COLORS.navy }}>{task.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition hover:bg-gray-100" title="Schließen">
            <X className="h-5 w-5" style={{ color: COLORS.textMuted }} />
          </button>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value as TaskStatus)}
            className="rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none"
            style={{ borderColor: COLORS.stroke, color: COLORS.navy }}
            title="Status ändern"
          >
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <Badge tone={PRIO_TONE[task.priority]}>{task.priority}</Badge>
          {task.due_date && <span className="text-xs" style={{ color: COLORS.textMuted }}>📅 {task.due_date}</span>}
        </div>
        {(task.created_by || task.created_at) && (
          <p className="mb-6 text-xs" style={{ color: COLORS.textMuted }}>
            Erstellt{task.created_by ? ` von ${task.created_by}` : ''}{task.created_at ? ` am ${task.created_at.slice(0, 10)}` : ''}
          </p>
        )}

        {/* Beschreibung */}
        <div className="mb-6">
          <label className="mb-1 block text-xs font-semibold" style={{ color: COLORS.textMuted }}>Beschreibung</label>
          <TextArea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Notizen, Kontext, Links…" />
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={saveDesc} disabled={savingDesc || desc === (task.description || '')}>
              {savingDesc ? <Spinner className="h-4 w-4" /> : null} Speichern
            </Button>
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold" style={{ color: COLORS.textMuted }}>Subtasks</label>
            {subs.length > 0 && <span className="text-xs tabular-nums" style={{ color: COLORS.textMuted }}>{doneCount}/{subs.length}</span>}
          </div>
          {subs.length > 0 && (
            <div className="mb-3 h-1.5 rounded-full" style={{ background: COLORS.surfaceMuted }}>
              <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS.ok }} />
            </div>
          )}
          {loading ? (
            <div className="py-4 text-center"><Spinner /></div>
          ) : (
            <div className="space-y-1.5">
              {subs.map((s) => (
                <div key={s.id} className="group flex items-center gap-2">
                  <button
                    onClick={() => toggleSub(s)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition"
                    style={{ borderColor: s.done ? COLORS.ok : COLORS.stroke, background: s.done ? COLORS.ok : '#fff' }}
                  >
                    {s.done ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                  </button>
                  <span className="flex-1 text-sm" style={{ color: s.done ? COLORS.textMuted : COLORS.navy, textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</span>
                  <button onClick={() => delSub(s)} className="opacity-0 transition group-hover:opacity-100" title="Löschen">
                    <Trash2 className="h-3.5 w-3.5" style={{ color: COLORS.textMuted }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addSub(); }}
              placeholder="Neuer Subtask…"
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
              style={{ borderColor: COLORS.stroke }}
            />
            <Button size="sm" variant="ghost" onClick={addSub} disabled={!newSub.trim()}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Datei-Anhänge */}
        <div className="mt-6">
          <label className="mb-2 block text-xs font-semibold" style={{ color: COLORS.textMuted }}>Dateien</label>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f); }} />
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Spinner className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />} Datei anhängen
          </Button>
          {atts.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {atts.map((a) => (
                <div key={a.id} className="group flex items-center gap-2 text-sm">
                  <a href={`/api/admin/tasks/${task.id}/attachments?attId=${encodeURIComponent(a.id)}`} target="_blank" rel="noreferrer" className="flex flex-1 items-center gap-1.5 truncate hover:underline" style={{ color: COLORS.navy }}>
                    <Download className="h-3.5 w-3.5 shrink-0" style={{ color: COLORS.textMuted }} />
                    <span className="truncate">{a.filename}</span>
                  </a>
                  <button onClick={() => delAtt(a)} className="opacity-0 transition group-hover:opacity-100" title="Löschen"><Trash2 className="h-3.5 w-3.5" style={{ color: COLORS.textMuted }} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zeit */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold" style={{ color: COLORS.textMuted }}>Zeit</label>
            <span className="text-xs font-bold tabular-nums" style={{ color: COLORS.navy }}>{fmtMin(totalMin)} gebucht</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="date" value={timeDate} onChange={(e) => setTimeDate(e.target.value)} title="Datum der Leistung" className="rounded-lg border px-2 py-1.5 text-sm focus:outline-none" style={{ borderColor: COLORS.stroke }} />
            <input type="number" min={1} value={mins} onChange={(e) => setMins(e.target.value)} placeholder="Min" className="w-20 rounded-lg border px-3 py-1.5 text-sm focus:outline-none" style={{ borderColor: COLORS.stroke }} />
            <input value={timeNote} onChange={(e) => setTimeNote(e.target.value)} placeholder="Notiz (optional)" className="min-w-[120px] flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none" style={{ borderColor: COLORS.stroke }} />
            <Button size="sm" variant="secondary" onClick={bookTime} disabled={!mins || Number(mins) <= 0}><Clock className="h-4 w-4" /></Button>
          </div>
          {times.length > 0 && (
            <div className="mt-2 space-y-1 text-xs">
              {times.map((t) => (
                <div key={t.id} className="group flex items-center gap-2">
                  {t.work_date && <span className="tabular-nums" style={{ color: COLORS.textMuted }}>{t.work_date}</span>}
                  <span className="tabular-nums font-semibold" style={{ color: COLORS.navy }}>{fmtMin(t.minutes)}</span>
                  <span className="flex-1 truncate" style={{ color: COLORS.textMuted }}>{t.note}</span>
                  <button onClick={() => delTime(t)} className="opacity-0 transition group-hover:opacity-100" title="Löschen"><Trash2 className="h-3 w-3" style={{ color: COLORS.textMuted }} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mails & Verlauf */}
        <div className="mt-6">
          <label className="mb-2 block text-xs font-semibold" style={{ color: COLORS.textMuted }}>Mails & Verlauf</label>

          {/* Verlauf */}
          {msgs.length > 0 && (
            <div className="mb-3 space-y-2">
              {msgs.map((m) => {
                const isNote = m.direction === 'note';
                const isIn = m.direction === 'in';
                return (
                  <div key={m.id} className="rounded-lg border p-2.5 text-xs" style={{ borderColor: COLORS.stroke, background: isNote ? COLORS.surfaceMuted : '#fff' }}>
                    <div className="mb-1 flex items-center gap-1.5" style={{ color: COLORS.textMuted }}>
                      {isNote ? <StickyNote className="h-3.5 w-3.5" /> : isIn ? <ArrowDownLeft className="h-3.5 w-3.5" style={{ color: COLORS.ok }} /> : <ArrowUpRight className="h-3.5 w-3.5" style={{ color: COLORS.accent }} />}
                      <span className="font-semibold" style={{ color: COLORS.navy }}>
                        {isNote ? 'Notiz' : isIn ? `Von ${m.from_email}` : `An ${m.to_email}`}
                      </span>
                      <span className="ml-auto tabular-nums">{(m.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    {!isNote && m.subject && <div className="mb-0.5 font-medium" style={{ color: COLORS.navy }}>{m.subject}</div>}
                    <div className="whitespace-pre-wrap" style={{ color: COLORS.textMuted }}>{m.body}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Verfassen */}
          <div className="flex gap-1 mb-2">
            <Button size="sm" variant={mode === 'email' ? 'secondary' : 'ghost'} onClick={() => setMode('email')}><Mail className="h-3.5 w-3.5" /> Mail</Button>
            <Button size="sm" variant={mode === 'note' ? 'secondary' : 'ghost'} onClick={() => setMode('note')}><StickyNote className="h-3.5 w-3.5" /> Notiz</Button>
          </div>
          {mode === 'email' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <select
                  value={emps.some((e) => e.email === toEmail) ? toEmail : ''}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="min-w-[140px] flex-1 rounded-lg border px-2 py-1.5 text-sm focus:outline-none"
                  style={{ borderColor: COLORS.stroke }}
                >
                  <option value="">— Mitarbeiter —</option>
                  {emps.filter((e) => e.email).map((e) => <option key={e.id} value={e.email}>{e.name}</option>)}
                </select>
                <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="E-Mail-Adresse" className="min-w-[160px] flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none" style={{ borderColor: COLORS.stroke }} />
              </div>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`Betreff (optional) – Ticketnummer wird automatisch ergänzt`} className="w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none" style={{ borderColor: COLORS.stroke }} />
            </div>
          )}
          <TextArea rows={3} value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder={mode === 'email' ? 'Nachricht an den Empfänger… (@Name benachrichtigt Kolleg:innen)' : 'Interne Notiz… (@Name benachrichtigt Kolleg:innen)'} className="mt-2" />
          {msgErr && <p className="mt-1 text-xs" style={{ color: COLORS.danger }}>{msgErr}</p>}
          <div className="mt-2">
            <Button size="sm" variant="accent" onClick={sendMsg} disabled={sending || !msgBody.trim() || (mode === 'email' && !toEmail.trim())}>
              {sending ? <Spinner className="h-4 w-4" /> : mode === 'email' ? <Send className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {mode === 'email' ? 'Mail senden' : 'Notiz speichern'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

/**
 * TodayPanel.tsx — „Heute“: was für mich ansteht (Aufgaben, wartende Kunden,
 * neue Anfragen, Angebotsentwürfe, Posteingang). Jeder Eintrag lässt sich mit
 * einem Klick an die Faltin-KI geben.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Clock, UserRound, Inbox, ListTodo, FileSpreadsheet, Sparkles, AlertCircle, Moon, BellRing, Check, X, AlarmClock, Bot, Play } from 'lucide-react';
import { COLORS, Spinner } from '@/components/admin/ui';
import { api, jsonInit, relTime, type DaySignals, type AgentSummary } from './types';

type NudgeItem = DaySignals['nudges'][number];

/** Erinnerung der Faltin-KI mit direkten Aktionen (Urlaub entscheiden, angehen, später, erledigt). */
function NudgeCard({ n, onAsk, onDone }: { n: NudgeItem; onAsk: (text: string, context?: string) => void; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await fn(); onDone(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const decide = (status: 'genehmigt' | 'abgelehnt') => act(status, async () => {
    let comment: string | undefined;
    if (status === 'abgelehnt') {
      const c = window.prompt('Kurze Begründung für die Ablehnung (geht an die antragstellende Person):');
      if (c === null) throw new Error('Abgebrochen');
      comment = c;
    }
    await api(`/api/admin/vacation/${n.ref_id}`, jsonInit('PATCH', { status, comment }));
    await api(`/api/admin/workspace/nudges/${n.id}`, jsonInit('PATCH', { action: 'resolved' }));
  });
  const nudgeAction = (action: 'snooze' | 'dismiss') => act(action, () => api(`/api/admin/workspace/nudges/${n.id}`, jsonInit('PATCH', { action })));
  const vacation = n.kind === 'urlaub_genehmigen';
  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: n.priority === 'hoch' ? 'rgba(217,83,30,0.4)' : COLORS.stroke, background: n.priority === 'hoch' ? 'rgba(217,83,30,0.04)' : '#fff' }}>
      <Link href={n.action_url || '#'} className="block text-[13px] font-semibold hover:underline" style={{ color: COLORS.navy }}>{n.title}</Link>
      <p className="mt-0.5 whitespace-pre-line text-[11px] leading-snug" style={{ color: COLORS.textMuted }}>{n.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {vacation ? (
          <>
            <button onClick={() => decide('genehmigt')} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60" style={{ background: COLORS.ok }}>
              {busy === 'genehmigt' ? <Spinner className="h-3 w-3" /> : <Check className="h-3 w-3" />} Genehmigen
            </button>
            <button onClick={() => decide('abgelehnt')} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-60" style={{ borderColor: COLORS.stroke, color: COLORS.danger }}>
              {busy === 'abgelehnt' ? <Spinner className="h-3 w-3" /> : <X className="h-3 w-3" />} Ablehnen
            </button>
          </>
        ) : (
          <button onClick={() => onAsk(n.prompt, `Erinnerung: ${n.title}`)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: COLORS.accent }}>
            <Sparkles className="h-3 w-3" /> Angehen
          </button>
        )}
        {vacation && (
          <button onClick={() => onAsk(n.prompt, `Erinnerung: ${n.title}`)} className="rounded-lg px-1.5 py-1 text-[11px] font-medium hover:underline" style={{ color: COLORS.accent }}>KI fragen</button>
        )}
        <button onClick={() => nudgeAction('snooze')} disabled={!!busy} title="Bis morgen zurückstellen" className="ml-auto inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] hover:bg-gray-100" style={{ color: COLORS.textMuted }}>
          <AlarmClock className="h-3 w-3" /> Später
        </button>
        {!vacation && (
          <button onClick={() => nudgeAction('dismiss')} disabled={!!busy} title="Erledigt – nicht mehr erinnern" className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] hover:bg-gray-100" style={{ color: COLORS.textMuted }}>
            <Check className="h-3 w-3" /> Erledigt
          </button>
        )}
      </div>
      {error && error !== 'Abgebrochen' && <p className="mt-1 text-[11px]" style={{ color: COLORS.danger }}>{error}</p>}
    </div>
  );
}

function Section({ icon, title, count, children, empty }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode; empty?: string }) {
  return (
    <div className="border-b px-4 py-3" style={{ borderColor: COLORS.stroke }}>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
        {icon} {title}
        <span className="ml-auto rounded-full px-1.5 text-[10px]" style={{ background: count ? 'rgba(217,83,30,0.12)' : COLORS.surfaceMuted, color: count ? COLORS.accent : COLORS.textMuted }}>{count}</span>
      </div>
      {count === 0 && empty ? <p className="text-xs" style={{ color: COLORS.textMuted }}>{empty}</p> : <div className="space-y-1">{children}</div>}
    </div>
  );
}

function Row({ title, sub, tone, href, onAsk }: { title: string; sub: string; tone?: 'danger' | 'warn'; href?: string; onAsk: () => void }) {
  return (
    <div className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50">
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="block truncate text-[13px] font-medium hover:underline" style={{ color: COLORS.navy }}>{title}</Link>
        ) : (
          <div className="truncate text-[13px] font-medium" style={{ color: COLORS.navy }}>{title}</div>
        )}
        <div className="truncate text-[11px]" style={{ color: tone === 'danger' ? COLORS.danger : tone === 'warn' ? COLORS.warn : COLORS.textMuted }}>{sub}</div>
      </div>
      <button onClick={onAsk} className="mt-0.5 shrink-0 rounded-md p-1 opacity-60 transition hover:bg-white hover:opacity-100 group-hover:opacity-100 focus:opacity-100"
        title="Mit der Faltin-KI angehen" aria-label={`${title} mit der Faltin-KI angehen`}>
        <Sparkles className="h-3.5 w-3.5" style={{ color: COLORS.accent }} />
      </button>
    </div>
  );
}

export default function TodayPanel({ onAsk, refreshKey, isAdmin }: { onAsk: (text: string, context?: string) => void; refreshKey: number; isAdmin: boolean }) {
  const [s, setS] = useState<DaySignals | null>(null);
  const [agent, setAgent] = useState<AgentSummary | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setS(await api<DaySignals>('/api/admin/workspace/signals')); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
    api<AgentSummary>('/api/admin/workspace/agent').then(setAgent).catch(() => {});
  }, []);

  const runAgent = async () => {
    setAgentBusy(true);
    try { await api('/api/admin/workspace/agent', jsonInit('POST', { action: 'run' })); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setAgentBusy(false); }
  };

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, [load]);

  const dateLabel = s ? new Date(`${s.today}T12:00:00Z`).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const nothing = s && !s.nudges.length && !s.my_tasks.length && !s.waiting_customers.length && !s.new_requests.length && !s.stale_requests.length && !s.mail.needs_reply;

  return (
    <aside className="flex h-full min-h-0 flex-col bg-white" aria-label="Heute">
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: COLORS.stroke }}>
        <div>
          <div className="text-sm font-bold" style={{ color: COLORS.navy }}>Heute</div>
          <div className="text-[11px] capitalize" style={{ color: COLORS.textMuted }}>{dateLabel}</div>
        </div>
        <button onClick={load} disabled={loading} className="ml-auto rounded-lg p-1.5 hover:bg-gray-100" aria-label="Aktualisieren">
          {loading ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" style={{ color: COLORS.textMuted }} />}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <p className="m-4 flex items-center gap-1.5 text-xs" style={{ color: COLORS.danger }}><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
        {nothing && (
          <div className="m-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs" style={{ background: COLORS.surfaceMuted, color: COLORS.textMuted }}>
            <Moon className="h-4 w-4" /> Gerade ist bei dir nichts offen. Gute Gelegenheit für eine Werkzeug-Idee?
          </div>
        )}
        {s && (
          <>
            {s.nudges.length > 0 && (
              <div className="border-b px-4 py-3" style={{ borderColor: COLORS.stroke, background: 'rgba(217,83,30,0.03)' }}>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.accent }}>
                  <BellRing className="h-3.5 w-3.5" /> Die Faltin-KI erinnert dich
                  <span className="ml-auto rounded-full px-1.5 text-[10px]" style={{ background: 'rgba(217,83,30,0.12)' }}>{s.nudges.length}</span>
                </div>
                <div className="space-y-2">
                  {s.nudges.map((n) => <NudgeCard key={n.id} n={n} onAsk={onAsk} onDone={load} />)}
                </div>
              </div>
            )}
            <Section icon={<Clock className="h-3.5 w-3.5" />} title="Kunden warten" count={s.waiting_customers.length} empty="Niemand wartet auf eine Antwort.">
              {s.waiting_customers.map((w) => (
                <Row key={w.booking_id}
                  title={`${w.request_number || 'Anfrage'} · ${w.customer}`}
                  sub={`${w.package} · seit ${w.days_waiting} T.${w.mine ? ' · dir zugewiesen' : w.assignee ? ` · ${w.assignee}` : ' · niemand zuständig'}`}
                  tone={w.days_waiting >= 2 ? 'danger' : w.days_waiting >= 1 ? 'warn' : undefined}
                  href="/admin/crm"
                  onAsk={() => onAsk(`Lies den Verlauf von ${w.request_number || w.booking_id} und entwirf eine Antwort an den Kunden.`, `Heute: Kunde wartet (${w.request_number})`)} />
              ))}
            </Section>
            <Section icon={<ListTodo className="h-3.5 w-3.5" />} title="Meine Aufgaben" count={s.my_tasks.length} empty="Keine offenen Aufgaben.">
              {s.my_tasks.map((t) => (
                <Row key={t.id}
                  title={`${t.ticket_no} · ${t.title}`}
                  sub={`${t.status.replace('_', ' ')}${t.due_date ? ` · fällig ${new Date(`${t.due_date}T12:00:00Z`).toLocaleDateString('de-CH')}` : ''}${t.priority === 'hoch' ? ' · hoch' : ''}`}
                  tone={t.overdue ? 'danger' : t.priority === 'hoch' ? 'warn' : undefined}
                  href={`/admin/aufgaben/${t.id}`}
                  onAsk={() => onAsk(`Hilf mir bei ${t.ticket_no} „${t.title}“ (task_id ${t.id}). Was ist der nächste Schritt?`, `Heute: Aufgabe ${t.ticket_no}`)} />
              ))}
            </Section>
            <Section icon={<UserRound className="h-3.5 w-3.5" />} title="Neue Anfragen" count={s.new_requests.length} empty="Keine neuen, unverteilten Anfragen.">
              {s.new_requests.map((n) => (
                <Row key={n.booking_id}
                  title={`${n.request_number || 'Anfrage'} · ${n.customer}`}
                  sub={`${n.package} · ${n.persons} Pers. · ${relTime(n.created_at)}`}
                  href="/admin/crm"
                  onAsk={() => onAsk(`Schau dir die Anfrage ${n.request_number || n.booking_id} an und schlag mir vor, wie wir sie angehen – brauchen wir eine Kalkulation und einen Angebotsentwurf?`, `Heute: neue Anfrage ${n.request_number}`)} />
              ))}
            </Section>
            {s.stale_requests.length > 0 && (
              <Section icon={<AlertCircle className="h-3.5 w-3.5" />} title="Ruhen zu lange" count={s.stale_requests.length}>
                {s.stale_requests.map((r) => (
                  <Row key={r.booking_id} title={`${r.request_number || 'Anfrage'} · ${r.customer}`} sub={`${r.package} · seit ${r.days_idle} Tagen ohne Bewegung`} tone="warn" href="/admin/crm"
                    onAsk={() => onAsk(`${r.request_number || r.booking_id} ruht seit ${r.days_idle} Tagen. Lies den Verlauf und schlag ein Nachfassen vor.`, 'Heute: ruhende Anfrage')} />
                ))}
              </Section>
            )}
            {s.offer_drafts.length > 0 && (
              <Section icon={<FileSpreadsheet className="h-3.5 w-3.5" />} title="Angebote im Entwurf" count={s.offer_drafts.length}>
                {s.offer_drafts.map((d) => (
                  <Row key={d.id} title={`${d.offer_number || 'Entwurf'} · ${d.title}`} sub={`${d.customer || 'ohne Kunde'} · ${relTime(d.updated_at)}`} href={`/admin/kalkulation/${d.id}`}
                    onAsk={() => onAsk(`Prüf das Angebot ${d.offer_number || d.id}: Ist es vollständig und plausibel? Was fehlt noch, bevor es raus kann?`, 'Heute: Angebotsentwurf')} />
                ))}
              </Section>
            )}
            <Section icon={<Inbox className="h-3.5 w-3.5" />} title="Posteingang" count={s.mail.needs_reply} empty={s.mail.open ? `${s.mail.open} offene Mails, keine braucht dringend eine Antwort.` : 'Alles abgearbeitet.'}>
              <Row title={`${s.mail.needs_reply} Mails brauchen eine Antwort`} sub={`${s.mail.high} davon dringend · ${s.mail.open} offen`} tone={s.mail.high ? 'warn' : undefined}
                onAsk={() => onAsk('Geh mit mir den Posteingang durch: Welche Mails brauchen heute eine Antwort? Fang mit der dringendsten an.', 'Heute: Posteingang')} />
            </Section>
            {s.unassigned_tasks.length > 0 && (
              <Section icon={<ListTodo className="h-3.5 w-3.5" />} title="Aufgaben ohne Zuständigkeit" count={s.unassigned_tasks.length}>
                {s.unassigned_tasks.map((t) => (
                  <Row key={t.id} title={`${t.ticket_no} · ${t.title}`} sub={`seit ${relTime(t.created_at)}`} href={`/admin/aufgaben/${t.id}`}
                    onAsk={() => onAsk(`Worum geht es bei ${t.ticket_no} „${t.title}“ (task_id ${t.id}) und wer sollte das übernehmen?`, 'Heute: Aufgabe ohne Zuständigkeit')} />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
      {agent && (
        <div className="flex items-center gap-2 border-t px-4 py-2 text-[11px]" style={{ borderColor: COLORS.stroke, color: COLORS.textMuted }}
          title={agent.last_run ? `Letzter Lauf ${relTime(agent.last_run.finished_at)}${agent.last_run.errors.length ? ` · ${agent.last_run.errors[0]}` : ''}` : 'Noch kein Lauf'}>
          <Bot className="h-3.5 w-3.5 shrink-0" style={{ color: agent.enabled ? COLORS.ok : COLORS.textMuted }} />
          <span className="min-w-0 flex-1 truncate">
            {agent.enabled
              ? `KI im Hintergrund (24 h): ${agent.today.mails_triaged} Mails sortiert · ${agent.today.drafts_prepared} Entwürfe · ${agent.today.notifications} Erinnerungen`
              : 'Hintergrund-Agent ist ausgeschaltet'}
          </span>
          {isAdmin && (
            <button onClick={runAgent} disabled={agentBusy} title="Agent jetzt laufen lassen" className="rounded p-1 hover:bg-gray-100" aria-label="Agent jetzt laufen lassen">
              {agentBusy ? <Spinner className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

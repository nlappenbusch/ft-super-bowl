'use client';

/**
 * ContextPanel — rechts neben der Mail: was gehört dazu? Kunde, CRM-Anfragen, Tickets,
 * verwandte Mails (über alle freigegebenen Postfächer) und die KI-Analyse, aus der man mit
 * einem Klick Ticket, CRM-Anfrage oder Kunde anlegt bzw. den Antwortentwurf übernimmt.
 */
import { Fragment, useEffect, useState } from 'react';
import {
  User, Briefcase, Ticket, Mails, Sparkles, Loader2, ExternalLink, Link2, Unlink, Plus, Check, X,
  AlertTriangle, CalendarDays, Users, Wallet, Building2, Phone, MessageSquareReply, RefreshCw,
} from 'lucide-react';
import type { MailboxInfo, MailContext, MailDetail, MailExtraction, MailSummary } from './types';
import { api, listTime, mailboxColor, shortMailbox } from './util';

interface Props {
  detail: MailDetail;
  mailboxes: MailboxInfo[];
  aiReady: boolean;
  employees: Array<{ id: string; name: string; email: string }>;
  onOpenMessage: (m: MailSummary) => void;
  onUseDraft: (text: string, extraction: MailExtraction) => void;
  onExtraction: (x: MailExtraction | null) => void;
  onToast: (msg: string) => void;
  onClose: () => void;
}

const REASON: Record<string, string> = { nummer: 'Nummer in der Mail', absender: 'gleicher Absender', link: 'verknüpft', anfrage: 'über die Anfrage' };
const URG: Record<string, { bg: string; fg: string; label: string }> = {
  hoch: { bg: '#fee2e2', fg: '#b91c1c', label: 'dringend' },
  normal: { bg: '#e0f2fe', fg: '#075985', label: 'normal' },
  niedrig: { bg: '#f1f5f9', fg: '#475569', label: 'kann warten' },
};
const chf = (n: number) => new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(n || 0);

function Section({ icon: Icon, title, count, children, action }: { icon: typeof User; title: string; count?: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-b px-4 py-3" style={{ borderColor: '#eef1f5' }}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <h3 className="flex-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500">{title}{count ? ` · ${count}` : ''}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ContextPanel(p: Props) {
  const d = p.detail;
  const [ctx, setCtx] = useState<MailContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ex, setEx] = useState<MailExtraction | null>(null);
  const [exBusy, setExBusy] = useState(false);
  const [exErr, setExErr] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    api<{ context: MailContext }>(`context?mb=${encodeURIComponent(d.mailbox)}&id=${encodeURIComponent(d.id)}`)
      .then((r) => { if (alive) setCtx(r.context); })
      .catch((e) => { if (alive) setErr((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [d.mailbox, d.id, reload]);

  useEffect(() => { setEx(null); setExErr(null); setDone({}); p.onExtraction(null); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.id]);

  const analyse = async () => {
    setExBusy(true); setExErr(null);
    try {
      const r = await api<{ extraction: MailExtraction }>('ai', { json: { action: 'extract', mb: d.mailbox, id: d.id } });
      setEx(r.extraction); p.onExtraction(r.extraction);
    } catch (e) {
      setExErr((e as Error).message);
    } finally {
      setExBusy(false);
    }
  };

  const act = async (key: string, body: Record<string, unknown>, okMsg: (r: Record<string, unknown>) => string) => {
    setBusy(key);
    try {
      const r = await api<Record<string, unknown>>('actions', { json: { mb: d.mailbox, id: d.id, ...body } });
      const msg = okMsg(r);
      setDone((x) => ({ ...x, [key]: msg }));
      p.onToast(msg);
      setReload((n) => n + 1);
      return r;
    } catch (e) {
      p.onToast(`Fehler: ${(e as Error).message}`);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const linkRequest = async () => {
    const v = linkInput.trim().toUpperCase();
    if (!v) return;
    const hit = ctx?.requests.find((r) => r.request_number.toUpperCase() === v || r.booking_number?.toUpperCase() === v);
    if (!hit) { p.onToast('Anfrage nicht im Kontext gefunden — Nummer in den Betreff schreiben oder im CRM verknüpfen.'); return; }
    await act(`link-${hit.id}`, { action: 'link', target_type: 'request', target_id: hit.id, label: hit.request_number }, () => `Mit ${hit.request_number} verknüpft`);
    setLinkInput('');
  };

  const linkedIds = new Set((ctx?.links || []).map((l) => `${l.target_type}:${l.target_id}`));

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: '#eef1f5' }}>
        <span className="text-[13px] font-semibold" style={{ color: '#143047' }}>Zusammenhang</span>
        <span className="flex-1" />
        <button onClick={() => setReload((n) => n + 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100" title="Neu laden"><RefreshCw className="h-3.5 w-3.5" /></button>
        <button onClick={p.onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" title="Schliessen"><X className="h-4 w-4" /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* KI-Analyse */}
        {p.aiReady && (
          <section className="border-b px-4 py-3" style={{ borderColor: '#eef1f5', background: ex ? '#faf8ff' : undefined }}>
            {!ex ? (
              <button onClick={analyse} disabled={exBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium text-violet-700 transition hover:bg-violet-50 disabled:opacity-70"
                style={{ borderColor: '#ddd6fe' }}>
                {exBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {exBusy ? 'Lese die Mail …' : 'Mit KI auswerten & übernehmen'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-[12px] font-semibold text-violet-800">{ex.typ}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: URG[ex.dringlichkeit]?.bg, color: URG[ex.dringlichkeit]?.fg }}>{URG[ex.dringlichkeit]?.label}</span>
                  {ex.stimmung === 'kritisch' && <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800"><AlertTriangle className="h-3 w-3" /> kritisch</span>}
                </div>
                <p className="text-[13px] leading-relaxed text-slate-700">{ex.zusammenfassung}</p>

                {(ex.reise.event || ex.reise.von || ex.reise.personen > 0) && (
                  <div className="grid grid-cols-2 gap-1.5 text-[12px]">
                    {ex.reise.event && <div className="col-span-2 rounded-lg bg-white px-2.5 py-1.5"><span className="text-slate-400">Event</span><div className="font-medium text-slate-800">{ex.reise.event}{ex.reise.ort ? `, ${ex.reise.ort}` : ''}</div></div>}
                    {(ex.reise.von || ex.reise.bis) && <div className="rounded-lg bg-white px-2.5 py-1.5"><CalendarDays className="mb-0.5 h-3 w-3 text-slate-400" /><div className="text-slate-700">{ex.reise.von}{ex.reise.bis ? ` – ${ex.reise.bis}` : ''}</div></div>}
                    {ex.reise.personen > 0 && <div className="rounded-lg bg-white px-2.5 py-1.5"><Users className="mb-0.5 h-3 w-3 text-slate-400" /><div className="text-slate-700">{ex.reise.personen} Pers.{ex.reise.zimmer ? `, ${ex.reise.zimmer}` : ''}</div></div>}
                    {ex.reise.budget && <div className="col-span-2 rounded-lg bg-white px-2.5 py-1.5"><Wallet className="mb-0.5 inline h-3 w-3 text-slate-400" /> <span className="text-slate-700">{ex.reise.budget}</span></div>}
                    {ex.reise.wuensche.length > 0 && <div className="col-span-2 rounded-lg bg-white px-2.5 py-1.5 text-slate-700">{ex.reise.wuensche.join(' · ')}</div>}
                  </div>
                )}

                {ex.fakten.length > 0 && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                    {ex.fakten.map((f, i) => (<Fragment key={i}><dt className="text-slate-400">{f.label}</dt><dd className="text-slate-700">{f.wert}</dd></Fragment>))}
                  </dl>
                )}

                {(ex.kunde.nachname || ex.kunde.email) && (
                  <div className="rounded-lg bg-white px-2.5 py-2 text-[12px] text-slate-700">
                    <div className="font-medium">{[ex.kunde.anrede, ex.kunde.vorname, ex.kunde.nachname].filter(Boolean).join(' ')}{ex.kunde.firma ? ` · ${ex.kunde.firma}` : ''}</div>
                    <div className="text-slate-500">{[ex.kunde.email, ex.kunde.telefon, ex.kunde.adresse].filter(Boolean).join(' · ')}</div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {ex.vorgeschlagene_antwort && (
                    <button onClick={() => p.onUseDraft(ex.vorgeschlagene_antwort, ex)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white" style={{ background: '#d9531e' }}>
                      <MessageSquareReply className="h-3.5 w-3.5" /> Antwortentwurf übernehmen
                    </button>
                  )}
                  {!ctx?.requests.some((r) => r.reason !== 'anfrage') && (
                    done.req ? <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12px] text-emerald-700"><Check className="h-3.5 w-3.5" /> {done.req}</span> : (
                      <button disabled={busy === 'req'} onClick={() => void act('req', { action: 'create_request', kunde: ex.kunde, reise: ex.reise, zusammenfassung: ex.zusammenfassung }, (r) => `Anfrage ${(r.request as { request_number: string }).request_number} angelegt`)}
                        className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50" style={{ borderColor: '#e3e8ef' }}>
                        {busy === 'req' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Briefcase className="h-3.5 w-3.5" />} Als CRM-Anfrage
                      </button>
                    )
                  )}
                  {!ctx?.customers.length && (ex.kunde.email || d.from.address) && (
                    done.cust ? <span className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12px] text-emerald-700"><Check className="h-3.5 w-3.5" /> {done.cust}</span> : (
                      <button disabled={busy === 'cust'} onClick={() => void act('cust', { action: 'save_customer', kunde: { ...ex.kunde, email: ex.kunde.email || d.from.address } }, () => 'Kunde gespeichert')}
                        className="flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50" style={{ borderColor: '#e3e8ef' }}>
                        {busy === 'cust' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <User className="h-3.5 w-3.5" />} Kunde speichern
                      </button>
                    )
                  )}
                </div>

                {ex.aufgaben.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Zu tun</div>
                    <ul className="space-y-1">
                      {ex.aufgaben.map((a, i) => {
                        const key = `task${i}`;
                        return (
                          <li key={i} className="flex items-start gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12.5px]">
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-slate-800">{a.titel}</span>
                              {(a.beschreibung || a.faellig) && <span className="block text-[11.5px] text-slate-500">{a.beschreibung}{a.faellig ? ` · bis ${a.faellig}` : ''}</span>}
                            </span>
                            {done[key] ? <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-emerald-700"><Check className="h-3.5 w-3.5" /> {done[key]}</span> : (
                              <button disabled={busy === key} title="Als Ticket anlegen"
                                onClick={() => void act(key, { action: 'create_task', title: a.titel, description: a.beschreibung, due_date: /^\d{4}-\d{2}-\d{2}$/.test(a.faellig) ? a.faellig : undefined, priority: a.prioritaet }, (r) => `${(r.task as { ticket: string }).ticket}`)}
                                className="flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] text-slate-600 hover:bg-slate-50" style={{ borderColor: '#e3e8ef' }}>
                                {busy === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Ticket
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <button onClick={analyse} disabled={exBusy} className="text-[11.5px] text-violet-600 hover:underline">{exBusy ? 'Werte neu aus …' : 'Neu auswerten'}</button>
              </div>
            )}
            {exErr && <div className="mt-2 text-[12px] text-red-600">{exErr}</div>}
          </section>
        )}

        {loading && !ctx ? (
          <div className="flex items-center gap-2 px-4 py-6 text-[12.5px] text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Suche Kunde, Anfragen, Tickets …</div>
        ) : err ? (
          <div className="px-4 py-4 text-[12.5px] text-red-600">{err}</div>
        ) : ctx ? (
          <>
            <Section icon={User} title="Kunde" count={ctx.customers.length}>
              {ctx.customers.length ? ctx.customers.map((c) => (
                <a key={c.id} href={c.url} target="_blank" rel="noopener" className="group mb-1.5 block rounded-xl border px-3 py-2 hover:border-slate-300" style={{ borderColor: '#eef1f5' }}>
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 truncate text-[13px] font-semibold text-slate-800">{c.name || c.emails[0]}</span>
                    <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-slate-500" />
                  </div>
                  {(c.company || c.city) && <div className="flex items-center gap-1 text-[11.5px] text-slate-500"><Building2 className="h-3 w-3" /> {[c.company, c.city].filter(Boolean).join(', ')}</div>}
                  {c.phone && <div className="flex items-center gap-1 text-[11.5px] text-slate-500"><Phone className="h-3 w-3" /> {c.phone}</div>}
                  <div className="mt-1.5 flex gap-3 text-[11.5px]">
                    <span><b className="text-slate-800">{c.bookings}</b> <span className="text-slate-500">Anfragen</span></span>
                    <span><b className="text-slate-800">{c.booked}</b> <span className="text-slate-500">gebucht</span></span>
                    {c.revenue > 0 && <span><b className="text-slate-800">{chf(c.revenue)}</b> <span className="text-slate-500">Umsatz</span></span>}
                  </div>
                </a>
              )) : <div className="text-[12px] text-slate-400">Kein Kunde zu {d.from.address} gefunden.</div>}
            </Section>

            <Section icon={Briefcase} title="Anfragen & Buchungen" count={ctx.requests.length}>
              {ctx.requests.map((r) => (
                <div key={r.id} className="mb-1.5 flex items-start gap-2 rounded-xl border px-3 py-2" style={{ borderColor: '#eef1f5' }}>
                  <a href={r.url} target="_blank" rel="noopener" className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <code className="rounded bg-orange-50 px-1 text-[11px] font-semibold text-[#b5461a]">{r.request_number}</code>
                      {r.booking_number && <code className="rounded bg-slate-100 px-1 text-[11px] text-slate-600">{r.booking_number}</code>}
                      <span className="text-[11px] text-slate-400">{r.status}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] font-medium text-slate-800">{r.title || '—'}</div>
                    <div className="text-[11.5px] text-slate-500">
                      {[r.start_date, r.persons ? `${r.persons} Pers.` : '', r.total ? `CHF ${chf(r.total)}` : ''].filter(Boolean).join(' · ')}
                      <span className="text-slate-400"> · {REASON[r.reason] || r.reason}</span>
                    </div>
                  </a>
                  {!linkedIds.has(`request:${r.id}`) && (
                    <button disabled={busy === `link-${r.id}`} onClick={() => void act(`link-${r.id}`, { action: 'link', target_type: 'request', target_id: r.id, label: r.request_number }, () => `Mail an ${r.request_number} gehängt`)}
                      title="Mail an diese Anfrage hängen (erscheint im CRM-Verlauf)" className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      {busy === `link-${r.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              ))}
              {!ctx.requests.length && <div className="text-[12px] text-slate-400">Keine Anfrage erkannt.</div>}
              {ctx.requests.length > 0 && (
                <div className="mt-1 flex gap-1">
                  <input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void linkRequest()} placeholder="RQ-Nummer verknüpfen" className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-[12px] outline-none focus:border-slate-400" style={{ borderColor: '#e3e8ef' }} />
                </div>
              )}
            </Section>

            <Section icon={Ticket} title="Tickets" count={ctx.tasks.length}
              action={done.ticket ? <span className="text-[11px] text-emerald-700">{done.ticket}</span> : (
                <button disabled={busy === 'ticket'} onClick={() => void act('ticket', { action: 'create_task', title: d.subject }, (r) => `${(r.task as { ticket: string }).ticket} angelegt`)}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Aus dieser Mail ein Ticket machen">
                  {busy === 'ticket' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Ticket
                </button>
              )}>
              {ctx.tasks.map((t) => (
                <a key={t.id} href={t.url} target="_blank" rel="noopener" className="mb-1.5 block rounded-xl border px-3 py-2 hover:border-slate-300" style={{ borderColor: '#eef1f5' }}>
                  <div className="flex items-center gap-1.5">
                    <code className="rounded bg-slate-100 px-1 text-[11px] font-semibold text-slate-700">{t.ticket}</code>
                    <span className="text-[11px] text-slate-400">{t.status.replace('_', ' ')}{t.priority === 'hoch' ? ' · hoch' : ''}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[12.5px] text-slate-800">{t.title}</div>
                </a>
              ))}
              {!ctx.tasks.length && <div className="text-[12px] text-slate-400">Kein Ticket dazu.</div>}
            </Section>

            {ctx.links.length > 0 && (
              <Section icon={Link2} title="Verknüpft">
                {ctx.links.map((l) => (
                  <div key={l.id} className="mb-1 flex items-center gap-2 text-[12px] text-slate-600">
                    <span className="flex-1 truncate">{l.target_label || l.target_id} <span className="text-slate-400">· {l.created_by}</span></span>
                    <button onClick={() => void act(`unlink-${l.id}`, { action: 'unlink', link_id: l.id }, () => 'Verknüpfung gelöst')} className="rounded p-0.5 text-slate-400 hover:bg-slate-100" title="Verknüpfung lösen"><Unlink className="h-3 w-3" /></button>
                  </div>
                ))}
              </Section>
            )}

            <Section icon={Mails} title="Verwandte Mails" count={ctx.related.length}>
              <div className="space-y-0.5">
                {ctx.related.map((m) => (
                  <button key={`${m.mailbox}|${m.id}`} onClick={() => p.onOpenMessage(m)} className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-slate-50">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: mailboxColor(m.mailbox, p.mailboxes) }} title={m.mailbox} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className={`truncate text-[12.5px] ${m.isRead ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>{m.from.name || m.from.address}</span>
                        <span className="ml-auto shrink-0 text-[10.5px] text-slate-400">{listTime(m.receivedAt)}</span>
                      </span>
                      <span className="block truncate text-[12px] text-slate-500">{m.subject}</span>
                      {p.mailboxes.length > 1 && <span className="block truncate text-[10.5px] text-slate-400">{shortMailbox(p.mailboxes.find((x) => x.address === m.mailbox) || { name: '', address: m.mailbox })}</span>}
                    </span>
                  </button>
                ))}
                {!ctx.related.length && <div className="text-[12px] text-slate-400">Nichts Verwandtes gefunden.</div>}
              </div>
            </Section>
          </>
        ) : null}
      </div>
    </aside>
  );
}

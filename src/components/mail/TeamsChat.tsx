'use client';

/**
 * TeamsChat — prüft, wer aus dem Mailverlauf in Teams erreichbar ist, und wechselt per Klick
 * in den Chat (1:1 mit dem Absender oder Gruppenchat mit allen Beteiligten, Betreff als Thema).
 */
import { useEffect, useRef, useState } from 'react';
import { MessagesSquare, ChevronDown, Loader2, Users } from 'lucide-react';
import type { MailAddress } from './types';
import { api } from './util';

type Status = 'intern' | 'intern_ohne_teams' | 'gast' | 'extern' | 'unbekannt';
interface Hit { email: string; name: string; status: Status; chatId: string }

const LABEL: Record<Status, { text: string; dot: string; hint: string }> = {
  intern: { text: 'Team', dot: '#16a34a', hint: 'Faltin-Kollegin/-Kollege mit Teams' },
  gast: { text: 'Gast', dot: '#16a34a', hint: 'Gast im Faltin-Teams' },
  extern: { text: 'extern', dot: '#d97706', hint: 'Externe Firma: klappt, wenn sie Chats mit anderen Firmen erlaubt (Teams-Föderation)' },
  intern_ohne_teams: { text: 'ohne Teams', dot: '#94a3b8', hint: 'Im Faltin-Verzeichnis, aber ohne Teams-Lizenz' },
  unbekannt: { text: '?', dot: '#94a3b8', hint: 'Konnte nicht geprüft werden' },
};
const reachable = (s: Status) => s === 'intern' || s === 'gast' || s === 'extern';

function chatLink(ids: string[], subject: string): string {
  const sp = new URLSearchParams({ users: ids.join(',') });
  if (ids.length > 1 && subject) sp.set('topicName', subject.slice(0, 80));
  if (subject) sp.set('message', `Zur Mail «${subject.slice(0, 120)}»: `);
  return `https://teams.microsoft.com/l/chat/0/0?${sp.toString()}`;
}

export default function TeamsChat({ from, others, own, subject }: { from: MailAddress; others: MailAddress[]; own: string[]; subject: string }) {
  const ownSet = new Set(own.map((x) => x.toLowerCase()));
  const people = [from, ...others].filter((a, i, l) => a.address && !ownSet.has(a.address.toLowerCase()) && l.findIndex((b) => b.address.toLowerCase() === a.address.toLowerCase()) === i);
  const key = people.map((p) => p.address.toLowerCase()).join(',');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHits(null);
    if (!key) return;
    let alive = true;
    api<{ people: Hit[] }>(`teams?emails=${encodeURIComponent(key)}`)
      .then((r) => { if (alive) setHits(r.people); })
      .catch(() => { if (alive) setHits([]); });
    return () => { alive = false; };
  }, [key]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!people.length) return null;
  const byMail = new Map((hits || []).map((h) => [h.email, h]));
  const sender = byMail.get(from.address.toLowerCase());
  const ok = (hits || []).filter((h) => reachable(h.status));
  const primary = sender && reachable(sender.status) ? sender : ok[0];
  const nameOf = (h: Hit) => people.find((p) => p.address.toLowerCase() === h.email)?.name || h.name || h.email;

  return (
    <div ref={box} className="relative inline-flex">
      {hits === null ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] text-slate-400" style={{ borderColor: '#e5e8ed' }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Teams …
        </span>
      ) : primary ? (
        <>
          <a href={chatLink([primary.chatId], subject)} target="_blank" rel="noopener"
            title={`${LABEL[primary.status].hint}\nÖffnet den Chat in Teams, der Betreff steht schon drin.`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-l-lg border px-2 py-1 text-[12px] font-medium hover:bg-[#f3f2fb]"
            style={{ borderColor: '#d4d1f0', color: '#4b47b0' }}>
            <MessagesSquare className="h-3.5 w-3.5" />
            Chat mit {nameOf(primary).split(/\s+/)[0]}
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LABEL[primary.status].dot }} />
          </a>
          <button onClick={() => setOpen((o) => !o)} className="rounded-r-lg border border-l-0 px-1 hover:bg-[#f3f2fb]" style={{ borderColor: '#d4d1f0', color: '#4b47b0' }} title="Weitere Personen / Gruppenchat">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] text-slate-400" style={{ borderColor: '#e5e8ed' }} title="Niemand aus dieser Mail ist in Teams erreichbar">
          <MessagesSquare className="h-3.5 w-3.5" /> nicht in Teams
        </button>
      )}

      {open && hits && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[320px] overflow-hidden rounded-xl border bg-white py-1 shadow-xl" style={{ borderColor: '#e3e8ef' }}>
          <div className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">In Teams weiterreden</div>
          {hits.map((h) => (
            <a key={h.email} href={reachable(h.status) ? chatLink([h.chatId], subject) : undefined} target="_blank" rel="noopener"
              className={`flex items-center gap-2 px-3 py-1.5 text-[12.5px] ${reachable(h.status) ? 'hover:bg-slate-50' : 'cursor-default opacity-60'}`}
              title={LABEL[h.status].hint}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: LABEL[h.status].dot }} />
              <span className="min-w-0 flex-1 truncate text-slate-800">{nameOf(h)}</span>
              <span className="shrink-0 text-[11px] text-slate-500">{LABEL[h.status].text}</span>
            </a>
          ))}
          {ok.length > 1 && (
            <a href={chatLink(ok.map((h) => h.chatId), subject)} target="_blank" rel="noopener"
              className="mt-1 flex items-center gap-2 border-t px-3 py-2 text-[12.5px] font-medium hover:bg-[#f3f2fb]" style={{ borderColor: '#eef1f5', color: '#4b47b0' }}>
              <Users className="h-3.5 w-3.5" /> Gruppenchat mit allen {ok.length} starten
            </a>
          )}
          <div className="border-t px-3 py-1.5 text-[11px] leading-snug text-slate-500" style={{ borderColor: '#eef1f5' }}>
            Grün = sicher erreichbar. Orange = externe Firma, klappt nur, wenn sie Chats mit anderen Firmen zulässt.
          </div>
        </div>
      )}
    </div>
  );
}

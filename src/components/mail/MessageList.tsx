'use client';

import { useEffect, useRef } from 'react';
import { Paperclip, Flag, Search, Sparkles, X, Loader2, ArrowUpRight, CornerDownRight } from 'lucide-react';
import type { MailboxInfo, MailSummary } from './types';
import { dayGroup, listTime, mailboxColor, shortMailbox, refsIn } from './util';

export type ListFilter = 'all' | 'unread' | 'flagged' | 'attachments';

interface AiAnswer { question: string; answer: string; sources: MailSummary[]; steps: string[] }

interface Props {
  title: string;
  subtitle: string;
  mailboxes: MailboxInfo[];
  showMailbox: boolean;
  messages: MailSummary[];
  loading: boolean;
  more: boolean;
  selectedKey: string | null;
  filter: ListFilter;
  query: string;
  aiMode: boolean;
  aiReady: boolean;
  aiBusy: boolean;
  aiAnswer: AiAnswer | null;
  aiStep: string;
  onQuery: (q: string) => void;
  onSubmitQuery: () => void;
  onClearQuery: () => void;
  onToggleAi: () => void;
  onFilter: (f: ListFilter) => void;
  onOpen: (m: MailSummary) => void;
  onMore: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

const FILTERS: Array<{ k: ListFilter; label: string }> = [
  { k: 'all', label: 'Alle' },
  { k: 'unread', label: 'Ungelesen' },
  { k: 'flagged', label: 'Markiert' },
  { k: 'attachments', label: 'Mit Anhang' },
];

const SEARCH_HINTS = ['von:hotel', 'betreff:rechnung', 'RQ-', 'anhang', '"Ryder Cup"'];
const AI_HINTS = ['Wann hat der Kunde Müller zuletzt geschrieben?', 'Welche Hotels haben fürs Oktoberfest zugesagt?', 'Offene Zahlungen aus diesem Monat?'];

/** Einfache Markdown-Darstellung für KI-Antworten (fett, Listen, Absätze). */
function Md({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*[-*•]\s/.test(l))) {
          return <ul key={i} className="list-disc space-y-0.5 pl-4">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s/, ''))}</li>)}</ul>;
        }
        return <p key={i}>{lines.map((l, j) => <span key={j}>{inline(l.replace(/^#+\s*/, ''))}{j < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}

export default function MessageList(p: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinel.current || !p.more) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && !p.loading) p.onMore(); }, { root: listRef.current, rootMargin: '300px' });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [p.more, p.loading, p.onMore, p.messages.length]);

  let lastGroup = '';

  return (
    <section className="flex h-full min-h-0 flex-col bg-white">
      {/* Suche */}
      <div className="border-b px-3 pb-2.5 pt-3" style={{ borderColor: '#e5e8ed' }}>
        <form
          onSubmit={(e) => { e.preventDefault(); p.onSubmitQuery(); }}
          className="flex items-center gap-2 rounded-xl border px-3 py-2 transition focus-within:shadow-[0_0_0_3px_rgba(217,83,30,0.15)]"
          style={{ borderColor: p.aiMode ? '#d9531e' : '#dfe3e9', background: p.aiMode ? '#fff8f4' : '#f7f8fa' }}
        >
          {p.aiMode ? <Sparkles className="h-4 w-4 shrink-0" style={{ color: '#d9531e' }} /> : <Search className="h-4 w-4 shrink-0 text-slate-400" />}
          <input
            ref={p.searchRef}
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { p.onClearQuery(); (e.target as HTMLInputElement).blur(); } }}
            placeholder={p.aiMode ? 'Frag die KI: „Was hat das Hotel in München zugesagt?“' : 'Suchen in allen Postfächern …  (/)'}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-slate-400"
          />
          {p.query && (
            <button type="button" onClick={p.onClearQuery} className="rounded p-0.5 text-slate-400 hover:text-slate-600" title="Suche löschen (Esc)">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={p.onToggleAi}
            disabled={!p.aiReady}
            title={p.aiReady ? 'KI-Suche: Frage in Alltagssprache stellen' : 'KI ist nicht eingerichtet'}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold transition disabled:opacity-40"
            style={p.aiMode ? { background: '#d9531e', color: 'white' } : { background: 'white', color: '#d9531e', border: '1px solid #f1c7b4' }}
          >
            <Sparkles className="h-3 w-3" /> KI
          </button>
        </form>

        {!p.query && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {p.aiMode
              ? AI_HINTS.map((h) => (
                <button key={h} onClick={() => p.onQuery(h)} className="rounded-full border px-2.5 py-0.5 text-[11.5px] text-slate-600 hover:border-orange-300 hover:text-slate-900" style={{ borderColor: '#e5e8ed' }}>{h}</button>
              ))
              : FILTERS.map((f) => (
                <button
                  key={f.k}
                  onClick={() => p.onFilter(f.k)}
                  className="rounded-full px-2.5 py-0.5 text-[12px] font-medium transition"
                  style={p.filter === f.k ? { background: '#143047', color: 'white' } : { background: '#f1f3f6', color: '#4a5866' }}
                >{f.label}</button>
              ))}
          </div>
        )}
        {p.query && !p.aiMode && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
            <span>Tipp:</span>
            {SEARCH_HINTS.map((h) => <code key={h} className="rounded bg-slate-100 px-1.5 py-px">{h}</code>)}
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between px-4 pb-1.5 pt-2.5">
        <h2 className="truncate text-[15px] font-bold" style={{ color: '#143047' }}>{p.title}</h2>
        <span className="shrink-0 pl-2 text-[11.5px] text-slate-400">{p.subtitle}</span>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {/* KI-Antwort */}
        {(p.aiBusy || p.aiAnswer) && (
          <div className="mx-3 mb-3 rounded-2xl border p-3.5 text-[13px] leading-relaxed" style={{ borderColor: '#f1d2c3', background: 'linear-gradient(180deg,#fff8f4,#ffffff)' }}>
            <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: '#d9531e' }}>
              <Sparkles className="h-3.5 w-3.5" /> KI-Antwort
            </div>
            {p.aiBusy ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> {p.aiStep || 'Durchsuche deine Postfächer …'}
              </div>
            ) : p.aiAnswer && (
              <>
                <div style={{ color: '#1f2d3a' }}><Md text={p.aiAnswer.answer} /></div>
                {p.aiAnswer.sources.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-[11px] font-semibold text-slate-500">Quellen</div>
                    {p.aiAnswer.sources.map((s) => (
                      <button key={s.mailbox + s.id} onClick={() => p.onOpen(s)} className="flex w-full items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-left hover:border-orange-300" style={{ borderColor: '#eceff3' }}>
                        <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium">{s.subject || '(ohne Betreff)'}</span>
                          <span className="block truncate text-[11px] text-slate-500">{s.from.name || s.from.address} · {listTime(s.receivedAt)}</span>
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    ))}
                  </div>
                )}
                {p.aiAnswer.steps.length > 0 && (
                  <details className="mt-2 text-[11px] text-slate-400">
                    <summary className="cursor-pointer">So wurde gesucht ({p.aiAnswer.steps.length} Schritte)</summary>
                    <ul className="mt-1 list-disc pl-4">{p.aiAnswer.steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </details>
                )}
              </>
            )}
          </div>
        )}

        {p.messages.map((m) => {
          const g = dayGroup(m.receivedAt);
          const header = g !== lastGroup ? g : null;
          lastGroup = g;
          const key = `${m.mailbox}|${m.id}`;
          const active = key === p.selectedKey;
          const mb = p.mailboxes.find((x) => x.address === m.mailbox);
          const refs = refsIn(m.subject);
          const fromOwn = p.mailboxes.some((x) => x.address === m.from.address);
          const who = fromOwn && m.to.length ? `An: ${m.to.map((t) => t.name || t.address).join(', ')}` : m.from.name || m.from.address || '(unbekannt)';
          return (
            <div key={key}>
              {header && <div className="sticky top-0 z-[1] bg-white/95 px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400 backdrop-blur">{header}</div>}
              <button
                onClick={() => p.onOpen(m)}
                data-key={key}
                className="relative flex w-full gap-2.5 border-l-[3px] px-3.5 py-2.5 text-left transition"
                style={{
                  borderLeftColor: active ? '#d9531e' : 'transparent',
                  background: active ? '#fdf3ee' : undefined,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#f7f8fa'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = ''; }}
              >
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: m.isRead ? 'transparent' : '#d9531e' }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`min-w-0 flex-1 truncate text-[13.5px] ${m.isRead ? 'text-slate-700' : 'font-bold'}`} style={m.isRead ? undefined : { color: '#10202f' }}>
                      {m.isDraft && <span className="mr-1 font-semibold" style={{ color: '#c0392b' }}>[Entwurf]</span>}{who}
                    </span>
                    <span className={`shrink-0 text-[11.5px] tabular-nums ${m.isRead ? 'text-slate-400' : 'font-semibold'}`} style={m.isRead ? undefined : { color: '#d9531e' }}>{listTime(m.receivedAt)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className={`min-w-0 flex-1 truncate text-[13px] ${m.isRead ? 'text-slate-600' : 'font-semibold text-slate-800'}`}>{m.subject || '(ohne Betreff)'}</span>
                    {m.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    {m.flagged && <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: '#d9531e', fill: '#d9531e' }} />}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-500">{m.preview}</span>
                  {(refs.length > 0 || (p.showMailbox && mb) || m.importance === 'high') && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-1">
                      {m.importance === 'high' && <span className="rounded px-1.5 py-px text-[10.5px] font-semibold text-white" style={{ background: '#c0392b' }}>Wichtig</span>}
                      {refs.map((r) => <span key={r} className="rounded px-1.5 py-px text-[10.5px] font-semibold" style={{ background: '#e8eef4', color: '#143047' }}>{r}</span>)}
                      {p.showMailbox && mb && (
                        <span className="ml-auto flex items-center gap-1 text-[10.5px] text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: mailboxColor(mb.address, p.mailboxes) }} />{shortMailbox(mb)}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </button>
            </div>
          );
        })}

        {!p.loading && !p.messages.length && !p.aiAnswer && !p.aiBusy && (
          <div className="px-6 py-16 text-center text-[13px] text-slate-400">
            {p.query ? 'Nichts gefunden. Probier andere Wörter – oder stell die Frage der KI.' : 'Hier ist alles erledigt.'}
          </div>
        )}
        {p.loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-[12.5px] text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Lade Mails …</div>
        )}
        <div ref={sentinel} className="h-4" />
      </div>
    </section>
  );
}

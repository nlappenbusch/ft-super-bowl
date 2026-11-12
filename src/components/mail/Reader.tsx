'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Reply, ReplyAll, Forward, Archive, Trash2, Flag, MailOpen, Mail, Paperclip, Download, ExternalLink,
  Loader2, ChevronDown, PanelRightOpen, PanelRightClose, ArrowLeft, Eye,
} from 'lucide-react';
import type { MailboxInfo, MailDetail, MailSummary } from './types';
import TeamsChat from './TeamsChat';
import { escapeHtml, fileSize, formatAddr, initials, listTime, longTime, mailboxColor, personColor, shortMailbox } from './util';

/** Mail-HTML sicher anzeigen: Sandbox ohne Skripte, Höhe passt sich an. */
function MailBody({ html, isHtml }: { html: string; isHtml: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(120);
  const doc = useMemo(() => {
    const body = isHtml
      ? html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '').replace(/\son\w+='[^']*'/gi, '')
      : `<div style="white-space:pre-wrap">${escapeHtml(html).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</div>`;
    return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>
html,body{margin:0;padding:0;background:#fff}
body{font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1f2d3a;word-wrap:break-word;overflow-wrap:anywhere}
img{max-width:100%;height:auto}
table{max-width:100%}
a{color:#c2471a}
blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #e5e8ed;color:#5a6875}
pre{white-space:pre-wrap}
</style></head><body>${body}</body></html>`;
  }, [html, isHtml]);

  useEffect(() => {
    const f = ref.current;
    if (!f) return;
    let ro: ResizeObserver | null = null;
    const measure = () => {
      const d = f.contentDocument;
      if (!d?.body) return;
      setH(Math.max(60, Math.ceil(d.documentElement.scrollHeight) + 4));
    };
    const onLoad = () => {
      measure();
      const d = f.contentDocument;
      if (d?.body && 'ResizeObserver' in window) {
        ro = new ResizeObserver(measure);
        ro.observe(d.body);
      }
      d?.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure));
    };
    f.addEventListener('load', onLoad);
    return () => { f.removeEventListener('load', onLoad); ro?.disconnect(); };
  }, [doc]);

  return (
    <iframe
      ref={ref}
      title="Mail"
      srcDoc={doc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className="block w-full border-0"
      style={{ height: h }}
    />
  );
}

function Avatar({ name, address, size = 36 }: { name: string; address: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: personColor(address || name), fontSize: size * 0.36 }}>
      {initials(name, address)}
    </span>
  );
}

interface Props {
  mailboxes: MailboxInfo[];
  detail: MailDetail | null;
  thread: MailSummary[];
  loading: boolean;
  error: string | null;
  contextOpen: boolean;
  onToggleContext: () => void;
  onBack: () => void;
  onReply: (mode: 'reply' | 'replyAll' | 'forward') => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggleRead: () => void;
  onToggleFlag: () => void;
  onOpenThreadMessage: (m: MailSummary) => void;
  onQuickReply: () => void;
}

export default function Reader(p: Props) {
  const d = p.detail;
  const [showAllThread, setShowAllThread] = useState(false);
  useEffect(() => setShowAllThread(false), [d?.conversationId]);

  if (!d) {
    return (
      <section className="flex h-full flex-col items-center justify-center bg-white text-center">
        {p.loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        ) : p.error ? (
          <div className="max-w-sm px-6 text-[13px] text-red-600">{p.error}</div>
        ) : (
          <div className="px-8">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl" style={{ background: '#f4f6f9' }}>
              <Mail className="h-6 w-6 text-slate-300" />
            </div>
            <div className="text-[14px] font-semibold text-slate-600">Keine Mail ausgewählt</div>
            <div className="mt-1 text-[12.5px] text-slate-400">
              <kbd className="rounded border px-1">j</kbd>/<kbd className="rounded border px-1">k</kbd> blättern ·
              <kbd className="ml-1 rounded border px-1">c</kbd> neue Mail · <kbd className="rounded border px-1">/</kbd> suchen
            </div>
          </div>
        )}
      </section>
    );
  }

  const mb = p.mailboxes.find((m) => m.address === d.mailbox);
  const older = p.thread.filter((t) => t.id !== d.id && t.receivedAt <= d.receivedAt);
  const newer = p.thread.filter((t) => t.id !== d.id && t.receivedAt > d.receivedAt);
  const visibleOlder = showAllThread ? older : older.slice(-2);
  const hiddenCount = older.length - visibleOlder.length;
  const files = d.attachments.filter((a) => !a.isInline || !a.contentId);
  const attUrl = (attId: string, view = false) => `/api/admin/mailbox/attachment?mb=${encodeURIComponent(d.mailbox)}&id=${encodeURIComponent(d.id)}&att=${encodeURIComponent(attId)}${view ? '&view=1' : ''}`;

  const ToolBtn = ({ onClick, title, children, accent }: { onClick: () => void; title: string; children: React.ReactNode; accent?: boolean }) => (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition hover:bg-slate-100"
      style={accent ? { color: '#d9531e' } : { color: '#3b4a5a' }}
    >{children}</button>
  );

  const threadRow = (t: MailSummary) => (
    <button key={t.id} onClick={() => p.onOpenThreadMessage(t)} className="flex w-full items-center gap-3 rounded-xl border bg-white px-3.5 py-2.5 text-left hover:border-slate-300" style={{ borderColor: '#e9ecf0' }}>
      <Avatar name={t.from.name} address={t.from.address} size={26} />
      <span className="w-40 shrink-0 truncate text-[12.5px] font-semibold text-slate-700">{t.from.name || t.from.address}</span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-500">{t.preview}</span>
      <span className="shrink-0 text-[11.5px] text-slate-400">{listTime(t.receivedAt)}</span>
    </button>
  );

  return (
    <section className="flex h-full min-h-0 flex-col bg-white">
      {/* Aktionen */}
      <div className="flex items-center gap-0.5 border-b px-2 py-1.5" style={{ borderColor: '#e5e8ed' }}>
        <button onClick={p.onBack} className="mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" title="Zurück zur Liste"><ArrowLeft className="h-4 w-4" /></button>
        <ToolBtn onClick={() => p.onReply('reply')} title="Antworten (R)" accent><Reply className="h-4 w-4" /><span className="hidden sm:inline">Antworten</span></ToolBtn>
        <ToolBtn onClick={() => p.onReply('replyAll')} title="Allen antworten (A)"><ReplyAll className="h-4 w-4" /><span className="hidden xl:inline">Allen</span></ToolBtn>
        <ToolBtn onClick={() => p.onReply('forward')} title="Weiterleiten (F)"><Forward className="h-4 w-4" /><span className="hidden xl:inline">Weiterleiten</span></ToolBtn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolBtn onClick={p.onArchive} title="Archivieren (E)"><Archive className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={p.onDelete} title="Löschen (#) – landet in Gelöschte Elemente"><Trash2 className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={p.onToggleRead} title={d.isRead ? 'Als ungelesen markieren (U)' : 'Als gelesen markieren (U)'}>{d.isRead ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}</ToolBtn>
        <ToolBtn onClick={p.onToggleFlag} title="Markieren (S)"><Flag className="h-4 w-4" style={d.flagged ? { color: '#d9531e', fill: '#d9531e' } : undefined} /></ToolBtn>
        <span className="flex-1" />
        {d.webLink && <a href={d.webLink} target="_blank" rel="noreferrer" title="In Outlook öffnen" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><ExternalLink className="h-4 w-4" /></a>}
        <button onClick={p.onToggleContext} title={p.contextOpen ? 'Kontext ausblenden' : 'Kontext einblenden'} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
          {p.contextOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[920px] px-5 pb-10 pt-5 sm:px-7">
          <div className="flex items-start gap-3">
            <h1 className="min-w-0 flex-1 text-[20px] font-bold leading-snug" style={{ color: '#10202f' }}>{d.subject || '(ohne Betreff)'}</h1>
            {mb && (
              <span className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium" style={{ background: '#f2f4f7', color: '#3b4a5a' }} title={mb.address}>
                <span className="h-2 w-2 rounded-full" style={{ background: mailboxColor(mb.address, p.mailboxes) }} />{shortMailbox(mb)}
              </span>
            )}
          </div>

          {/* Früherer Verlauf */}
          {older.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {hiddenCount > 0 && (
                <button onClick={() => setShowAllThread(true)} className="flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800">
                  <ChevronDown className="h-3.5 w-3.5" /> {hiddenCount} frühere Nachricht{hiddenCount === 1 ? '' : 'en'} im Verlauf
                </button>
              )}
              {visibleOlder.map(threadRow)}
            </div>
          )}

          {/* Aktuelle Mail */}
          <article className="mt-4 rounded-2xl border" style={{ borderColor: '#e5e8ed' }}>
            <header className="flex items-start gap-3 border-b px-4 py-3.5" style={{ borderColor: '#f0f2f5' }}>
              <Avatar name={d.from.name} address={d.from.address} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[14px] font-semibold" style={{ color: '#10202f' }}>{d.from.name || d.from.address}</span>
                  <span className="text-[12px] text-slate-500">&lt;{d.from.address}&gt;</span>
                </div>
                <div className="mt-0.5 text-[12px] text-slate-500">
                  An: {d.to.map(formatAddr).join(', ') || '–'}
                  {d.cc.length > 0 && <> · Cc: {d.cc.map(formatAddr).join(', ')}</>}
                </div>
                <div className="mt-2">
                  <TeamsChat from={d.from} others={[...d.to, ...d.cc]} own={p.mailboxes.map((m) => m.address)} subject={d.subject.replace(/^((aw|re|wg|fw|fwd):\s*)+/i, '')} />
                </div>
              </div>
              <time className="shrink-0 text-[12px] text-slate-400" title={longTime(d.receivedAt)}>{longTime(d.receivedAt)}</time>
            </header>
            <div className="px-4 py-4"><MailBody html={d.bodyHtml} isHtml={d.bodyIsHtml} /></div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t px-4 py-3" style={{ borderColor: '#f0f2f5' }}>
                {files.map((a) => (
                  <div key={a.id} className="group flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: '#e5e8ed' }}>
                    <Paperclip className="h-4 w-4 text-slate-400" />
                    <span className="max-w-[220px] truncate text-[12.5px] font-medium text-slate-700" title={a.name}>{a.name}</span>
                    <span className="text-[11px] text-slate-400">{fileSize(a.size)}</span>
                    {/^(application\/pdf|image\/)/.test(a.contentType) && (
                      <a href={attUrl(a.id, true)} target="_blank" rel="noreferrer" title="Ansehen" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Eye className="h-3.5 w-3.5" /></a>
                    )}
                    <a href={attUrl(a.id)} title="Herunterladen" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Download className="h-3.5 w-3.5" /></a>
                  </div>
                ))}
              </div>
            )}
          </article>

          {newer.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">Danach im Verlauf</div>
              {newer.map(threadRow)}
            </div>
          )}

          {/* Schnellantwort */}
          <button
            onClick={p.onQuickReply}
            className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-dashed px-4 py-3.5 text-left text-[13px] text-slate-500 transition hover:border-solid hover:text-slate-700"
            style={{ borderColor: '#d6dbe2' }}
          >
            <Reply className="h-4 w-4" style={{ color: '#d9531e' }} />
            Antworten an {d.from.name || d.from.address} … <span className="ml-auto text-[11px] text-slate-400">Stichworte genügen – die KI formuliert</span>
          </button>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import {
  Inbox, Send, FileText, Archive, Trash2, ShieldAlert, Folder, ChevronRight, PenSquare, Settings, Layers,
  RefreshCw, BookText, LayoutDashboard, LogOut,
} from 'lucide-react';
import type { MailboxInfo, MailFolder, ViewSel } from './types';
import { mailboxColor, shortMailbox, initials } from './util';

const FOLDER_ICON: Record<string, typeof Inbox> = {
  inbox: Inbox, sentitems: Send, drafts: FileText, archive: Archive, deleteditems: Trash2, junkemail: ShieldAlert,
};

interface Props {
  mailboxes: MailboxInfo[];
  /** undefined = lädt, null = Laden fehlgeschlagen */
  folders: Record<string, MailFolder[] | null | undefined>;
  onRetryFolders: (mb: string) => void;
  childFolders: Record<string, MailFolder[] | undefined>;
  expanded: Set<string>;
  view: ViewSel;
  unreadAll: number;
  userName: string;
  onToggle: (mb: string) => void;
  onLoadChildren: (mb: string, folderId: string) => void;
  onSelect: (v: ViewSel) => void;
  onCompose: () => void;
  onSettings: () => void;
  onTemplates: () => void;
  onRefreshMailboxes: () => void;
}

export default function Sidebar(p: Props) {
  const [openChildren, setOpenChildren] = useState<Set<string>>(new Set());

  const folderRow = (mb: MailboxInfo, f: MailFolder, depth = 0) => {
    const Icon = FOLDER_ICON[f.key] || Folder;
    const active = p.view.mb === mb.address && (p.view.folder === f.id || p.view.folder === f.key);
    const open = openChildren.has(f.id);
    return (
      <div key={f.id}>
        <button
          onClick={() => p.onSelect({ mb: mb.address, folder: f.key || f.id, folderName: f.name })}
          className={`group flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-[13px] transition ${active ? 'bg-white font-semibold shadow-sm' : 'hover:bg-white/70'}`}
          style={{ paddingLeft: 28 + depth * 14, color: active ? '#143047' : '#3b4a5a' }}
        >
          {f.childCount > 0 ? (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                const n = new Set(openChildren);
                if (open) n.delete(f.id); else { n.add(f.id); p.onLoadChildren(mb.address, f.id); }
                setOpenChildren(n);
              }}
              className="-ml-5 mr-0.5 grid h-4 w-4 place-items-center rounded text-slate-400 hover:bg-slate-200"
            >
              <ChevronRight className={`h-3 w-3 transition ${open ? 'rotate-90' : ''}`} />
            </span>
          ) : null}
          <Icon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          {f.unread > 0 && f.key !== 'sentitems' && f.key !== 'deleteditems' && f.key !== 'drafts' ? (
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: f.key === 'junkemail' ? '#8a94a3' : '#d9531e' }}>{f.unread}</span>
          ) : f.key === 'drafts' && f.total > 0 ? (
            <span className="text-[11px] tabular-nums text-slate-400">{f.total}</span>
          ) : null}
        </button>
        {open && (p.childFolders[`${mb.address}|${f.id}`] || []).map((c) => folderRow(mb, c, depth + 1))}
      </div>
    );
  };

  return (
    <aside className="flex h-full w-full flex-col" style={{ background: '#eef1f5' }}>
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg text-[13px] font-black tracking-tight text-white" style={{ background: '#143047' }}>
          F<span style={{ color: '#d9531e' }}>.</span>
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-bold" style={{ color: '#143047' }}>Faltin Mail</div>
          <div className="text-[11px] text-slate-500">Wir liefern Emotionen</div>
        </div>
      </div>

      <div className="px-3">
        <button
          onClick={p.onCompose}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-[0.99]"
          style={{ background: '#d9531e' }}
          title="Neue Mail (C)"
        >
          <PenSquare className="h-4 w-4" /> Neue Mail
        </button>
      </div>

      <nav className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <button
          onClick={() => p.onSelect({ mb: 'all', folder: 'inbox', folderName: 'Alle Posteingänge' })}
          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] ${p.view.mb === 'all' ? 'bg-white font-semibold shadow-sm' : 'hover:bg-white/70'}`}
          style={{ color: '#143047' }}
        >
          <Layers className="h-4 w-4" />
          <span className="flex-1">Alle Posteingänge</span>
          {p.unreadAll > 0 && <span className="text-[11px] font-semibold tabular-nums" style={{ color: '#d9531e' }}>{p.unreadAll}</span>}
        </button>

        <div className="mt-3 flex items-center justify-between px-2.5 pb-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">Postfächer</span>
          <button onClick={p.onRefreshMailboxes} title="Postfachfreigaben neu aus Exchange laden" className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-600">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>

        {p.mailboxes.map((mb) => {
          const open = p.expanded.has(mb.address);
          const color = mailboxColor(mb.address, p.mailboxes);
          const inbox = p.folders[mb.address]?.find((f) => f.key === 'inbox');
          return (
            <div key={mb.address} className="mb-0.5">
              <button
                onClick={() => p.onToggle(mb.address)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/70"
                title={`${mb.address}\n${mb.via}${mb.canSend ? '' : '\nNur lesen'}`}
              >
                <ChevronRight className={`h-3 w-3 shrink-0 text-slate-400 transition ${open ? 'rotate-90' : ''}`} />
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[9px] font-bold text-white" style={{ background: color }}>
                  {initials(mb.name, mb.address)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium" style={{ color: '#1f2d3a' }}>{shortMailbox(mb)}</span>
                  {mb.kind !== 'own' && <span className="block truncate text-[10.5px] text-slate-500">{mb.address}{mb.canSend ? '' : ' · nur lesen'}</span>}
                </span>
                {!open && inbox && inbox.unread > 0 && <span className="text-[11px] font-semibold tabular-nums" style={{ color: '#d9531e' }}>{inbox.unread}</span>}
              </button>
              {open && (
                <div className="pb-1">
                  {p.folders[mb.address] === undefined ? (
                    <div className="py-1 pl-9 text-[12px] text-slate-400">Lade Ordner …</div>
                  ) : p.folders[mb.address] === null ? (
                    <div className="py-1 pl-9 pr-2 text-[12px] leading-snug text-slate-500">
                      Ordner nicht erreichbar (Microsoft antwortet gerade nicht).{' '}
                      <button onClick={() => p.onRetryFolders(mb.address)} className="font-medium underline underline-offset-2" style={{ color: '#143047' }}>
                        Erneut laden
                      </button>
                    </div>
                  ) : (
                    p.folders[mb.address]!.map((f) => folderRow(mb, f))
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!p.mailboxes.length && <div className="px-3 py-2 text-[12px] text-slate-500">Keine Postfächer gefunden.</div>}
      </nav>

      <div className="space-y-0.5 border-t px-2 py-2" style={{ borderColor: '#dde2e8' }}>
        <button onClick={p.onTemplates} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-600 hover:bg-white/70">
          <BookText className="h-4 w-4" /> Vorlagen &amp; Bausteine
        </button>
        <button onClick={p.onSettings} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-600 hover:bg-white/70">
          <Settings className="h-4 w-4" /> Signatur &amp; Einstellungen
        </button>
        <a href="/working-dashboard" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-600 hover:bg-white/70">
          <LayoutDashboard className="h-4 w-4" /> Zum Portal
        </a>
        <div className="flex items-center gap-2 px-2.5 pt-1.5 text-[12px] text-slate-500">
          <span className="min-w-0 flex-1 truncate">{p.userName}</span>
          <button
            onClick={async () => {
              try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
              window.location.href = '/admin/login?from=%2Fmail';
            }}
            title="Abmelden"
            className="rounded p-1 hover:bg-white"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

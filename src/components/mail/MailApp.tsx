'use client';

/**
 * MailApp — Faltin Mail. Vier Spalten (Postfächer · Liste · Mail · Zusammenhang), auf dem
 * Handy eine Spalte nach der anderen. Tastatur: j/k blättern, r antworten, a allen, f weiterleiten,
 * c neue Mail, e archivieren, # löschen, u gelesen/ungelesen, s markieren, / suchen, i Zusammenhang.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Menu, AlertTriangle, X } from 'lucide-react';
import Sidebar from './Sidebar';
import MessageList, { type ListFilter } from './MessageList';
import Reader from './Reader';
import ContextPanel from './ContextPanel';
import Composer, { markGaps } from './Composer';
import TemplatesDialog from './TemplatesDialog';
import SettingsDialog from './SettingsDialog';
import type {
  AccountsResponse, AssistMode, ComposeSeed, MailAddress, MailDetail, MailExtraction, MailFolder, MailSummary, MailTemplate, ViewSel,
} from './types';
import { api, longTime, refsIn, textToHtml, escapeHtml, shortMailbox } from './util';

interface AiAnswer { question: string; answer: string; sources: MailSummary[]; steps: string[] }

const OWN_DOMAINS = ['faltintravel.com', 'faltin-travel.ch', 'faltintravel.ch'];
const isInternal = (a: string) => OWN_DOMAINS.some((d) => a.toLowerCase().endsWith('@' + d));
const keyOf = (m: { mailbox: string; id: string }) => `${m.mailbox}|${m.id}`;

function splitName(name: string): { vorname: string; nachname: string } {
  const n = name.replace(/\(.*?\)|".*?"/g, '').trim();
  if (n.includes(',')) { const [last, first] = n.split(',').map((x) => x.trim()); return { vorname: first || '', nachname: last || '' }; }
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { vorname: parts[0] || '', nachname: '' };
  return { vorname: parts.slice(0, -1).join(' '), nachname: parts[parts.length - 1] };
}

export default function MailApp() {
  const [accounts, setAccounts] = useState<AccountsResponse | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [placeholders, setPlaceholders] = useState<Array<{ key: string; label: string }>>([]);

  const [view, setView] = useState<ViewSel>({ mb: 'all', folder: 'inbox', folderName: 'Alle Posteingänge' });
  /** undefined = lädt, null = Laden fehlgeschlagen */
  const [folders, setFolders] = useState<Record<string, MailFolder[] | null | undefined>>({});
  const [childFolders, setChildFolders] = useState<Record<string, MailFolder[] | undefined>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [messages, setMessages] = useState<MailSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [filter, setFilter] = useState<ListFilter>('all');
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<AiAnswer | null>(null);
  const [aiStep, setAiStep] = useState('');

  const [selected, setSelected] = useState<{ mailbox: string; id: string } | null>(null);
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [thread, setThread] = useState<MailSummary[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(true);
  const [extraction, setExtraction] = useState<MailExtraction | null>(null);

  const [seed, setSeed] = useState<ComposeSeed | null>(null);
  const [inject, setInject] = useState<MailTemplate | null>(null);
  const [dialog, setDialog] = useState<null | 'templates' | 'settings'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pane, setPane] = useState<'nav' | 'list' | 'reader'>('list');

  const searchRef = useRef<HTMLInputElement>(null);
  const listSeq = useRef(0);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 3500); }, []);

  /* ── Laden ── */
  const loadAccounts = useCallback(async (refresh = false) => {
    try {
      const r = await api<AccountsResponse>(`accounts${refresh ? '?refresh=1' : ''}`);
      setAccounts(r);
      setBootError(null);
      return r;
    } catch (e) {
      setBootError((e as Error).message);
      return null;
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    const r = await api<{ templates: MailTemplate[]; placeholders: Array<{ key: string; label: string }> }>('templates').catch(() => null);
    if (r) { setTemplates(r.templates); setPlaceholders(r.placeholders); }
  }, []);

  const loadFolders = useCallback(async (mb: string) => {
    const r = await api<{ folders: MailFolder[] }>(`folders?mb=${encodeURIComponent(mb)}`).catch(() => null);
    // Bei einem Fehler den bisherigen Stand behalten; nur ohne Stand als Fehler markieren.
    setFolders((f) => ({ ...f, [mb]: r ? r.folders : f[mb] || null }));
  }, []);

  // Fehlen die Freigaben wegen einer Exchange-Störung, jede Minute still neu versuchen.
  useEffect(() => {
    if (!accounts?.warning) return;
    const t = setTimeout(async () => {
      const a = await loadAccounts(true);
      if (a && !a.warning) a.mailboxes.forEach((m) => void loadFolders(m.address));
    }, 65_000);
    return () => clearTimeout(t);
  }, [accounts, loadAccounts, loadFolders]);

  useEffect(() => {
    void (async () => {
      const a = await loadAccounts();
      void loadTemplates();
      if (a) {
        // Eigenes Postfach aufklappen, Ordner (für Ungelesen-Zahlen) aller Postfächer laden
        const own = a.mailboxes.find((m) => m.kind === 'own');
        if (own) setExpanded(new Set([own.address]));
        a.mailboxes.forEach((m) => void loadFolders(m.address));
      }
    })();
    if (typeof window !== 'undefined' && window.innerWidth < 1280) setContextOpen(false);
  }, [loadAccounts, loadTemplates, loadFolders]);

  const listUrl = useCallback((before?: string) => {
    const sp = new URLSearchParams({ mb: view.mb });
    if (activeQuery && !aiMode) sp.set('q', activeQuery);
    else {
      sp.set('folder', view.folder);
      if (filter !== 'all') sp.set(filter, '1');
      if (before) sp.set('before', before);
    }
    return `messages?${sp}`;
  }, [view, activeQuery, aiMode, filter]);

  const loadList = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!accounts) return;
    const my = ++listSeq.current;
    if (!opts.silent) setListLoading(true);
    try {
      const r = await api<{ messages: MailSummary[]; more: boolean }>(listUrl());
      if (my !== listSeq.current) return;
      setMessages(r.messages); setMore(r.more);
    } catch (e) {
      if (my === listSeq.current && !opts.silent) showToast((e as Error).message);
    } finally {
      if (my === listSeq.current) setListLoading(false);
    }
  }, [accounts, listUrl, showToast]);

  useEffect(() => { void loadList(); }, [loadList]);

  const loadMore = useCallback(async () => {
    if (!more || listLoading || !messages.length) return;
    setListLoading(true);
    try {
      const r = await api<{ messages: MailSummary[]; more: boolean }>(listUrl(messages[messages.length - 1].receivedAt));
      setMessages((cur) => {
        const seen = new Set(cur.map(keyOf));
        return [...cur, ...r.messages.filter((m) => !seen.has(keyOf(m)))];
      });
      setMore(r.more);
    } finally {
      setListLoading(false);
    }
  }, [more, listLoading, messages, listUrl]);

  // Alle 60 s still aktualisieren (nur ohne Suche) + Ordnerzähler
  useEffect(() => {
    if (!accounts) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      if (!activeQuery) void loadList({ silent: true });
      accounts.mailboxes.forEach((m) => void loadFolders(m.address));
    }, 60000);
    return () => clearInterval(t);
  }, [accounts, activeQuery, loadList, loadFolders]);

  /* ── Mail öffnen ── */
  const patchLocal = (mb: string, id: string, patch: Partial<MailSummary>) => {
    setMessages((ms) => ms.map((m) => (m.mailbox === mb && m.id === id ? { ...m, ...patch } : m)));
    setDetail((d) => (d && d.mailbox === mb && d.id === id ? { ...d, ...patch } : d));
  };

  const setRead = useCallback(async (mb: string, id: string, isRead: boolean) => {
    patchLocal(mb, id, { isRead });
    setFolders((f) => {
      const list = f[mb];
      if (!list) return f;
      return { ...f, [mb]: list.map((x) => (x.key === 'inbox' ? { ...x, unread: Math.max(0, x.unread + (isRead ? -1 : 1)) } : x)) };
    });
    await api('message', { method: 'PATCH', json: { mb, id, isRead } }).catch((e) => showToast((e as Error).message));
  }, [showToast]);

  const open = useCallback(async (m: { mailbox: string; id: string; isRead?: boolean }) => {
    setSelected({ mailbox: m.mailbox, id: m.id });
    setPane('reader');
    setDetailLoading(true); setDetailError(null);
    if (readTimer.current) clearTimeout(readTimer.current);
    try {
      const r = await api<{ message: MailDetail; thread: MailSummary[] }>(`message?mb=${encodeURIComponent(m.mailbox)}&id=${encodeURIComponent(m.id)}`);
      setDetail({ ...r.message, mailbox: m.mailbox });
      setThread(r.thread.map((t) => ({ ...t, mailbox: m.mailbox })));
      if (!r.message.isRead) readTimer.current = setTimeout(() => void setRead(m.mailbox, m.id, true), 1500);
    } catch (e) {
      setDetail(null);
      setDetailError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }, [setRead]);

  const idx = selected ? messages.findIndex((m) => m.mailbox === selected.mailbox && m.id === selected.id) : -1;
  const step = (dir: 1 | -1) => {
    const next = messages[idx < 0 ? 0 : idx + dir];
    if (next) void open(next);
  };

  const removeFromList = (mb: string, id: string) => {
    const i = messages.findIndex((m) => m.mailbox === mb && m.id === id);
    const next = messages[i + 1] || messages[i - 1];
    setMessages((ms) => ms.filter((m) => !(m.mailbox === mb && m.id === id)));
    if (next) void open(next); else { setSelected(null); setDetail(null); setPane('list'); }
  };

  const move = async (destination: 'archive' | 'deleteditems') => {
    if (!detail) return;
    const { mailbox, id } = detail;
    removeFromList(mailbox, id);
    try {
      await api('message', { json: { action: 'move', mb: mailbox, id, destination } });
      showToast(destination === 'archive' ? 'Archiviert' : 'In den Papierkorb verschoben');
      void loadFolders(mailbox);
    } catch (e) {
      showToast((e as Error).message);
      void loadList({ silent: true });
    }
  };

  const toggleFlag = async () => {
    if (!detail) return;
    const flagged = !detail.flagged;
    patchLocal(detail.mailbox, detail.id, { flagged });
    await api('message', { method: 'PATCH', json: { mb: detail.mailbox, id: detail.id, flagged } }).catch((e) => showToast((e as Error).message));
  };

  /* ── Schreiben ── */
  const sendBoxFor = useCallback((mb?: string) => {
    if (!accounts) return '';
    const ok = accounts.mailboxes.filter((m) => m.canSend);
    return (ok.find((m) => m.address === mb) || ok.find((m) => m.address === accounts.prefs.default_from) || ok.find((m) => m.kind === 'own') || ok[0])?.address || '';
  }, [accounts]);

  const baseVars = useCallback((d: MailDetail | null, x: MailExtraction | null): Record<string, string> => {
    const v: Record<string, string> = { heute: new Intl.DateTimeFormat('de-CH').format(new Date()) };
    if (d) {
      const n = splitName(d.from.name || '');
      v['kunde.vorname'] = x?.kunde.vorname || n.vorname;
      v['kunde.nachname'] = x?.kunde.nachname || n.nachname;
      v['kunde.firma'] = x?.kunde.firma || '';
      const refs = refsIn(`${d.subject} ${d.preview}`);
      const rq = refs.find((r) => r.startsWith('RQ-'));
      if (rq) v.rq = rq;
      const ft = refs.find((r) => r.startsWith('FT'));
      if (ft) v['buchung.nr'] = ft;
    }
    if (x) {
      const a = x.kunde.anrede || '';
      if (/herr|frau/i.test(a)) {
        v['kunde.anrede'] = /herr/i.test(a) ? 'Herr' : 'Frau';
        v['kunde.anrede_endung'] = /herr/i.test(a) ? 'r' : '';
        v['kunde.anrede_en'] = /herr/i.test(a) ? 'Mr' : 'Ms';
      }
      if (x.reise.event) v.event = x.reise.event;
      if (x.reise.ort) v.ort = x.reise.ort;
      if (x.reise.von) v['reise.anreise'] = x.reise.von;
      if (x.reise.bis) v['reise.abreise'] = x.reise.bis;
      if (x.reise.personen) v.personen = String(x.reise.personen);
    }
    return v;
  }, []);

  const compose = useCallback((over: Partial<ComposeSeed> = {}) => {
    setSeed({
      key: String(Date.now()), mode: 'new', from: sendBoxFor(view.mb !== 'all' ? view.mb : undefined), to: [], cc: [], subject: '', html: '',
      vars: baseVars(null, null), ...over,
    });
  }, [sendBoxFor, view.mb, baseVars]);

  const reply = useCallback((mode: 'reply' | 'replyAll' | 'forward', bodyText?: string) => {
    if (!detail || !accounts) return;
    const own = new Set(accounts.mailboxes.map((m) => m.address));
    const from = sendBoxFor(detail.mailbox);
    const sender = detail.replyTo.length ? detail.replyTo : [detail.from];
    let to: MailAddress[] = [];
    let cc: MailAddress[] = [];
    if (mode === 'reply') to = sender;
    if (mode === 'replyAll') {
      to = [...sender, ...detail.to].filter((a) => !own.has(a.address.toLowerCase()));
      cc = detail.cc.filter((a) => !own.has(a.address.toLowerCase()));
    }
    const dedupe = (l: MailAddress[]) => l.filter((a, i) => l.findIndex((b) => b.address.toLowerCase() === a.address.toLowerCase()) === i);
    to = dedupe(to);
    cc = dedupe(cc).filter((a) => !to.some((t) => t.address === a.address));
    const prefix = mode === 'forward' ? 'WG: ' : 'AW: ';
    const subject = /^(aw|re|wg|fw|fwd):/i.test(detail.subject) && mode !== 'forward' ? detail.subject : prefix + detail.subject.replace(/^(aw|re|wg|fw|fwd):\s*/i, '');
    const vars = baseVars(detail, extraction);
    const internal = isInternal(detail.from.address);
    let html = '<p><br></p>';
    if (bodyText) html = markGaps(textToHtml(bodyText));
    else if (mode !== 'forward') {
      if (internal) html = `<p>Hallo ${escapeHtml(splitName(detail.from.name || '').vorname)}</p><p><br></p>`;
      else if (vars['kunde.nachname']) {
        const anrede = vars['kunde.anrede'] || '[[kunde.anrede]]';
        html = markGaps(`<p>Guten Tag ${escapeHtml(anrede)} ${escapeHtml(vars['kunde.nachname'])},</p><p><br></p>`);
      } else html = '<p>Guten Tag,</p><p><br></p>';
    }
    setSeed({
      key: String(Date.now()), mode, from, to: mode === 'forward' ? [] : to, cc, subject, html,
      reference: { mb: detail.mailbox, id: detail.id, mode },
      quoted: { from: detail.from.name || detail.from.address, date: longTime(detail.receivedAt), preview: detail.preview },
      vars, greeting: internal ? 'Liebe Grüsse' : undefined,
    });
  }, [detail, accounts, sendBoxFor, baseVars, extraction]);

  const setAssistMode = useCallback(async (m: AssistMode) => {
    setAccounts((a) => (a ? { ...a, prefs: { ...a.prefs, assist_mode: m } } : a));
    await api('prefs', { json: { personal: { assist_mode: m } } }).catch(() => undefined);
  }, []);

  /* ── Suche ── */
  const submitQuery = async () => {
    const q = query.trim();
    if (!q) return;
    if (!aiMode) { setActiveQuery(q); return; }
    setAiBusy(true); setAiAnswer(null); setAiStep('Durchsuche die Postfächer …');
    try {
      const r = await api<{ answer: string; sources: MailSummary[]; steps: string[] }>('ai', { json: { action: 'search', question: q, mb: view.mb } });
      setAiAnswer({ question: q, ...r });
      if (r.sources.length) { setMessages(r.sources); setMore(false); }
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setAiBusy(false); setAiStep('');
    }
  };

  const clearQuery = () => {
    setQuery(''); setActiveQuery(''); setAiAnswer(null);
    if (aiMode) void loadList();
  };

  /* ── Tastatur ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (seed || dialog || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k === 'j' || k === 'ArrowDown') { e.preventDefault(); step(1); }
      else if (k === 'k' || k === 'ArrowUp') { e.preventDefault(); step(-1); }
      else if (k === 'c') { e.preventDefault(); compose(); }
      else if (k === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (!detail) return;
      else if (k === 'r') { e.preventDefault(); reply('reply'); }
      else if (k === 'a') { e.preventDefault(); reply('replyAll'); }
      else if (k === 'f') { e.preventDefault(); reply('forward'); }
      else if (k === 'e') { e.preventDefault(); void move('archive'); }
      else if (k === '#' || k === 'Delete') { e.preventDefault(); void move('deleteditems'); }
      else if (k === 'u') { e.preventDefault(); if (readTimer.current) clearTimeout(readTimer.current); void setRead(detail.mailbox, detail.id, !detail.isRead); }
      else if (k === 's') { e.preventDefault(); void toggleFlag(); }
      else if (k === 'i') { e.preventDefault(); setContextOpen((o) => !o); }
      else if (k === 'Escape') { setPane('list'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ── Ableitungen ── */
  const unreadAll = useMemo(() => Object.values(folders).reduce((s, l) => s + (l?.find((f) => f.key === 'inbox')?.unread || 0), 0), [folders]);
  const viewBox = accounts?.mailboxes.find((m) => m.address === view.mb);
  const title = activeQuery && !aiMode ? `Suche: ${activeQuery}` : aiAnswer ? 'KI-Suche' : view.folderName;
  const subtitle = view.mb === 'all' ? `${accounts?.mailboxes.length || 0} Postfächer` : viewBox ? shortMailbox(viewBox) : '';

  if (!accounts) {
    return (
      <div className="grid h-dvh place-items-center bg-[#eef1f5]">
        {bootError ? (
          <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-600" />
            <div className="text-[14px] font-semibold text-slate-800">Faltin Mail konnte nicht starten</div>
            <div className="mt-1 text-[13px] text-slate-500">{bootError}</div>
            <button onClick={() => void loadAccounts()} className="mt-4 rounded-lg px-4 py-2 text-[13px] font-semibold text-white" style={{ background: '#d9531e' }}>Erneut versuchen</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Postfächer werden geladen …</div>
        )}
      </div>
    );
  }

  const showContext = contextOpen && !!detail;

  return (
    <div className="flex h-dvh overflow-hidden bg-[#eef1f5] text-slate-900">
      <style>{`.mail-editor:has(> p:only-child > br:only-child)::before{content:attr(data-placeholder);position:absolute;color:#9aa5b1;pointer-events:none}`}</style>

      {/* Postfächer */}
      <div className={`${pane === 'nav' ? 'fixed inset-0 z-40 flex' : 'hidden'} w-full shrink-0 lg:static lg:flex lg:w-[244px]`}>
        <div className="h-full w-[85%] max-w-[300px] lg:w-full lg:max-w-none">
          <Sidebar
            mailboxes={accounts.mailboxes}
            folders={folders}
            onRetryFolders={(mb) => { setFolders((f) => ({ ...f, [mb]: undefined })); void loadFolders(mb); }}
            childFolders={childFolders}
            expanded={expanded}
            view={view}
            unreadAll={unreadAll}
            userName={accounts.user.name}
            onToggle={(mb) => {
              const n = new Set(expanded);
              if (n.has(mb)) n.delete(mb); else { n.add(mb); if (!folders[mb]) void loadFolders(mb); }
              setExpanded(n);
            }}
            onLoadChildren={async (mb, id) => {
              const r = await api<{ folders: MailFolder[] }>(`folders?mb=${encodeURIComponent(mb)}&parent=${encodeURIComponent(id)}`).catch(() => ({ folders: [] as MailFolder[] }));
              setChildFolders((c) => ({ ...c, [`${mb}|${id}`]: r.folders }));
            }}
            onSelect={(v) => { setView(v); setQuery(''); setActiveQuery(''); setAiAnswer(null); setFilter('all'); setPane('list'); }}
            onCompose={() => { compose(); setPane('list'); }}
            onSettings={() => setDialog('settings')}
            onTemplates={() => setDialog('templates')}
            onRefreshMailboxes={async () => { const a = await loadAccounts(true); if (a) { showToast('Postfachfreigaben aus Exchange neu geladen'); a.mailboxes.forEach((m) => void loadFolders(m.address)); } }}
          />
        </div>
        {pane === 'nav' && <div className="flex-1 bg-slate-900/30 lg:hidden" onClick={() => setPane('list')} />}
      </div>

      {/* Liste */}
      <div className={`${pane === 'list' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col border-r md:flex md:w-[360px] md:flex-none xl:w-[400px]`} style={{ borderColor: '#e5e8ed' }}>
        <div className="flex items-center gap-2 border-b bg-white px-3 py-2 lg:hidden" style={{ borderColor: '#e5e8ed' }}>
          <button onClick={() => setPane('nav')} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Postfächer"><Menu className="h-5 w-5" /></button>
          <span className="text-[14px] font-bold" style={{ color: '#143047' }}>Faltin Mail</span>
          {unreadAll > 0 && <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: '#d9531e' }}>{unreadAll}</span>}
        </div>
        {accounts.warning && (
          <div className="flex items-start gap-2 border-b bg-amber-50 px-3 py-2 text-[12px] text-amber-800" style={{ borderColor: '#f3e2b8' }}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {accounts.warning}
          </div>
        )}
        <div className="min-h-0 flex-1">
          <MessageList
            title={title}
            subtitle={subtitle}
            mailboxes={accounts.mailboxes}
            showMailbox={view.mb === 'all' || !!activeQuery || !!aiAnswer}
            messages={messages}
            loading={listLoading}
            more={more && !aiAnswer}
            selectedKey={selected ? keyOf(selected) : null}
            filter={filter}
            query={query}
            aiMode={aiMode}
            aiReady={accounts.aiReady}
            aiBusy={aiBusy}
            aiAnswer={aiAnswer}
            aiStep={aiStep}
            onQuery={setQuery}
            onSubmitQuery={() => void submitQuery()}
            onClearQuery={clearQuery}
            onToggleAi={() => { setAiMode((m) => !m); setAiAnswer(null); setActiveQuery(''); searchRef.current?.focus(); }}
            onFilter={setFilter}
            onOpen={(m) => void open(m)}
            onMore={() => void loadMore()}
            searchRef={searchRef}
          />
        </div>
      </div>

      {/* Mail */}
      <div className={`${pane === 'reader' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col md:flex`}>
        <Reader
          mailboxes={accounts.mailboxes}
          detail={detail}
          thread={thread}
          loading={detailLoading}
          error={detailError}
          contextOpen={showContext}
          onToggleContext={() => setContextOpen((o) => !o)}
          onBack={() => setPane('list')}
          onReply={(m) => reply(m)}
          onArchive={() => void move('archive')}
          onDelete={() => void move('deleteditems')}
          onToggleRead={() => { if (detail) { if (readTimer.current) clearTimeout(readTimer.current); void setRead(detail.mailbox, detail.id, !detail.isRead); } }}
          onToggleFlag={() => void toggleFlag()}
          onOpenThreadMessage={(m) => void open(m)}
          onQuickReply={() => reply('reply')}
        />
      </div>

      {/* Zusammenhang */}
      {showContext && detail && (
        <div className="fixed inset-y-0 right-0 z-30 w-[min(380px,100%)] border-l shadow-xl xl:static xl:z-auto xl:w-[340px] xl:shrink-0 xl:shadow-none" style={{ borderColor: '#e5e8ed' }}>
          <ContextPanel
            detail={detail}
            mailboxes={accounts.mailboxes}
            aiReady={accounts.aiReady}
            employees={accounts.employees}
            onOpenMessage={(m) => void open(m)}
            onUseDraft={(text) => reply('reply', text)}
            onExtraction={setExtraction}
            onToast={showToast}
            onClose={() => setContextOpen(false)}
          />
        </div>
      )}

      {seed && (
        <Composer
          key={seed.key}
          seed={seed}
          accounts={accounts}
          templates={templates}
          onClose={() => setSeed(null)}
          onSent={(m) => { showToast(m); setTimeout(() => void loadList({ silent: true }), 2500); }}
          onAssistMode={(m) => void setAssistMode(m)}
          onOpenTemplates={() => setDialog('templates')}
          injectTemplate={inject}
          onInjected={() => setInject(null)}
        />
      )}

      {dialog === 'templates' && (
        <TemplatesDialog
          templates={templates}
          placeholders={placeholders}
          isAdmin={accounts.user.isAdmin}
          userName={accounts.user.name}
          onClose={() => setDialog(null)}
          onChanged={() => void loadTemplates()}
          onUse={(t) => {
            setDialog(null);
            if (!seed) compose();
            setInject(t);
          }}
        />
      )}
      {dialog === 'settings' && (
        <SettingsDialog accounts={accounts} onClose={() => setDialog(null)} onSaved={() => { void loadAccounts(); showToast('Gespeichert'); }} />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] text-white shadow-xl" style={{ background: '#143047' }}>
          {toast}
          <button onClick={() => setToast(null)} className="rounded p-0.5 text-white/60 hover:text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}

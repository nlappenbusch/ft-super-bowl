'use client';

/**
 * Composer — Mail schreiben. Absender-Postfach per Klick wechselbar, Empfänger-Chips mit
 * Vorschlägen, Vorlagen + Textbausteine (Strg+K oder «/» am Zeilenanfang), Grussformel und
 * Signatur je Absender und Sprache, KI-Knopf mit wählbarer Standardaktion (Rückgängig möglich).
 * Gesendet wird nur per Klick (oder Strg+Enter) — die KI sendet nie selbst.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Maximize2, Minimize2, Send, Paperclip, Bold, Italic, Underline, List, ListOrdered, Link2, Eraser,
  Sparkles, ChevronDown, Undo2, BookText, Puzzle, Loader2, Check, AlertTriangle, ExternalLink, Search, Languages,
} from 'lucide-react';
import type { AccountsResponse, AssistMode, ComposeSeed, MailAddress, MailTemplate, MailboxInfo } from './types';
import { api, mailboxColor, initials, shortMailbox, textToHtml, htmlToText, fillPlaceholders, escapeHtml, fileSize } from './util';

export const ASSIST_MODES: Array<{ k: AssistMode; label: string; hint: string }> = [
  { k: 'korrektur', label: 'Nur Rechtschreibung & Grammatik', hint: 'Ändert nur Fehler, Wortlaut bleibt' },
  { k: 'optimieren', label: 'Als Faltin-Mail ausformulieren', hint: 'Komplett neu im Faltin-Ton' },
  { k: 'kuerzer', label: 'Kürzer & klarer', hint: 'Auf das Wesentliche, gleicher Ton' },
  { k: 'freundlicher', label: 'Wärmer formulieren', hint: 'Herzlicher, persönlicher' },
  { k: 'englisch', label: 'Auf Englisch', hint: 'Übersetzt im Faltin-Ton (EN)' },
];

const GREETINGS_DE = ['Freundliche Grüsse', 'Beste Grüsse', 'Herzliche Grüsse', 'Herzliche Grüsse aus der Schweiz', 'Freundliche Grüsse aus der Schweiz', 'Viele Grüsse aus der Schweiz', 'Herzliche Grüsse\nIhr Faltin Travel Team', 'Liebe Grüsse', 'Sonnige Grüsse'];
const GREETINGS_EN = ['Kind regards,', 'Best regards,', 'Kind regards from Switzerland,', 'Warm regards from Switzerland,'];
const OWN_DOMAINS = ['faltintravel.com', 'faltin-travel.ch', 'faltintravel.ch'];
const MAX_TOTAL = 25 * 1024 * 1024;

interface Attachment { name: string; contentType: string; size: number; contentBytes: string }
interface ContactHit extends MailAddress { source: string; detail: string }

interface Props {
  seed: ComposeSeed;
  accounts: AccountsResponse;
  templates: MailTemplate[];
  onClose: () => void;
  onSent: (msg: string) => void;
  onAssistMode: (m: AssistMode) => void;
  onOpenTemplates: () => void;
  /** Wird gesetzt, wenn im Vorlagen-Dialog «Verwenden» geklickt wurde. */
  injectTemplate: MailTemplate | null;
  onInjected: () => void;
}

const isInternal = (a: MailAddress) => OWN_DOMAINS.some((d) => a.address.toLowerCase().endsWith('@' + d));
const validAddr = (s: string) => /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(s.trim());

function parseAddr(raw: string): MailAddress | null {
  const s = raw.trim().replace(/[;,]$/, '');
  const m = s.match(/^(.*)<([^>]+)>$/);
  const address = (m ? m[2] : s).trim().toLowerCase();
  if (!validAddr(address)) return null;
  return { name: m ? m[1].trim().replace(/^"|"$/g, '') : '', address };
}

/** [[key]] im Editor als gelbe Lücke markieren. */
export function markGaps(html: string): string {
  return html.replace(/\[\[([\w.]+)\]\]/g, '<mark data-gap="$1" style="background:#fde68a;border-radius:3px;padding:0 2px">[[$1]]</mark>');
}

function templateHtml(body: string, vars: Record<string, string>): string {
  // Abschnitte {{#key}}…{{/key}} nur, wenn key gesetzt
  const sec = body.replace(/\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, k: string, inner: string) => (vars[k] ? inner : ''));
  return markGaps(textToHtml(fillPlaceholders(sec, vars)));
}

function readFile(f: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      resolve({ name: f.name, contentType: f.type || 'application/octet-stream', size: f.size, contentBytes: s.slice(s.indexOf(',') + 1) });
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
}

/* ───────────────────────── Empfänger-Feld ───────────────────────── */

function RecipientField({ label, value, onChange, autoFocus }: { label: string; value: MailAddress[]; onChange: (v: MailAddress[]) => void; autoFocus?: boolean }) {
  const [text, setText] = useState('');
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [idx, setIdx] = useState(0);
  const [focus, setFocus] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) { setHits([]); return; }
    const my = ++seq.current;
    const t = setTimeout(() => {
      api<{ contacts: ContactHit[] }>(`contacts?q=${encodeURIComponent(q)}`)
        .then((r) => { if (my === seq.current) { setHits(r.contacts.filter((c) => !value.some((v) => v.address === c.address))); setIdx(0); } })
        .catch(() => undefined);
    }, 160);
    return () => clearTimeout(t);
  }, [text, value]);

  const add = (a: MailAddress | null) => {
    if (!a) return false;
    if (!value.some((v) => v.address === a.address)) onChange([...value, a]);
    setText(''); setHits([]);
    return true;
  };

  const commitText = () => {
    const parts = text.split(/[;,\s]+(?=[^>]*(?:<|$))/).map((x) => x.trim()).filter(Boolean);
    let ok = false;
    for (const p of parts) ok = add(parseAddr(p)) || ok;
    return ok;
  };

  return (
    <div className="relative flex min-h-[38px] flex-wrap items-center gap-1 border-b px-3 py-1" style={{ borderColor: '#eef1f5' }}>
      <span className="w-12 shrink-0 text-[12.5px] text-slate-400">{label}</span>
      {value.map((a) => (
        <span key={a.address} title={a.address}
          className={`inline-flex max-w-[260px] items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-[12.5px] ${isInternal(a) ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-[#8a3a12]'}`}>
          <span className="truncate">{a.name || a.address}</span>
          <button onClick={() => onChange(value.filter((v) => v.address !== a.address))} className="rounded-full p-0.5 hover:bg-black/10" aria-label="Entfernen">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => { setTimeout(() => setFocus(false), 150); if (text.trim()) commitText(); }}
        onPaste={(e) => {
          const t = e.clipboardData.getData('text');
          if (/[;,\n]/.test(t)) { e.preventDefault(); for (const p of t.split(/[;,\n]+/)) add(parseAddr(p)); }
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)); }
          else if (e.key === 'ArrowUp' && hits.length) { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
          else if ((e.key === 'Enter' || e.key === 'Tab') && hits.length && text.trim()) { e.preventDefault(); add(hits[idx]); }
          else if (e.key === 'Enter' || e.key === ',' || e.key === ';') { if (text.trim()) { e.preventDefault(); commitText(); } }
          else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
        }}
        className="min-w-[140px] flex-1 bg-transparent py-1 text-[13.5px] outline-none"
        placeholder={value.length ? '' : 'Name, Kunde oder Adresse …'}
      />
      {focus && hits.length > 0 && (
        <div className="absolute left-14 top-full z-30 mt-1 w-[min(420px,90%)] overflow-hidden rounded-xl border bg-white shadow-xl" style={{ borderColor: '#e3e8ef' }}>
          {hits.map((h, i) => (
            <button key={h.address} onMouseDown={(e) => { e.preventDefault(); add(h); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${i === idx ? 'bg-slate-50' : ''}`}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-bold text-white" style={{ background: h.source === 'kunde' ? '#d9531e' : h.source === 'team' ? '#143047' : '#8a94a3' }}>
                {initials(h.name, h.address)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-slate-800">{h.name || h.address}</span>
                <span className="block truncate text-[11.5px] text-slate-500">{h.address}{h.detail ? ` · ${h.detail}` : ''}</span>
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">{h.source}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Bausteine-Palette ───────────────────────── */

function Palette({ items, onPick, onClose, title }: { items: MailTemplate[]; onPick: (t: MailTemplate) => void; onClose: () => void; title: string }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const list = useMemo(() => {
    const s = q.toLowerCase().trim();
    const f = s ? items.filter((t) => `${t.title} ${t.category} ${t.shortcut} ${t.body}`.toLowerCase().includes(s)) : items;
    return [...f].sort((a, b) => (s && a.shortcut.startsWith(s) ? -1 : 0) - (s && b.shortcut.startsWith(s) ? -1 : 0) || b.uses - a.uses).slice(0, 40);
  }, [q, items]);
  useEffect(() => setI(0), [q]);
  const cur = list[i];
  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-slate-900/20 p-4 pt-16 backdrop-blur-[1px]" onMouseDown={onClose}>
      <div className="flex max-h-[70%] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl" style={{ borderColor: '#e3e8ef' }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: '#eef1f5' }}>
          <Search className="h-4 w-4 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${title} suchen …`}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, list.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
              else if (e.key === 'Enter' && cur) { e.preventDefault(); onPick(cur); }
              else if (e.key === 'Escape') onClose();
            }}
            className="flex-1 bg-transparent text-[14px] outline-none" />
          <kbd className="rounded border px-1.5 text-[10.5px] text-slate-400">Esc</kbd>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[1fr_1.1fr]">
          <div className="min-h-0 overflow-y-auto py-1">
            {list.map((t, k) => (
              <button key={t.id} onMouseEnter={() => setI(k)} onClick={() => onPick(t)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${k === i ? 'bg-orange-50' : ''}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-800">{t.title}</span>
                  <span className="block truncate text-[11px] text-slate-500">{t.category}{t.lang === 'en' ? ' · EN' : ''}{t.owner ? ' · persönlich' : ''}</span>
                </span>
                {t.shortcut && <code className="rounded bg-slate-100 px-1 text-[10.5px] text-slate-500">/{t.shortcut}</code>}
              </button>
            ))}
            {!list.length && <div className="px-3 py-6 text-center text-[12.5px] text-slate-400">Nichts gefunden.</div>}
          </div>
          <div className="hidden min-h-0 overflow-y-auto border-l bg-slate-50/60 p-3 text-[12.5px] leading-relaxed text-slate-600 sm:block" style={{ borderColor: '#eef1f5' }}>
            {cur ? (
              <>
                {cur.subject && <div className="mb-2 text-[11.5px] text-slate-500">Betreff: <span className="text-slate-700">{cur.subject}</span></div>}
                <div className="whitespace-pre-wrap">{cur.body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, '‹$1›')}</div>
                {cur.greeting && <div className="mt-2 whitespace-pre-wrap text-slate-400">{cur.greeting}</div>}
                {cur.description && <div className="mt-3 border-t pt-2 text-[11.5px] text-slate-400" style={{ borderColor: '#e3e8ef' }}>{cur.description}</div>}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Composer ───────────────────────── */

export default function Composer(p: Props) {
  const { seed, accounts } = p;
  const sendable = accounts.mailboxes.filter((m) => m.canSend);
  const [from, setFrom] = useState(() => (sendable.find((m) => m.address === seed.from) || sendable[0] || accounts.mailboxes[0])?.address || '');
  const [to, setTo] = useState<MailAddress[]>(seed.to);
  const [cc, setCc] = useState<MailAddress[]>(seed.cc);
  const [bcc, setBcc] = useState<MailAddress[]>([]);
  const [showCc, setShowCc] = useState(seed.cc.length > 0);
  const [subject, setSubject] = useState(seed.subject);
  const [lang, setLang] = useState<'de' | 'en'>('de');
  const [greeting, setGreeting] = useState(seed.greeting || 'Freundliche Grüsse');
  const [sigMode, setSigMode] = useState<'auto' | 'on' | 'off'>('auto');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [important, setImportant] = useState(false);
  const [big, setBig] = useState(false);
  const [fromOpen, setFromOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string[] | null>(null);
  const [undo, setUndo] = useState<{ html: string; subject: string } | null>(null);
  const [palette, setPalette] = useState<null | 'baustein' | 'vorlage'>(null);
  const [busy, setBusy] = useState<null | 'send' | 'draft'>(null);
  const [error, setError] = useState<string | null>(null);
  const [gaps, setGaps] = useState(0);
  const [usedTemplates, setUsedTemplates] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mode = accounts.prefs.assist_mode;
  const modeInfo = ASSIST_MODES.find((m) => m.k === mode) || ASSIST_MODES[0];
  const fromBox = accounts.mailboxes.find((m) => m.address === from) as MailboxInfo | undefined;

  const allRecipients = [...to, ...cc, ...bcc];
  const internalOnly = allRecipients.length > 0 && allRecipients.every(isInternal);
  const withSignature = sigMode === 'on' || (sigMode === 'auto' && !internalOnly);
  const signature = accounts.signatures[lang]?.[from] || '';
  const vars = useMemo(() => ({ ...seed.vars, 'absender.vorname': accounts.user.firstName, 'absender.name': accounts.user.name }), [seed.vars, accounts.user]);

  const countGaps = useCallback(() => setGaps(editor.current?.querySelectorAll('mark[data-gap]').length || 0), []);

  // Start-Inhalt
  useEffect(() => {
    if (editor.current) {
      editor.current.innerHTML = seed.html || '<p><br></p>';
      countGaps();
      if (seed.html) editor.current.focus();
    }
  }, [seed.key, seed.html, countGaps]);

  const saveSel = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSel = () => {
    editor.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
  };
  const exec = (cmd: string, val?: string) => { restoreSel(); document.execCommand(cmd, false, val); saveSel(); };

  const nextGap = () => {
    const m = editor.current?.querySelector('mark[data-gap]');
    if (!m) return;
    const r = document.createRange();
    r.selectNodeContents(m);
    const sel = window.getSelection();
    sel?.removeAllRanges(); sel?.addRange(r);
    (m as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
    editor.current?.focus();
  };

  const editorEmpty = () => !htmlToText(editor.current?.innerHTML || '').trim();

  /** Baustein als eigene Absätze einfügen: leere Zeile ersetzen, sonst nach der aktuellen Zeile. */
  const insertBlocks = (html: string) => {
    const root = editor.current;
    if (!root) return;
    const sel = window.getSelection();
    let block: Node | null = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
    while (block && block.parentNode !== root) block = block.parentNode;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const nodes = Array.from(tpl.content.childNodes);
    if (!nodes.length) return;
    const last = nodes[nodes.length - 1];
    if (!block) root.append(...nodes);
    else if (!(block.textContent || '').trim()) (block as ChildNode).replaceWith(...nodes);
    else (block as ChildNode).after(...nodes);
    const r = document.createRange();
    r.selectNodeContents(last);
    r.collapse(false);
    sel?.removeAllRanges(); sel?.addRange(r);
    saveSel();
  };

  const applyTemplate = useCallback((t: MailTemplate) => {
    setPalette(null);
    setUsedTemplates((u) => (u.includes(t.id) ? u : [...u, t.id]));
    const html = templateHtml(t.body, vars);
    if (t.kind === 'vorlage') {
      if (!editorEmpty() && !window.confirm('Den bisherigen Text durch die Vorlage ersetzen?')) return;
      setUndo({ html: editor.current?.innerHTML || '', subject });
      if (editor.current) editor.current.innerHTML = html;
      if (t.subject && (!subject.trim() || seed.mode === 'new')) setSubject(fillPlaceholders(t.subject, vars).replace(/\[\[[\w.]+\]\]/g, '').replace(/\s+/g, ' ').trim());
      if (t.greeting) setGreeting(t.greeting);
      setLang(t.lang === 'en' ? 'en' : 'de');
    } else {
      restoreSel();
      // Einen «/kürzel»-Rest vor dem Cursor entfernen
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const r = sel.getRangeAt(0);
        const node = r.startContainer;
        if (node.nodeType === 3) {
          const before = (node.textContent || '').slice(0, r.startOffset);
          const m = before.match(/\/[\w-]*$/);
          if (m) { const del = document.createRange(); del.setStart(node, r.startOffset - m[0].length); del.setEnd(node, r.startOffset); del.deleteContents(); }
        }
      }
      insertBlocks(html);
      if (t.greeting) setGreeting(t.greeting);
    }
    setTimeout(() => { countGaps(); nextGap(); }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vars, subject, seed.mode, countGaps]);

  // Vorlage aus dem Vorlagen-Dialog übernehmen
  useEffect(() => {
    if (p.injectTemplate) { applyTemplate(p.injectTemplate); p.onInjected(); }
  }, [p.injectTemplate, p, applyTemplate]);

  const runAi = async (m: AssistMode) => {
    setAiOpen(false);
    if (m !== mode) p.onAssistMode(m);
    const text = htmlToText(editor.current?.innerHTML || '');
    if (!text.trim()) { setError('Erst etwas tippen — die KI überarbeitet deinen Text.'); return; }
    setAiBusy(true); setError(null); setAiNote(null);
    try {
      const r = await api<{ text: string; subject?: string; hinweise?: string[] }>('ai', {
        json: {
          action: 'compose', mode: m, text, subject, from,
          reference: seed.reference ? { mb: seed.reference.mb, id: seed.reference.id } : undefined,
          recipientName: to[0]?.name || undefined,
        },
      });
      setUndo({ html: editor.current?.innerHTML || '', subject });
      if (editor.current) editor.current.innerHTML = markGaps(textToHtml(r.text));
      if (r.subject && (!subject.trim() || m === 'englisch')) setSubject(r.subject);
      if (m === 'englisch') { setLang('en'); setGreeting((g) => (GREETINGS_EN.includes(g) ? g : 'Kind regards,')); }
      setAiNote(r.hinweise?.length ? r.hinweise : []);
      countGaps();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const doUndo = () => {
    if (!undo) return;
    if (editor.current) editor.current.innerHTML = undo.html;
    setSubject(undo.subject);
    setUndo(null); setAiNote(null); countGaps();
  };

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const total = attachments.reduce((s, a) => s + a.size, 0) + list.reduce((s, f) => s + f.size, 0);
    if (total > MAX_TOTAL) { setError(`Anhänge zusammen max. ${fileSize(MAX_TOTAL)}.`); return; }
    const read = await Promise.all(list.map(readFile));
    setAttachments((a) => [...a, ...read]);
  };

  const finalHtml = () => {
    const body = (editor.current?.innerHTML || '').replace(/<mark data-gap="[^"]*"[^>]*>([\s\S]*?)<\/mark>/g, '$1');
    const g = greeting.trim();
    const greet = g ? `<p>${escapeHtml(g).replace(/\n/g, '<br>')}${withSignature ? '' : `<br>${escapeHtml(accounts.user.firstName)}`}</p>` : '';
    const sig = withSignature && signature ? `<div style="margin-top:12px">${signature}</div>` : '';
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a">${body}${greet}${sig}</div>`;
  };

  const send = async (draftOnly = false) => {
    setError(null);
    if (!draftOnly) {
      if (!allRecipients.length) { setError('Bitte mindestens eine Empfängeradresse eintragen.'); return; }
      if (gaps > 0 && !window.confirm(`Es sind noch ${gaps} gelb markierte Lücke(n) im Text. Trotzdem senden?`)) { nextGap(); return; }
      if (!subject.trim() && !window.confirm('Ohne Betreff senden?')) return;
    }
    setBusy(draftOnly ? 'draft' : 'send');
    try {
      const sameBox = seed.reference && seed.reference.mb === from;
      let html = finalHtml();
      if (seed.reference && !sameBox && seed.quoted) {
        html += `<hr style="border:none;border-top:1px solid #ccc;margin:16px 0"><p style="color:#555">Von: ${escapeHtml(seed.quoted.from)}<br>Gesendet: ${escapeHtml(seed.quoted.date)}<br>Betreff: ${escapeHtml(seed.subject)}</p><p style="color:#555">${escapeHtml(seed.quoted.preview)}</p>`;
      }
      const r = await api<{ sent: boolean; webLink: string }>('send', {
        json: {
          from, to, cc, bcc, subject, html, attachments, draftOnly, importance: important ? 'high' : undefined,
          reference: sameBox ? { mb: seed.reference!.mb, id: seed.reference!.id, mode: seed.reference!.mode } : undefined,
          templateIds: usedTemplates,
        },
      });
      if (draftOnly) {
        if (r.webLink) window.open(r.webLink, '_blank', 'noopener');
        p.onSent('Entwurf in Outlook gespeichert');
      } else {
        p.onSent(`Gesendet aus ${fromBox ? shortMailbox(fromBox) : from}`);
      }
      p.onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void send(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); saveSel(); setPalette('baustein'); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') { /* Browser: einfügen ohne Format */ }
    else if (e.key === 'Escape' && !palette) { if (editorEmpty() || window.confirm('Mail verwerfen?')) p.onClose(); }
  };

  const onEditorKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && gaps > 0) { e.preventDefault(); nextGap(); return; }
    if (e.key === '/') {
      // «/» am Zeilenanfang öffnet die Bausteine
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      const before = node && node.nodeType === 3 ? (node.textContent || '').slice(0, sel!.anchorOffset) : '';
      if (!before.trim()) { e.preventDefault(); saveSel(); setPalette('baustein'); }
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html');
    if (e.clipboardData.files.length) { e.preventDefault(); void addFiles(e.clipboardData.files); return; }
    if (html) {
      // Fremd-Formatierung (Word, Webseiten) entfernen, Absätze behalten
      e.preventDefault();
      document.execCommand('insertHTML', false, textToHtml(e.clipboardData.getData('text/plain')));
    }
  };

  const bausteine = p.templates.filter((t) => t.kind === 'baustein');
  const vorlagen = p.templates.filter((t) => t.kind === 'vorlage');
  const color = mailboxColor(from, accounts.mailboxes);
  const title = seed.mode === 'new' ? 'Neue Mail' : seed.mode === 'forward' ? 'Weiterleiten' : 'Antworten';

  return (
    <div
      className={`fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl ${big
        ? 'inset-0 sm:inset-6 sm:rounded-2xl'
        : 'inset-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(760px,calc(100vh-32px))] sm:w-[min(760px,calc(100vw-32px))] sm:rounded-2xl'}`}
      style={{ border: '1px solid #dde2e8' }}
      onKeyDown={onKeyDown}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files); }}
    >
      {/* Kopf */}
      <div className="flex items-center gap-2 px-4 py-2.5 text-white" style={{ background: '#143047' }}>
        <span className="text-[13.5px] font-semibold">{title}</span>
        {seed.quoted && <span className="truncate text-[12px] text-white/60">an {seed.quoted.from}</span>}
        <span className="flex-1" />
        <button onClick={() => setBig((b) => !b)} className="hidden rounded p-1 hover:bg-white/10 sm:block" title={big ? 'Verkleinern' : 'Vollbild'}>
          {big ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button onClick={() => { if (editorEmpty() || window.confirm('Mail verwerfen?')) p.onClose(); }} className="rounded p-1 hover:bg-white/10" title="Schliessen (Esc)">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Absender */}
      <div className="relative flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: '#eef1f5' }}>
        <span className="w-12 shrink-0 text-[12.5px] text-slate-400">Von</span>
        <button onClick={() => setFromOpen((o) => !o)} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50" title="Absender-Postfach wechseln">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[9.5px] font-bold text-white" style={{ background: color }}>
            {fromBox ? initials(fromBox.name, fromBox.address) : '?'}
          </span>
          <span className="truncate text-[13.5px] font-medium text-slate-800">{fromBox ? shortMailbox(fromBox) : from}</span>
          <span className="hidden truncate text-[12px] text-slate-400 sm:inline">&lt;{from}&gt;</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
        {seed.reference && seed.reference.mb !== from && (
          <span className="flex items-center gap-1 text-[11.5px] text-amber-700" title="Antwort aus einem anderen Postfach: wird als neue Mail mit Zitat gesendet.">
            <AlertTriangle className="h-3.5 w-3.5" /> anderes Postfach als die Originalmail
          </span>
        )}
        <span className="flex-1" />
        {!showCc && <button onClick={() => setShowCc(true)} className="text-[12px] text-slate-500 hover:text-slate-800">Cc/Bcc</button>}
        {fromOpen && (
          <div className="absolute left-14 top-full z-30 mt-1 w-[min(440px,90vw)] overflow-hidden rounded-xl border bg-white py-1 shadow-xl" style={{ borderColor: '#e3e8ef' }}>
            <div className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Senden als</div>
            {accounts.mailboxes.map((m) => (
              <button key={m.address} disabled={!m.canSend}
                onClick={() => { setFrom(m.address); setFromOpen(false); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-45 ${m.address === from ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold text-white" style={{ background: mailboxColor(m.address, accounts.mailboxes) }}>
                  {initials(m.name, m.address)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-800">{shortMailbox(m)}{m.kind === 'own' ? ' (ich)' : ''}</span>
                  <span className="block truncate text-[11.5px] text-slate-500">{m.address}{m.canSend ? '' : ' · nur lesen'}</span>
                </span>
                {m.address === from && <Check className="h-4 w-4 text-[#d9531e]" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <RecipientField label="An" value={to} onChange={setTo} autoFocus={seed.mode === 'new' || seed.mode === 'forward'} />
      {showCc && <RecipientField label="Cc" value={cc} onChange={setCc} />}
      {showCc && <RecipientField label="Bcc" value={bcc} onChange={setBcc} />}
      <div className="flex items-center border-b px-3" style={{ borderColor: '#eef1f5' }}>
        <span className="w-12 shrink-0 text-[12.5px] text-slate-400">Betreff</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="flex-1 bg-transparent py-2 text-[14px] font-medium outline-none" placeholder="Betreff" />
        <button onClick={() => setImportant((x) => !x)} title="Wichtig" className={`rounded px-1.5 text-[13px] font-bold ${important ? 'text-red-600' : 'text-slate-300 hover:text-slate-500'}`}>!</button>
      </div>

      {/* Werkzeugleiste */}
      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1" style={{ borderColor: '#eef1f5', background: '#fafbfc' }}>
        {[
          { i: Bold, c: 'bold', t: 'Fett (Strg+B)' }, { i: Italic, c: 'italic', t: 'Kursiv (Strg+I)' }, { i: Underline, c: 'underline', t: 'Unterstrichen (Strg+U)' },
          { i: List, c: 'insertUnorderedList', t: 'Aufzählung' }, { i: ListOrdered, c: 'insertOrderedList', t: 'Nummerierung' },
        ].map(({ i: I, c, t }) => (
          <button key={c} onMouseDown={(e) => { e.preventDefault(); exec(c); }} title={t} className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-slate-800">
            <I className="h-4 w-4" />
          </button>
        ))}
        <button onMouseDown={(e) => { e.preventDefault(); saveSel(); const u = window.prompt('Link-Adresse'); if (u) exec('createLink', /^https?:|^mailto:/.test(u) ? u : `https://${u}`); }} title="Link" className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"><Link2 className="h-4 w-4" /></button>
        <button onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); }} title="Formatierung entfernen" className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"><Eraser className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button onMouseDown={(e) => { e.preventDefault(); saveSel(); setPalette('vorlage'); }} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-slate-600 hover:bg-white" title="Vorlage einsetzen">
          <BookText className="h-4 w-4" /> Vorlage
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); saveSel(); setPalette('baustein'); }} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-slate-600 hover:bg-white" title="Textbaustein (Strg+K oder / am Zeilenanfang)">
          <Puzzle className="h-4 w-4" /> Baustein <kbd className="ml-0.5 hidden rounded border px-1 text-[10px] text-slate-400 sm:inline">Strg K</kbd>
        </button>
        <button onClick={() => fileInput.current?.click()} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] text-slate-600 hover:bg-white" title="Datei anhängen (oder hineinziehen)">
          <Paperclip className="h-4 w-4" /> Anhang
        </button>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ''; }} />
        <span className="flex-1" />
        {gaps > 0 && (
          <button onClick={nextGap} className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[12px] font-medium text-amber-800 hover:bg-amber-200" title="Zur nächsten Lücke (Tab)">
            {gaps} Lücke{gaps > 1 ? 'n' : ''} ausfüllen
          </button>
        )}
      </div>

      {/* Text */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div
          ref={editor}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={onEditorKey}
          onKeyUp={() => { saveSel(); countGaps(); }}
          onMouseUp={saveSel}
          onInput={countGaps}
          onPaste={onPaste}
          spellCheck
          lang={lang === 'en' ? 'en' : 'de-CH'}
          className="mail-editor min-h-[180px] px-5 pb-2 pt-4 text-[14px] leading-relaxed text-slate-800 outline-none [&_a]:text-[#2c6fbb] [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-6"
          data-placeholder="Einfach drauflos tippen — die KI macht daraus auf Wunsch eine saubere Faltin-Mail …"
        />

        {/* Grussformel + Signatur */}
        <div className="px-5 pb-4">
          <div className="group relative mt-3 flex items-start gap-2">
            <textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              rows={greeting.split('\n').length}
              className="w-full max-w-[320px] resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[14px] text-slate-800 outline-none hover:border-slate-200 focus:border-slate-300"
              title="Grussformel (anpassbar)"
            />
            <select
              value=""
              onChange={(e) => { if (e.target.value) setGreeting(e.target.value); }}
              className="rounded-md border px-1 py-0.5 text-[11.5px] text-slate-500 opacity-60 transition group-hover:opacity-100"
              style={{ borderColor: '#e3e8ef' }}
              title="Grussformel wählen"
            >
              <option value="">Gruss …</option>
              {(lang === 'en' ? GREETINGS_EN : GREETINGS_DE).map((g) => <option key={g} value={g}>{g.replace('\n', ' / ')}</option>)}
              {(lang === 'en' ? GREETINGS_DE : GREETINGS_EN).map((g) => <option key={g} value={g}>{g.replace('\n', ' / ')}</option>)}
            </select>
          </div>
          {!withSignature && <div className="px-1 text-[14px] text-slate-800">{accounts.user.firstName}</div>}
          <div className="mt-2 flex items-center gap-2 text-[11.5px] text-slate-400">
            <span className="h-px flex-1 bg-slate-100" />
            <button onClick={() => setSigMode(withSignature ? 'off' : 'on')} className="rounded px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-600">
              Signatur {withSignature ? 'an' : 'aus'}{sigMode === 'auto' && internalOnly ? ' (intern)' : ''}
            </button>
            <button onClick={() => setLang((l) => (l === 'de' ? 'en' : 'de'))} className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-600" title="Sprache von Signatur und Grussformel">
              <Languages className="h-3 w-3" /> {lang.toUpperCase()}
            </button>
          </div>
          {withSignature && signature && (
            <div className="pointer-events-none mt-1 select-none opacity-80" dangerouslySetInnerHTML={{ __html: signature }} />
          )}
          {seed.quoted && (
            <div className="mt-4 rounded-lg border-l-2 bg-slate-50 px-3 py-2 text-[12px] text-slate-500" style={{ borderColor: '#cbd3dc' }}>
              <div className="font-medium text-slate-600">{seed.quoted.from} · {seed.quoted.date}</div>
              <div className="mt-0.5 line-clamp-3">{seed.quoted.preview}</div>
              <div className="mt-1 text-[11px] text-slate-400">{seed.reference && seed.reference.mb === from ? 'Der Verlauf wird automatisch angehängt (wie in Outlook).' : 'Wird als Zitat unter die Mail gesetzt.'}</div>
            </div>
          )}
        </div>
        {dragOver && <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-xl border-2 border-dashed border-[#d9531e] bg-orange-50/80 text-[14px] font-medium text-[#d9531e]">Dateien hier ablegen</div>}
      </div>

      {/* Anhänge */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t px-3 py-2" style={{ borderColor: '#eef1f5' }}>
          {attachments.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1 text-[12px]" style={{ borderColor: '#e3e8ef' }}>
              <Paperclip className="h-3 w-3 text-slate-400" /> <span className="max-w-[200px] truncate">{a.name}</span>
              <span className="text-slate-400">{fileSize(a.size)}</span>
              <button onClick={() => setAttachments((x) => x.filter((_, k) => k !== i))} className="rounded p-0.5 hover:bg-slate-100"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}

      {/* KI-Hinweise / Fehler */}
      {(aiNote || error) && (
        <div className={`flex items-start gap-2 border-t px-4 py-2 text-[12.5px] ${error ? 'bg-red-50 text-red-700' : 'bg-violet-50 text-violet-800'}`} style={{ borderColor: '#eef1f5' }}>
          {error ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="min-w-0 flex-1">
            {error || (aiNote && aiNote.length ? aiNote.map((h, i) => <div key={i}>{h}</div>) : 'Überarbeitet. Bitte kurz gegenlesen.')}
          </div>
          {undo && !error && <button onClick={doUndo} className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-medium hover:bg-white/60"><Undo2 className="h-3.5 w-3.5" /> Rückgängig</button>}
          <button onClick={() => { setAiNote(null); setError(null); }} className="shrink-0 rounded p-0.5 hover:bg-white/60"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Fuss */}
      <div className="flex items-center gap-2 border-t px-3 py-2.5" style={{ borderColor: '#eef1f5' }}>
        <button
          onClick={() => void send()}
          disabled={!!busy || aiBusy}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
          style={{ background: '#d9531e' }}
          title="Senden (Strg+Enter)"
        >
          {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Senden
        </button>

        {/* KI-Split-Button */}
        {accounts.aiReady && (
          <div className="relative flex">
            <button
              onClick={() => void runAi(mode)}
              disabled={aiBusy || !!busy}
              className="flex items-center gap-1.5 rounded-l-xl border py-2 pl-3 pr-2.5 text-[13px] font-medium text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
              style={{ borderColor: '#ddd6fe' }}
              title={modeInfo.hint}
            >
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span className="hidden sm:inline">{modeInfo.label}</span>
              <span className="sm:hidden">KI</span>
            </button>
            <button onClick={() => setAiOpen((o) => !o)} disabled={aiBusy} className="rounded-r-xl border border-l-0 px-1.5 text-violet-700 hover:bg-violet-50" style={{ borderColor: '#ddd6fe' }} title="KI-Aktion wählen">
              <ChevronDown className="h-4 w-4" />
            </button>
            {aiOpen && (
              <div className="absolute bottom-full left-0 z-30 mb-2 w-[300px] overflow-hidden rounded-xl border bg-white py-1 shadow-xl" style={{ borderColor: '#e3e8ef' }}>
                <div className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">KI-Aktion (wird gemerkt)</div>
                {ASSIST_MODES.map((m) => (
                  <button key={m.k} onClick={() => void runAi(m.k)} className={`flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-violet-50 ${m.k === mode ? 'bg-violet-50/60' : ''}`}>
                    <span className="mt-0.5 w-4">{m.k === mode && <Check className="h-4 w-4 text-violet-600" />}</span>
                    <span>
                      <span className="block text-[13px] font-medium text-slate-800">{m.label}</span>
                      <span className="block text-[11.5px] text-slate-500">{m.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {undo && !aiNote && (
          <button onClick={doUndo} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] text-slate-500 hover:bg-slate-100" title="Letzte Änderung durch KI/Vorlage zurücknehmen">
            <Undo2 className="h-4 w-4" /> <span className="hidden sm:inline">Rückgängig</span>
          </button>
        )}
        <span className="flex-1" />
        <button onClick={() => void send(true)} disabled={!!busy} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] text-slate-500 hover:bg-slate-100" title="Als Entwurf im Postfach speichern und in Outlook öffnen">
          {busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} <span className="hidden sm:inline">Entwurf in Outlook</span>
        </button>
      </div>

      {palette && (
        <Palette
          title={palette === 'vorlage' ? 'Vorlagen' : 'Bausteine'}
          items={palette === 'vorlage' ? vorlagen : bausteine}
          onPick={applyTemplate}
          onClose={() => { setPalette(null); restoreSel(); }}
        />
      )}
      {palette === 'vorlage' && (
        <button onClick={() => { setPalette(null); p.onOpenTemplates(); }} className="absolute bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-[12px] text-slate-600 shadow">
          Vorlagen verwalten …
        </button>
      )}
    </div>
  );
}

'use client';

/**
 * SimpleRichEditor — bewusst schlanker WYSIWYG-Editor für E-Mail-Texte
 * (Auto-Antwort): Fett, Kursiv, Unterstrichen, Listen, Links im Fließtext,
 * plus Vollbild-Modus zum bequemen Bearbeiten (ESC verlässt ihn).
 *
 * - Speichert HTML (String) über onChange; Klartext-Bestände (Legacy) werden
 *   beim Laden zu HTML konvertiert (Zeilenumbrüche → <br>).
 * - Einfügen aus der Zwischenablage immer als Klartext (kein Word-HTML-Müll).
 * - Serverseitig wird das HTML zusätzlich sanitisiert (emailTemplates).
 */
import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link2, Unlink, Maximize2, Minimize2 } from 'lucide-react';
import { COLORS } from './ui';

export interface SimpleRichEditorHandle {
  /** Text (z.B. einen {{platzhalter}}) an der aktuellen Cursor-Position einfügen. */
  insertText: (text: string) => void;
}

function escapePlain(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Klartext (Legacy-Bestand) → HTML für den Editor; HTML bleibt unangetastet. */
function toEditorHtml(value: string): string {
  if (!value) return '';
  if (/<[a-z][^>]*>/i.test(value)) return value;
  return value.split('\n').map(escapePlain).join('<br>');
}

/** Leere Editor-Reste ('<br>', leere Divs) als leeren Wert behandeln. */
function normalizeEmpty(html: string): string {
  const stripped = html.replace(/<br\s*\/?>/gi, '').replace(/<\/?(div|p|span)[^>]*>/gi, '').replace(/&nbsp;/gi, ' ').trim();
  return stripped ? html : '';
}

export default function SimpleRichEditor({
  value,
  onChange,
  placeholder,
  minHeight = 180,
  editorRef,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  editorRef?: React.MutableRefObject<SimpleRichEditorHandle | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtml = useRef<string>('');
  const savedRange = useRef<Range | null>(null);
  const [full, setFull] = useState(false);

  // Externen Wert nur übernehmen, wenn er nicht vom eigenen Tippen stammt
  // (sonst springt der Cursor bei jedem Anschlag an den Anfang).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = toEditorHtml(value || '');
    if (html !== lastHtml.current && html !== el.innerHTML) {
      el.innerHTML = html;
      lastHtml.current = html;
    }
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = normalizeEmpty(el.innerHTML);
    lastHtml.current = el.innerHTML;
    onChange(html);
  };

  const saveSel = () => {
    const s = window.getSelection();
    if (s && s.rangeCount > 0 && ref.current && ref.current.contains(s.anchorNode)) {
      savedRange.current = s.getRangeAt(0).cloneRange();
    }
  };
  const restoreSel = () => {
    const r = savedRange.current;
    if (!r) return;
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  };

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    restoreSel();
    document.execCommand(cmd, false, arg);
    saveSel();
    emit();
  };

  const setLink = () => {
    ref.current?.focus();
    restoreSel();
    const url = window.prompt('Link-Ziel (https://… oder mailto:…):', 'https://');
    if (!url || !/^(https?:\/\/|mailto:)/i.test(url.trim())) return;
    document.execCommand('createLink', false, url.trim());
    saveSel();
    emit();
  };

  useEffect(() => {
    if (!editorRef) return;
    editorRef.current = {
      insertText: (text: string) => {
        ref.current?.focus();
        restoreSel();
        document.execCommand('insertText', false, text);
        saveSel();
        emit();
      },
    };
    return () => { editorRef.current = null; };
  });

  // ESC verlässt den Vollbild-Modus
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const ToolBtn = ({ title, onAction, children }: { title: string; onAction: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      // preventDefault auf mousedown: sonst verliert der Editor die Auswahl vor dem Klick
      onMouseDown={(e) => e.preventDefault()}
      onClick={onAction}
      className="rounded-md p-1.5 transition hover:bg-gray-100"
      style={{ color: COLORS.navy }}
    >
      {children}
    </button>
  );

  return (
    <div className={full ? 'fixed inset-0 z-[100] flex flex-col bg-black/30 p-3 sm:p-8' : ''} onClick={full ? () => setFull(false) : undefined}>
      <div
        className={`flex w-full flex-col rounded-lg border bg-white ${full ? 'h-full shadow-2xl' : ''}`}
        style={{ borderColor: COLORS.stroke }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border-b px-1.5 py-1" style={{ borderColor: COLORS.stroke, background: '#fafbfc' }}>
          <ToolBtn title="Fett (auf Auswahl)" onAction={() => exec('bold')}><Bold className="h-4 w-4" /></ToolBtn>
          <ToolBtn title="Kursiv" onAction={() => exec('italic')}><Italic className="h-4 w-4" /></ToolBtn>
          <ToolBtn title="Unterstrichen" onAction={() => exec('underline')}><Underline className="h-4 w-4" /></ToolBtn>
          <span className="mx-1 h-5 w-px" style={{ background: COLORS.stroke }} />
          <ToolBtn title="Aufzählung" onAction={() => exec('insertUnorderedList')}><List className="h-4 w-4" /></ToolBtn>
          <ToolBtn title="Nummerierte Liste" onAction={() => exec('insertOrderedList')}><ListOrdered className="h-4 w-4" /></ToolBtn>
          <span className="mx-1 h-5 w-px" style={{ background: COLORS.stroke }} />
          <ToolBtn title="Link auf Auswahl setzen" onAction={setLink}><Link2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn title="Link entfernen" onAction={() => exec('unlink')}><Unlink className="h-4 w-4" /></ToolBtn>
          <span className="ml-auto" />
          <ToolBtn title={full ? 'Vollbild verlassen (ESC)' : 'Vollbild zum Bearbeiten'} onAction={() => setFull((f) => !f)}>
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </ToolBtn>
        </div>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onKeyUp={saveSel}
          onMouseUp={saveSel}
          onBlur={saveSel}
          onPaste={(e) => {
            e.preventDefault();
            const t = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, t);
          }}
          data-placeholder={placeholder || ''}
          className="ftre-editor w-full flex-1 overflow-y-auto rounded-b-lg px-3 py-2 text-sm focus:outline-none"
          style={{ minHeight: full ? undefined : minHeight, color: COLORS.navy, lineHeight: 1.6 }}
        />
      </div>
      {/* Placeholder-Anzeige + sichtbare Links im Editor */}
      <style>{`
        .ftre-editor:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
        .ftre-editor a { color: #d9531e; text-decoration: underline; }
        .ftre-editor ul { list-style: disc; padding-left: 1.4em; }
        .ftre-editor ol { list-style: decimal; padding-left: 1.4em; }
      `}</style>
    </div>
  );
}

'use client';

/**
 * EventLiveEditor – In-Place-Bearbeitung direkt auf der echten Event-Seite.
 * ───────────────────────────────────────────────────────────────────────────
 * - Sichtbar nur für eingeloggte Admins (sessionStorage 'admin_authenticated').
 * - "Bearbeiten"-Schalter blendet den WYSIWYG-Modus von EventPageView ein.
 *   EventPageView postet Edits via window.parent.postMessage – auf der echten
 *   Seite ist parent === window, daher hören wir die Messages hier lokal ab.
 * - Inline-Text  -> direktes Tippen, debounced-Autosave (PUT /api/admin/events/:id)
 * - Modul-Klick  -> Slide-over-Panel: einfache Felder ODER Struktur-Editoren
 *   (Ticket-Kategorien, Spielplan-Tabelle, FAQs) – alles mit Auto-Save.
 * - Bild-Felder mit Upload + Lokalisierung von Remote-URLs.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import EventPageView from './EventPageView';
import MediaLibraryDialog from '@/components/admin/MediaLibraryDialog';

type ViewProps = React.ComponentProps<typeof EventPageView>;
type Props = Omit<ViewProps, 'editable'>;
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type FieldType = 'text' | 'textarea' | 'image' | 'list';
interface FieldDef { key: string; label: string; type: FieldType }
type EditorKind = 'fields' | 'ticketCategories' | 'spielplan' | 'faqs';
interface GroupDef { title: string; editor: EditorKind; fields?: FieldDef[]; note?: string; deepLink?: 'event' | 'series' }

interface TicketCat { name: string; items: string[]; note?: string | null }
interface SpielplanRow { date: string; session: string; matchup: string; round: string }
interface Faq { id?: string; question: string; answer: string }

const GROUPS: Record<string, GroupDef> = {
  hero_image: { title: 'Hero-Bild', editor: 'fields', fields: [{ key: 'hero_image', label: 'Hero-Bild', type: 'image' }] },
  location: {
    title: 'Ort & Termin', editor: 'fields', fields: [
      { key: 'location_name', label: 'Location-Name', type: 'text' },
      { key: 'venue', label: 'Venue', type: 'text' },
      { key: 'location_city', label: 'Stadt', type: 'text' },
      { key: 'location_region', label: 'Region', type: 'text' },
      { key: 'location_country', label: 'Land (Code, z.B. FR)', type: 'text' },
      { key: 'start_date', label: 'Start (YYYY-MM-DD)', type: 'text' },
      { key: 'end_date', label: 'Ende (YYYY-MM-DD)', type: 'text' },
    ],
  },
  leistungen_items: {
    title: 'Unsere Leistungen', editor: 'fields', fields: [
      { key: 'leistungen_title', label: 'Titel', type: 'text' },
      { key: 'leistungen_image', label: 'Bild', type: 'image' },
      { key: 'leistungen_items', label: 'Punkte (eine pro Zeile)', type: 'list' },
    ],
  },
  about: {
    title: 'Überblick', editor: 'fields', fields: [
      { key: 'first_paragraph_heading', label: 'Überschrift', type: 'text' },
      { key: 'first_paragraph_text', label: 'Text', type: 'textarea' },
    ],
  },
  wissenswertes: {
    title: 'Wissenswertes', editor: 'fields', fields: [
      { key: 'wissenswertes_title', label: 'Titel', type: 'text' },
      { key: 'wissenswertes_text', label: 'Text', type: 'textarea' },
      { key: 'wissenswertes_accordion_title', label: 'Akkordeon-Titel', type: 'text' },
      { key: 'wissenswertes_accordion_text', label: 'Akkordeon-Text', type: 'textarea' },
    ],
  },
  stadionplan: {
    title: 'Stadionplan', editor: 'fields', fields: [
      { key: 'stadionplan_title', label: 'Titel', type: 'text' },
      { key: 'stadionplan_venue_name', label: 'Venue-Name', type: 'text' },
      { key: 'stadionplan_image', label: 'Plan-Bild', type: 'image' },
      { key: 'stadionplan_description', label: 'Beschreibung', type: 'textarea' },
    ],
  },
  ticket_categories: {
    title: 'Ticket-Kategorien', editor: 'ticketCategories', fields: [
      { key: 'ticket_categories_title', label: 'Titel', type: 'text' },
      { key: 'ticket_categories_intro', label: 'Intro', type: 'textarea' },
    ],
  },
  about_images: {
    title: 'Überblick-Bilder', editor: 'fields', fields: [
      { key: 'first_paragraph_image_1', label: 'Bild 1', type: 'image' },
      { key: 'first_paragraph_image_2', label: 'Bild 2', type: 'image' },
      { key: 'first_paragraph_image_3', label: 'Bild 3', type: 'image' },
    ],
  },
  spielplan: { title: 'Spielplan', editor: 'spielplan' },
  faq: { title: 'FAQ', editor: 'faqs' },
  __seo__: {
    title: 'SEO / Meta', editor: 'fields', fields: [
      { key: 'seo_title', label: 'Meta-Titel (Suchergebnis-Titel)', type: 'text' },
      { key: 'seo_description', label: 'Meta-Description (Suchergebnis-Text)', type: 'textarea' },
    ],
    note: 'Leer lassen = automatisch aus Event-Titel/Beschreibung.',
  },
  lageplan: { title: 'Lageplan', editor: 'fields', fields: [], note: 'Die Karten-Pins im Voll-Editor (Pin-Map) bearbeiten.', deepLink: 'event' },
  series: { title: 'Serie', editor: 'fields', fields: [], note: 'Serien-Inhalte im Serien-Editor bearbeiten.', deepLink: 'series' },
};

const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm text-gray-900';
const inputStyle = { borderColor: '#d8dde4' } as React.CSSProperties;

/** Bild-Feld: URL + Upload + Remote-Lokalisierung + Vorschau + Alt/Title (SEO). */
function ImageField({ label, fieldKey, get, onChange }: { label: string; fieldKey: string; get: (k: string) => string; onChange: (field: string, value: string) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState(false);
  const value = get(fieldKey);

  const upload = async (file: File) => {
    setBusy('Lädt hoch…');
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/admin/media', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.success) onChange(fieldKey, d.data.url); else setBusy(d.error || 'Upload-Fehler');
    } catch { setBusy('Upload-Fehler'); } finally { setBusy((b) => (b === 'Lädt hoch…' ? null : b)); }
  };

  const localizeIfRemote = async (url: string) => {
    if (!/^https?:\/\//i.test(url)) return;
    setBusy('Lade Bild lokal…');
    try {
      const r = await fetch('/api/admin/media/localize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const d = await r.json();
      if (d.success && d.url) onChange(fieldKey, d.url);
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  return (
    <div className="rounded-lg border p-3" style={inputStyle}>
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mb-2 h-28 w-full rounded-md object-cover" />
      )}
      <input type="text" value={value} onChange={(e) => onChange(fieldKey, e.target.value)} onBlur={(e) => localizeIfRemote(e.target.value)} placeholder="/uploads/… oder URL einfügen" className={inputCls} style={inputStyle} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setLibOpen(true)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50" style={inputStyle}>🖼 Mediathek</button>
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50" style={inputStyle}>⬆ Upload</button>
        {value && <button type="button" onClick={() => onChange(fieldKey, '')} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Entfernen</button>}
        {busy && <span className="text-xs text-gray-500">{busy}</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
      <MediaLibraryDialog open={libOpen} onClose={() => setLibOpen(false)} onSelect={(url) => onChange(fieldKey, url)} />
      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] font-semibold text-gray-500">Alt-Text (SEO / Barrierefreiheit)</span>
        <input type="text" defaultValue={get(fieldKey + '_alt')} onChange={(e) => onChange(fieldKey + '_alt', e.target.value)} placeholder="Was zeigt das Bild?" className={inputCls} style={inputStyle} />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-[11px] font-semibold text-gray-500">Title (Tooltip beim Hovern)</span>
        <input type="text" defaultValue={get(fieldKey + '_title')} onChange={(e) => onChange(fieldKey + '_title', e.target.value)} placeholder="Optionaler Tooltip" className={inputCls} style={inputStyle} />
      </label>
    </div>
  );
}

export default function EventLiveEditor(props: Props) {
  const [event, setEvent] = useState<ViewProps['event']>(props.event);
  const [faqs, setFaqs] = useState<ViewProps['faqs']>(props.faqs);
  const [authed, setAuthed] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [save, setSave] = useState<SaveState>('idle');
  const [panelTarget, setPanelTarget] = useState<string | null>(null);

  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/auth/session').then((r) => r.json()).then((d) => { if (d?.authenticated) setAuthed(true); }).catch(() => {});
  }, []);

  const flush = useCallback(async () => {
    const changes = pending.current;
    pending.current = {};
    if (!Object.keys(changes).length) return;
    setSave('saving');
    try {
      const r = await fetch(`/api/admin/events/${(event as { id: string }).id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'Speichern fehlgeschlagen');
      setSave('saved');
      setTimeout(() => setSave((s) => (s === 'saved' ? 'idle' : s)), 1600);
    } catch { setSave('error'); }
  }, [event]);

  const queueSave = useCallback((patch: Record<string, unknown>) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 600);
  }, [flush]);

  const applyChange = useCallback((field: string, value: unknown) => {
    setEvent((prev) => ({ ...(prev as unknown as Record<string, unknown>), [field]: value }) as unknown as ViewProps['event']);
    queueSave({ [field]: value });
  }, [queueSave]);

  const applyFaqs = useCallback((next: Faq[]) => {
    setFaqs(next as unknown as ViewProps['faqs']);
    queueSave({ faqs: next });
  }, [queueSave]);

  useEffect(() => {
    if (!(authed && editMode)) return;
    function onMsg(e: MessageEvent) {
      const d = e.data as { type?: string; field?: string; value?: string; target?: string };
      if (!d || typeof d !== 'object') return;
      if (d.type === 'ft-inline-edit' && typeof d.field === 'string') applyChange(d.field, d.value ?? '');
      else if (d.type === 'ft-edit-field' && typeof d.target === 'string') setPanelTarget(d.target);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [authed, editMode, applyChange]);

  const ev = event as unknown as Record<string, unknown>;
  const group = panelTarget ? GROUPS[panelTarget] : null;
  const deepLinkHref = group?.deepLink === 'series' ? '/admin/series' : '/admin/events';

  // ── Struktur-Editoren ────────────────────────────────────────────
  const cats = (Array.isArray(ev.ticket_categories) ? ev.ticket_categories : []) as TicketCat[];
  const rows = (Array.isArray(ev.spielplan) ? ev.spielplan : []) as SpielplanRow[];
  const faqList = (faqs || []) as unknown as Faq[];

  return (
    <>
      <EventPageView {...props} event={event} faqs={faqs} editable={authed && editMode} />

      {authed && (
        <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-2">
          {editMode && (
            <span className="rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg" style={{
              background: save === 'error' ? '#fde2e1' : save === 'saving' ? '#fff4e0' : '#e7f6ec',
              color: save === 'error' ? '#a11' : save === 'saving' ? '#9a6700' : '#1b7a3d',
              border: '1px solid rgba(0,0,0,0.08)',
            }}>
              {save === 'saving' ? 'Speichert…' : save === 'error' ? 'Fehler – erneut' : save === 'saved' ? 'Gespeichert ✓' : 'Bereit'}
            </span>
          )}
          {editMode && (
            <button type="button" onClick={() => setPanelTarget('__seo__')}
              className="rounded-full px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:scale-[1.03]"
              style={{ background: '#143047' }}>
              SEO
            </button>
          )}
          <button type="button" onClick={() => { setEditMode((v) => !v); setPanelTarget(null); }}
            className="rounded-full px-5 py-3 text-sm font-bold text-white shadow-xl transition hover:scale-[1.03]"
            style={{ background: editMode ? '#1b7a3d' : '#d9531e' }}>
            {editMode ? '✓ Fertig' : '✎ Bearbeiten'}
          </button>
        </div>
      )}

      {authed && editMode && !panelTarget && (
        <div className="fixed bottom-5 left-5 z-[60] max-w-xs rounded-xl bg-[#102538] px-4 py-3 text-xs leading-relaxed text-white/90 shadow-xl">
          <b>Bearbeiten aktiv.</b> Texte anklicken & tippen. Modul anklicken öffnet die Detail-Felder rechts.
        </div>
      )}

      {authed && editMode && group && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/30" onClick={() => setPanelTarget(null)} />
          <aside className="fixed right-0 top-0 z-[71] flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: '#e5e8ed' }}>
              <h3 className="text-base font-bold" style={{ color: '#143047' }}>{group.title}</h3>
              <button type="button" onClick={() => setPanelTarget(null)} className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100" aria-label="Schließen">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Einfache Felder (auch als Kopf für Ticket-Kategorien) */}
              {(group.fields || []).map((f) => {
                const raw = ev[f.key];
                if (f.type === 'image') {
                  return <ImageField key={f.key} label={f.label} fieldKey={f.key} get={(k) => { const v = (ev as Record<string, unknown>)[k]; return typeof v === 'string' ? v : ''; }} onChange={applyChange} />;
                }
                if (f.type === 'list') {
                  const text = Array.isArray(raw) ? (raw as string[]).join('\n') : '';
                  return (
                    <label key={f.key} className="block">
                      <span className="mb-1 block text-xs font-semibold text-gray-600">{f.label}</span>
                      <textarea rows={5} defaultValue={text} onChange={(e) => applyChange(f.key, e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))} className={inputCls} style={inputStyle} />
                    </label>
                  );
                }
                const val = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
                return (
                  <label key={f.key} className="block">
                    <span className="mb-1 block text-xs font-semibold text-gray-600">{f.label}</span>
                    {f.type === 'textarea'
                      ? <textarea rows={4} defaultValue={val} onChange={(e) => applyChange(f.key, e.target.value)} className={inputCls} style={inputStyle} />
                      : <input type="text" defaultValue={val} onChange={(e) => applyChange(f.key, e.target.value)} className={inputCls} style={inputStyle} />}
                  </label>
                );
              })}

              {/* Ticket-Kategorien (Reiter) */}
              {group.editor === 'ticketCategories' && (
                <TicketCategoriesEditor cats={cats} onChange={(next) => applyChange('ticket_categories', next)} />
              )}

              {/* Spielplan-Tabelle */}
              {group.editor === 'spielplan' && (
                <SpielplanEditor rows={rows} onChange={(next) => applyChange('spielplan', next)} />
              )}

              {/* FAQs */}
              {group.editor === 'faqs' && (
                <FaqsEditor faqs={faqList} onChange={applyFaqs} />
              )}

              {group.note && <p className="text-xs italic text-gray-500">{group.note}</p>}
            </div>

            {group.deepLink && (
              <div className="border-t px-5 py-4" style={{ borderColor: '#e5e8ed' }}>
                <a href={deepLinkHref} className="block rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white" style={{ background: '#143047' }}>Voll-Editor öffnen</a>
              </div>
            )}
            <div className="border-t px-5 py-2 text-center text-[11px] text-gray-400" style={{ borderColor: '#eef1f4' }}>Änderungen werden automatisch gespeichert.</div>
          </aside>
        </>
      )}
    </>
  );
}

/* ── Ticket-Kategorien-Editor ──────────────────────────────────────── */
function TicketCategoriesEditor({ cats, onChange }: { cats: TicketCat[]; onChange: (c: TicketCat[]) => void }) {
  const set = (i: number, patch: Partial<TicketCat>) => onChange(cats.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Kategorien / Reiter</div>
      {cats.map((c, i) => (
        <div key={i} className="rounded-lg border p-3" style={inputStyle}>
          <div className="mb-2 flex items-center gap-2">
            <input value={c.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Name des Reiters" className="flex-1 rounded-md border px-2 py-1.5 text-sm font-semibold" style={inputStyle} />
            <button type="button" onClick={() => onChange(cats.filter((_, idx) => idx !== i))} className="rounded-md px-2 py-1 text-red-600 hover:bg-red-50" title="Reiter löschen">✕</button>
          </div>
          <textarea rows={4} value={(c.items || []).join('\n')} onChange={(e) => set(i, { items: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} placeholder="Leistungen – eine pro Zeile" className={inputCls} style={inputStyle} />
          <input value={c.note || ''} onChange={(e) => set(i, { note: e.target.value })} placeholder="Hinweis (optional)" className="mt-2 w-full rounded-md border px-2 py-1.5 text-sm" style={inputStyle} />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...cats, { name: 'Neue Kategorie', items: [], note: '' }])} className="w-full rounded-lg border-2 border-dashed py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50" style={inputStyle}>+ Kategorie hinzufügen</button>
    </div>
  );
}

/* ── Spielplan-Editor (Tabelle) ────────────────────────────────────── */
function SpielplanEditor({ rows, onChange }: { rows: SpielplanRow[]; onChange: (r: SpielplanRow[]) => void }) {
  const set = (i: number, patch: Partial<SpielplanRow>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Spielplan-Zeilen</div>
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg border p-3" style={inputStyle}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400">Zeile {i + 1}</span>
            <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} className="rounded-md px-2 py-0.5 text-red-600 hover:bg-red-50" title="Zeile löschen">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={r.date} onChange={(e) => set(i, { date: e.target.value })} placeholder="Datum" className="rounded-md border px-2 py-1.5 text-sm" style={inputStyle} />
            <input value={r.session} onChange={(e) => set(i, { session: e.target.value })} placeholder="Session" className="rounded-md border px-2 py-1.5 text-sm" style={inputStyle} />
            <input value={r.round} onChange={(e) => set(i, { round: e.target.value })} placeholder="Runde" className="rounded-md border px-2 py-1.5 text-sm" style={inputStyle} />
            <input value={r.matchup} onChange={(e) => set(i, { matchup: e.target.value })} placeholder="Begegnung" className="rounded-md border px-2 py-1.5 text-sm" style={inputStyle} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { date: '', session: '', matchup: '', round: '' }])} className="w-full rounded-lg border-2 border-dashed py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50" style={inputStyle}>+ Zeile hinzufügen</button>
    </div>
  );
}

/* ── FAQ-Editor ────────────────────────────────────────────────────── */
function FaqsEditor({ faqs, onChange }: { faqs: Faq[]; onChange: (f: Faq[]) => void }) {
  const set = (i: number, patch: Partial<Faq>) => onChange(faqs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Fragen & Antworten</div>
      {faqs.map((f, i) => (
        <div key={f.id || i} className="rounded-lg border p-3" style={inputStyle}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400">FAQ {i + 1}</span>
            <button type="button" onClick={() => onChange(faqs.filter((_, idx) => idx !== i))} className="rounded-md px-2 py-0.5 text-red-600 hover:bg-red-50" title="FAQ löschen">✕</button>
          </div>
          <input value={f.question} onChange={(e) => set(i, { question: e.target.value })} placeholder="Frage" className="mb-2 w-full rounded-md border px-2 py-1.5 text-sm font-semibold" style={inputStyle} />
          <textarea rows={3} value={f.answer} onChange={(e) => set(i, { answer: e.target.value })} placeholder="Antwort" className={inputCls} style={inputStyle} />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...faqs, { question: '', answer: '' }])} className="w-full rounded-lg border-2 border-dashed py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50" style={inputStyle}>+ FAQ hinzufügen</button>
    </div>
  );
}

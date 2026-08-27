'use client';

/**
 * /admin/praesentationen/[id] – Der Präsentations-Builder.
 * ─────────────────────────────────────────────────────────────────────────────
 * Links die Folienliste, in der Mitte die massstabsgetreue Live-Vorschau (dieselbe
 * Darstellung wie im PDF/PPTX-Export), darunter der Inspector der aktiven Folie.
 * Gespeichert wird automatisch, kurz nachdem die Eingabe ruht.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import AdminImageField from '@/components/admin/AdminImageField';
import {
  COLORS, SectionCard, InputField, TextAreaField, SelectInput, Button, Badge, Field, Spinner, Toggle, TextInput,
} from '@/components/admin/ui';
import { SlideStage, FALLBACK_COMPANY, type CompanyInfo } from '@/components/presentation/SlideCanvas';
import { emptySlide, slideId } from '@/lib/presentation/templates';
import { SLIDE_IMAGE_SLOTS, SLIDE_KIND_LABELS, type Deck, type DeckLang, type Slide, type SlideKind } from '@/lib/presentation/types';
import {
  ArrowLeft, ArrowUp, ArrowDown, Copy, Trash2, Plus, FileDown, Presentation, Share2, Sparkles,
  Check, ImagePlus, X, ChevronLeft, ChevronRight, Languages,
} from 'lucide-react';

const KIND_ORDER: SlideKind[] = ['title', 'story', 'program', 'hotels', 'services', 'pricing', 'gallery', 'about', 'closing'];

export default function PresentationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [company, setCompany] = useState<CompanyInfo>(FALLBACK_COMPANY);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<'laden' | 'bereit' | 'speichert' | 'gespeichert' | 'fehler'>('laden');
  const [message, setMessage] = useState('');
  const [presenting, setPresenting] = useState(false);
  const [aiBusy, setAiBusy] = useState('');
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Laden ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/admin/presentations/${id}`).then((x) => x.json()).catch(() => null);
      if (r?.success) { setDeck(r.data); if (r.company) setCompany(r.company); setState('bereit'); }
      else { setState('fehler'); setMessage(r?.error || 'Präsentation nicht gefunden.'); }
    })();
  }, [id]);

  /* ─── Speichern (verzögert nach der letzten Eingabe) ───────────────────── */
  const save = useCallback(async (next: Deck) => {
    setState('speichert');
    const r = await fetch(`/api/admin/presentations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: next.title, lang: next.lang, status: next.status,
        meta: next.meta, slides: next.slides, share_enabled: next.share_enabled,
      }),
    }).then((x) => x.json()).catch(() => null);
    if (r?.success) {
      dirty.current = false;
      setDeck((cur) => (cur ? { ...cur, share_token: r.data?.share_token || cur.share_token } : cur));
      setState('gespeichert');
    } else { setState('fehler'); setMessage(r?.error || 'Speichern fehlgeschlagen.'); }
  }, [id]);

  const update = useCallback((patch: Partial<Deck>) => {
    setDeck((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...patch };
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save(next), 1200);
      return next;
    });
  }, [save]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  /* ─── Folien-Operationen ──────────────────────────────────────────────── */
  const slides = deck?.slides || [];
  const current = slides[active];

  const patchSlide = (patch: Partial<Slide>) => {
    if (!deck) return;
    update({ slides: slides.map((s, i) => (i === active ? { ...s, ...patch } : s)) });
  };

  const addSlide = (kind: SlideKind) => {
    if (!deck) return;
    const s = emptySlide(kind, deck.lang);
    const next = [...slides.slice(0, active + 1), s, ...slides.slice(active + 1)];
    update({ slides: next });
    setActive(Math.min(active + 1, next.length - 1));
  };

  const moveSlide = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= slides.length) return;
    const next = [...slides];
    [next[from], next[to]] = [next[to], next[from]];
    update({ slides: next });
    setActive(to);
  };

  const duplicateSlide = (index: number) => {
    const copy: Slide = JSON.parse(JSON.stringify(slides[index]));
    copy.id = slideId();
    const next = [...slides.slice(0, index + 1), copy, ...slides.slice(index + 1)];
    update({ slides: next });
    setActive(index + 1);
  };

  const removeSlide = (index: number) => {
    if (slides.length <= 1) { setMessage('Die letzte Folie lässt sich nicht löschen.'); return; }
    if (!confirm('Diese Folie löschen?')) return;
    const next = slides.filter((_, i) => i !== index);
    update({ slides: next });
    setActive(Math.max(0, Math.min(index, next.length - 1)));
  };

  /* ─── KI-Hilfen ───────────────────────────────────────────────────────── */
  const aiText = async (action: 'improve' | 'shorten' | 'expand', field: 'body') => {
    if (!current?.body?.trim()) { setMessage('Kein Text vorhanden.'); return; }
    setAiBusy(action);
    const r = await fetch(`/api/admin/presentations/${id}/ai`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, text: current.body, hint: `Folientyp: ${SLIDE_KIND_LABELS[current.kind]}, Titel: ${current.title}` }),
    }).then((x) => x.json()).catch(() => null);
    setAiBusy('');
    if (r?.success) patchSlide({ [field]: r.data.text } as Partial<Slide>);
    else setMessage(r?.error || 'KI-Aufruf fehlgeschlagen.');
  };

  const aiImage = async (slot: number) => {
    const query = prompt('Wonach soll gesucht werden? (z.B. „Adare Manor Golf Ireland")', current?.title || '');
    if (!query) return;
    setAiBusy(`img${slot}`);
    const r = await fetch(`/api/admin/presentations/${id}/ai`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'image', query }),
    }).then((x) => x.json()).catch(() => null);
    setAiBusy('');
    if (r?.success) setImage(slot, r.data.url, r.data.credit);
    else setMessage(r?.error || 'Kein Bild gefunden.');
  };

  const translateDeck = async () => {
    const target = prompt('In welche Sprache übersetzen? de, en oder fr', deck?.lang === 'de' ? 'fr' : 'de');
    if (!target || !['de', 'en', 'fr'].includes(target)) return;
    if (!confirm(`Alle Folien nach ${target.toUpperCase()} übersetzen? Die bestehenden Texte werden ersetzt.`)) return;
    setAiBusy('translate');
    const r = await fetch(`/api/admin/presentations/${id}/ai`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'translateDeck', targetLang: target }),
    }).then((x) => x.json()).catch(() => null);
    setAiBusy('');
    if (r?.success) { setDeck(r.data); setState('gespeichert'); }
    else setMessage(r?.error || 'Übersetzung fehlgeschlagen.');
  };

  /* ─── Bilder ──────────────────────────────────────────────────────────── */
  const setImage = (slot: number, url: string, credit?: string) => {
    const imgs = [...(current?.images || [])];
    while (imgs.length <= slot) imgs.push({ url: '' });
    imgs[slot] = { ...imgs[slot], url, credit: credit ?? imgs[slot]?.credit };
    patchSlide({ images: imgs });
  };
  const setCaption = (slot: number, caption: string) => {
    const imgs = [...(current?.images || [])];
    while (imgs.length <= slot) imgs.push({ url: '' });
    imgs[slot] = { ...imgs[slot], caption };
    patchSlide({ images: imgs });
  };

  /* ─── Präsentationsmodus ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!presenting) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPresenting(false);
      if (e.key === 'ArrowRight' || e.key === ' ') setActive((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setActive((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [presenting, slides.length]);

  const shareUrl = useMemo(
    () => (deck?.share_token && typeof window !== 'undefined' ? `${window.location.origin}/p/${deck.share_token}` : ''),
    [deck?.share_token]
  );

  if (state === 'laden') return <AdminShell title="Präsentation"><div className="flex justify-center py-20"><Spinner /></div></AdminShell>;
  if (!deck) return <AdminShell title="Präsentation"><p className="p-6" style={{ color: COLORS.danger }}>{message}</p></AdminShell>;

  return (
    <AdminShell title={deck.title || 'Präsentation'} wide>
      {/* Kopfzeile */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/praesentationen')}><ArrowLeft className="h-4 w-4" /> Übersicht</Button>
        <input
          value={deck.title}
          onChange={(e) => update({ title: e.target.value })}
          className="min-w-[240px] flex-1 rounded-xl border px-3 py-2 text-lg font-bold"
          style={{ borderColor: COLORS.stroke, color: COLORS.navy }}
        />
        <SelectInput value={deck.lang} onChange={(e) => update({ lang: e.target.value as DeckLang })} style={{ width: 130 }}>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
          <option value="fr">Français</option>
        </SelectInput>
        <Button variant="secondary" size="sm" onClick={translateDeck} disabled={!!aiBusy}>
          {aiBusy === 'translate' ? <Spinner className="h-4 w-4" /> : <Languages className="h-4 w-4" />} Übersetzen
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setPresenting(true)}><Presentation className="h-4 w-4" /> Präsentieren</Button>
        <a href={`/api/admin/presentations/${id}/export?format=pdf`} target="_blank" rel="noreferrer">
          <Button variant="secondary" size="sm"><FileDown className="h-4 w-4" /> PDF</Button>
        </a>
        <a href={`/api/admin/presentations/${id}/export?format=pptx`}>
          <Button variant="accent" size="sm"><FileDown className="h-4 w-4" /> PowerPoint</Button>
        </a>
        <Badge tone={state === 'gespeichert' ? 'ok' : state === 'speichert' ? 'info' : state === 'fehler' ? 'danger' : 'muted'}>
          {state === 'gespeichert' ? 'gespeichert' : state === 'speichert' ? 'speichert …' : state === 'fehler' ? 'Fehler' : 'bereit'}
        </Badge>
      </div>
      {message && (
        <div className="mb-4 flex items-center justify-between rounded-xl px-4 py-2 text-sm" style={{ background: '#fff1ea', color: COLORS.accent }}>
          {message}
          <button onClick={() => setMessage('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        {/* Folienliste */}
        <div>
          <SectionCard title={`Folien (${slides.length})`}>
            <div className="flex flex-col gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setActive(i)}
                  className="rounded-lg px-3 py-2 text-left text-sm transition"
                  style={{
                    background: i === active ? COLORS.navy : COLORS.surfaceMuted,
                    color: i === active ? '#fff' : COLORS.navy,
                  }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: i === active ? '#ffd2bd' : COLORS.textMuted }}>
                    {i + 1} · {SLIDE_KIND_LABELS[s.kind]}
                  </div>
                  <div className="truncate font-semibold">{s.title || '(ohne Titel)'}</div>
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={() => moveSlide(active, -1)} title="Nach oben"><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => moveSlide(active, 1)} title="Nach unten"><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => duplicateSlide(active)} title="Duplizieren"><Copy className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => removeSlide(active)} title="Löschen"><Trash2 className="h-4 w-4" /></Button>
            </div>

            <Field label="Folie einfügen" className="mt-3">
              <SelectInput
                value=""
                onChange={(e) => { if (e.target.value) addSlide(e.target.value as SlideKind); e.target.value = ''; }}
              >
                <option value="">＋ Typ wählen …</option>
                {KIND_ORDER.map((k) => <option key={k} value={k}>{SLIDE_KIND_LABELS[k]}</option>)}
              </SelectInput>
            </Field>
          </SectionCard>

          <SectionCard title="Deck-Angaben" className="mt-4">
            <div className="flex flex-col gap-3">
              <InputField label="Untertitel" value={deck.meta.subtitle || ''} onChange={(e) => update({ meta: { ...deck.meta, subtitle: e.target.value } })} placeholder="Travel Package" />
              <InputField label="Zeitraum" value={deck.meta.period || ''} onChange={(e) => update({ meta: { ...deck.meta, period: e.target.value } })} placeholder="Mi. 15.09. – Mo. 20.09.2027" />
              <InputField label="Ort" value={deck.meta.location || ''} onChange={(e) => update({ meta: { ...deck.meta, location: e.target.value } })} placeholder="Irland, Adare Manor" />
              <Field label="Status">
                <SelectInput value={deck.status} onChange={(e) => update({ status: e.target.value as Deck['status'] })}>
                  <option value="draft">Entwurf</option>
                  <option value="final">Final</option>
                </SelectInput>
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Web-Link" description="Zum Teilen mit dem Kunden." className="mt-4">
            <Toggle checked={deck.share_enabled} onChange={(v) => update({ share_enabled: v })} label="Link freigeben" />
            {deck.share_enabled && shareUrl && (
              <div className="mt-3">
                <TextInput readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
                <div className="mt-2 flex gap-1">
                  <Button variant="secondary" size="sm" onClick={() => navigator.clipboard?.writeText(shareUrl)}><Share2 className="h-4 w-4" /> Kopieren</Button>
                  <a href={shareUrl} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm">Öffnen</Button></a>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Vorschau + Inspector */}
        <div>
          <SectionCard title="Vorschau" description="Genau so erscheint die Folie in PDF, PowerPoint und im Web-Link.">
            {current
              ? <SlideStage slide={current} deck={deck} company={company} style={{ borderRadius: 12 }} />
              : <p style={{ color: COLORS.textMuted }}>Keine Folie ausgewählt.</p>}
          </SectionCard>

          {current && (
            <SectionCard title={`Folie ${active + 1} bearbeiten`} description={SLIDE_KIND_LABELS[current.kind]} className="mt-4">
              <SlideInspector
                slide={current}
                aiBusy={aiBusy}
                onPatch={patchSlide}
                onSetImage={setImage}
                onSetCaption={setCaption}
                onAiText={aiText}
                onAiImage={aiImage}
              />
            </SectionCard>
          )}
        </div>
      </div>

      {presenting && current && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-4">
          <div className="w-full max-w-[1400px]">
            <SlideStage slide={current} deck={deck} company={company} />
          </div>
          <div className="mt-4 flex items-center gap-3 text-white">
            <Button variant="ghost" size="sm" style={{ color: '#fff' }} onClick={() => setActive(Math.max(0, active - 1))}><ChevronLeft className="h-5 w-5" /></Button>
            <span className="text-sm">{active + 1} / {slides.length}</span>
            <Button variant="ghost" size="sm" style={{ color: '#fff' }} onClick={() => setActive(Math.min(slides.length - 1, active + 1))}><ChevronRight className="h-5 w-5" /></Button>
            <Button variant="ghost" size="sm" style={{ color: '#fff' }} onClick={() => setPresenting(false)}><X className="h-5 w-5" /> Schliessen (ESC)</Button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

/* ─── Inspector ─────────────────────────────────────────────────────────── */

function SlideInspector({ slide, aiBusy, onPatch, onSetImage, onSetCaption, onAiText, onAiImage }: {
  slide: Slide;
  aiBusy: string;
  onPatch: (p: Partial<Slide>) => void;
  onSetImage: (slot: number, url: string, credit?: string) => void;
  onSetCaption: (slot: number, caption: string) => void;
  onAiText: (action: 'improve' | 'shorten' | 'expand', field: 'body') => void;
  onAiImage: (slot: number) => void;
}) {
  const slots = SLIDE_IMAGE_SLOTS[slide.kind];
  const metaLines = slide.meta || [];

  const setMeta = (i: number, v: string) => {
    const next = [...metaLines];
    next[i] = v;
    onPatch({ meta: next.filter((x, idx) => x.trim() || idx < next.length - 1) });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <InputField label="Titel" value={slide.title} onChange={(e) => onPatch({ title: e.target.value })} />
        <InputField label="Kleine Zeile darüber" value={slide.kicker || ''} onChange={(e) => onPatch({ kicker: e.target.value })} placeholder="z.B. Travel Package" />
      </div>

      <Field label="Zusatzzeilen (Datum, Ort, Claim)" hint="Eine Zeile je Feld – leere Felder werden ignoriert.">
        <div className="flex flex-col gap-2">
          {[...metaLines, ''].map((m, i) => (
            <TextInput key={i} value={m} onChange={(e) => setMeta(i, e.target.value)} placeholder={i === 0 ? 'Fr. 17.09.2027 – So. 19.09.2027' : 'weitere Zeile …'} />
          ))}
        </div>
      </Field>

      {slide.kind !== 'gallery' && (
        <div>
          <TextAreaField
            label="Fliesstext"
            hint="Leerzeile trennt Absätze. **Text** hebt Wörter fett hervor."
            rows={6}
            value={slide.body || ''}
            onChange={(e) => onPatch({ body: e.target.value })}
          />
          <div className="mt-2 flex flex-wrap gap-1">
            <Button variant="secondary" size="sm" onClick={() => onAiText('improve', 'body')} disabled={!!aiBusy}>
              {aiBusy === 'improve' ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} Überarbeiten
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onAiText('shorten', 'body')} disabled={!!aiBusy}>Kürzen</Button>
            <Button variant="ghost" size="sm" onClick={() => onAiText('expand', 'body')} disabled={!!aiBusy}>Ausformulieren</Button>
          </div>
        </div>
      )}

      {slide.kind === 'program' && (
        <Field label="Tagesabschnitte">
          <div className="flex flex-col gap-2">
            {(slide.program || []).map((p, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[160px_1fr]">
                <TextInput value={p.label} onChange={(e) => {
                  const next = [...(slide.program || [])];
                  next[i] = { ...next[i], label: e.target.value };
                  onPatch({ program: next });
                }} />
                <TextInput value={p.text} onChange={(e) => {
                  const next = [...(slide.program || [])];
                  next[i] = { ...next[i], text: e.target.value };
                  onPatch({ program: next });
                }} placeholder="Was passiert in diesem Abschnitt?" />
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => onPatch({ program: [...(slide.program || []), { label: '', text: '' }] })}>
              <Plus className="h-4 w-4" /> Abschnitt
            </Button>
          </div>
        </Field>
      )}

      {slide.kind === 'hotels' && (
        <Field label="Hotels">
          <div className="flex flex-col gap-4">
            {(slide.hotels || []).map((h, i) => (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: COLORS.stroke }}>
                <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
                  <TextInput value={h.name} onChange={(e) => {
                    const next = [...(slide.hotels || [])]; next[i] = { ...next[i], name: e.target.value }; onPatch({ hotels: next });
                  }} placeholder="Hotelname" />
                  <TextInput value={h.stars || ''} onChange={(e) => {
                    const next = [...(slide.hotels || [])]; next[i] = { ...next[i], stars: e.target.value }; onPatch({ hotels: next });
                  }} placeholder="4-Sterne" />
                </div>
                <textarea
                  className="mt-2 w-full rounded-xl border px-3 py-2 text-sm text-gray-900"
                  style={{ borderColor: COLORS.stroke }} rows={3}
                  value={h.text} placeholder="Beschreibung des Hotels"
                  onChange={(e) => { const next = [...(slide.hotels || [])]; next[i] = { ...next[i], text: e.target.value }; onPatch({ hotels: next }); }}
                />
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <TextInput value={h.address || ''} onChange={(e) => {
                    const next = [...(slide.hotels || [])]; next[i] = { ...next[i], address: e.target.value }; onPatch({ hotels: next });
                  }} placeholder="Adresse" />
                  <TextInput value={h.phone || ''} onChange={(e) => {
                    const next = [...(slide.hotels || [])]; next[i] = { ...next[i], phone: e.target.value }; onPatch({ hotels: next });
                  }} placeholder="+353 …" />
                  <TextInput value={h.web || ''} onChange={(e) => {
                    const next = [...(slide.hotels || [])]; next[i] = { ...next[i], web: e.target.value }; onPatch({ hotels: next });
                  }} placeholder="https://…" />
                </div>
                <div className="mt-2 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => onPatch({ hotels: (slide.hotels || []).filter((_, x) => x !== i) })}>
                    <Trash2 className="h-4 w-4" /> Entfernen
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => onPatch({ hotels: [...(slide.hotels || []), { name: '', text: '' }] })}>
              <Plus className="h-4 w-4" /> Hotel
            </Button>
          </div>
        </Field>
      )}

      {slide.kind === 'services' && (
        <Field label="Leistungen" hint="Haken = inkludiert, Kreuz = nicht inkludiert.">
          <div className="flex flex-col gap-2">
            {(slide.services || []).map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => { const next = [...(slide.services || [])]; next[i] = { ...next[i], included: !next[i].included }; onPatch({ services: next }); }}
                  className="rounded-lg px-2 py-1.5 text-sm font-bold"
                  style={{ background: s.included ? '#f0fdf4' : '#f3f4f6', color: s.included ? COLORS.ok : COLORS.textMuted, minWidth: 38 }}
                >
                  {s.included ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </button>
                <TextInput value={s.text} onChange={(e) => {
                  const next = [...(slide.services || [])]; next[i] = { ...next[i], text: e.target.value }; onPatch({ services: next });
                }} placeholder="z.B. 3 Übernachtungen inkl. Frühstück" />
                <Button variant="ghost" size="sm" onClick={() => onPatch({ services: (slide.services || []).filter((_, x) => x !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => onPatch({ services: [...(slide.services || []), { text: '', included: true }] })}>
                <Plus className="h-4 w-4" /> Inkludiert
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onPatch({ services: [...(slide.services || []), { text: '', included: false }] })}>
                <Plus className="h-4 w-4" /> Nicht inkludiert
              </Button>
            </div>
          </div>
        </Field>
      )}

      {slide.kind === 'pricing' && (
        <Field label="Preiszeilen">
          <div className="flex flex-col gap-2">
            {(slide.prices || []).map((p, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[2fr_2fr_1fr_auto] md:items-center">
                <TextInput value={p.label} onChange={(e) => {
                  const next = [...(slide.prices || [])]; next[i] = { ...next[i], label: e.target.value }; onPatch({ prices: next });
                }} placeholder="Leistung" />
                <TextInput value={p.note || ''} onChange={(e) => {
                  const next = [...(slide.prices || [])]; next[i] = { ...next[i], note: e.target.value }; onPatch({ prices: next });
                }} placeholder="Hinweis (optional)" />
                <TextInput value={p.price} onChange={(e) => {
                  const next = [...(slide.prices || [])]; next[i] = { ...next[i], price: e.target.value }; onPatch({ prices: next });
                }} placeholder="CHF 1'890" />
                <Button variant="ghost" size="sm" onClick={() => onPatch({ prices: (slide.prices || []).filter((_, x) => x !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => onPatch({ prices: [...(slide.prices || []), { label: '', note: '', price: '' }] })}>
              <Plus className="h-4 w-4" /> Zeile
            </Button>
          </div>
        </Field>
      )}

      {(slide.kind === 'story' || slide.kind === 'closing' || slide.kind === 'gallery') && (
        <Field label="Aufzählung (optional)">
          <div className="flex flex-col gap-2">
            {[...(slide.bullets || []), ''].map((b, i) => (
              <TextInput key={i} value={b} placeholder="Punkt hinzufügen …" onChange={(e) => {
                const next = [...(slide.bullets || [])];
                next[i] = e.target.value;
                onPatch({ bullets: next.filter((x, idx) => x.trim() || idx < next.length - 1) });
              }} />
            ))}
          </div>
        </Field>
      )}

      <InputField label="Hervorgehobene Zeile (optional)" value={slide.highlight || ''} onChange={(e) => onPatch({ highlight: e.target.value })} placeholder="z.B. ★ Abendessen im Adare Manor" />

      <Field label={`Bilder (${slots} Platz${slots === 1 ? '' : 'plätze'})`} hint="Aus der Mediathek, per Upload oder KI-Suche.">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: slots }, (_, i) => (
            <div key={i}>
              <AdminImageField
                label={`Bild ${i + 1}`}
                value={slide.images?.[i]?.url || ''}
                onChange={(v) => onSetImage(i, v)}
              />
              <div className="mt-2 flex gap-2">
                <TextInput
                  value={slide.images?.[i]?.caption || ''}
                  onChange={(e) => onSetCaption(i, e.target.value)}
                  placeholder="Bildunterschrift (optional)"
                />
                <Button variant="ghost" size="sm" onClick={() => onAiImage(i)} disabled={!!aiBusy} title="Bild suchen">
                  {aiBusy === `img${i}` ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Field>

      <TextAreaField
        label="Sprechernotizen (nur PowerPoint)"
        rows={2}
        value={slide.notes || ''}
        onChange={(e) => onPatch({ notes: e.target.value })}
      />
    </div>
  );
}

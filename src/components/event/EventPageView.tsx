'use client';

import React, { createElement, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, CalendarDays, ShieldCheck, Ticket, Award, ChevronDown } from 'lucide-react';
import PackageCard from '@/components/PackageCard';
import EventContactForm from '@/components/EventContactForm';
import LageplanMap from '@/components/LageplanMap';
import type { EventRecord, SeriesRecord, PackageRecord, EventFaqRecord } from '@/lib/eventData';

/** FT-Signatur: dunkles Navy mit weichem blauem Radial-Glow (wie faltintravel.com). */
const BLUE_GLOW: React.CSSProperties = {
  background:
    'radial-gradient(60% 95% at 12% 12%, rgba(58,124,190,0.45), transparent 60%),' +
    'radial-gradient(55% 85% at 90% 22%, rgba(34,84,143,0.40), transparent 55%),' +
    'radial-gradient(70% 90% at 50% 110%, rgba(28,72,126,0.35), transparent 60%),' +
    'linear-gradient(180deg, #163e63 0%, #0e2842 55%, #0c2138 100%)',
};

/**
 * Editable: macht ein Element in der Admin-Vorschau anklickbar (Click-to-Edit).
 * Sendet beim Klick die Ziel-Feld-Kennung per postMessage an den Editor (parent).
 * Im öffentlichen Einsatz (editable=false) wird das Element unverändert gerendert.
 */
function Editable({
  editable,
  target,
  as = 'div',
  className,
  style,
  children,
}: {
  editable: boolean;
  target: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (!editable) {
    return createElement(as, { className, style }, children);
  }
  return createElement(
    as,
    {
      className: [className, 'ft-editable'].filter(Boolean).join(' '),
      style,
      title: 'Zum Bearbeiten klicken',
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.parent?.postMessage({ type: 'ft-edit-field', target }, '*');
      },
    },
    children
  );
}

/**
 * InlineEditable: echtes WYSIWYG-Inline-Tippen in der Admin-Vorschau.
 * Im editable-Modus wird das Element contentEditable; Änderungen werden per
 * postMessage (ft-inline-edit) direkt an das passende Editor-Feld geschrieben.
 * Im öffentlichen Einsatz wird `display` (bzw. der Rohwert) normal gerendert.
 */
function InlineEditable({
  editable,
  field,
  value,
  display,
  placeholder,
  as = 'div',
  className,
  style,
  singleLine = false,
}: {
  editable: boolean;
  field: string;
  value: string;
  display?: React.ReactNode;
  placeholder?: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  singleLine?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const initial = useRef(value);

  // Externe Änderungen (z.B. Tippen im Editor-Feld) übernehmen – aber nie,
  // während der Nutzer gerade in diesem Element tippt (sonst Cursor-Sprung).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerText !== value) el.innerText = value || '';
  }, [value]);

  if (!editable) {
    return createElement(as, { className, style }, display ?? value);
  }

  const props: Record<string, unknown> = {
    ref,
    className: [className, 'ft-inline'].filter(Boolean).join(' '),
    style: { ...style, whiteSpace: singleLine ? undefined : 'pre-wrap' },
    contentEditable: true,
    suppressContentEditableWarning: true,
    'data-placeholder': placeholder || '',
    onKeyDown: singleLine
      ? (e: React.KeyboardEvent) => { if (e.key === 'Enter') e.preventDefault(); }
      : undefined,
    onInput: (e: React.FormEvent<HTMLElement>) => {
      window.parent?.postMessage(
        { type: 'ft-inline-edit', field, value: (e.currentTarget as HTMLElement).innerText },
        '*'
      );
    },
  };
  return createElement(as, props, initial.current);
}

interface TicketCategory { name: string; items: string[]; note?: string | null }

/** Tabs-Modul "Unsere Tickets" – Ticket-/Hospitality-Kategorien in Reitern. */
function TicketCategories({
  title, intro, categories, editable,
}: { title: string; intro: string; categories: TicketCategory[]; editable: boolean }) {
  const [active, setActive] = useState(0);
  const idx = active < categories.length ? active : 0;
  const cat = categories[idx];
  return (
    <div className="container mx-auto max-w-5xl">
      <Editable editable={editable} target="ticket_categories" as="h2" className="mb-3 text-center text-3xl md:text-4xl font-extrabold leading-tight" style={{ color: '#143047' }}>
        {title}
      </Editable>
      {intro && <p className="mx-auto mb-8 max-w-3xl text-center leading-relaxed text-gray-600">{intro}</p>}

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {categories.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className="rounded-full px-4 py-2.5 text-sm font-bold transition-all"
            style={{
              background: i === idx ? '#143047' : '#eef2f7',
              color: i === idx ? '#fff' : '#143047',
              boxShadow: i === idx ? '0 6px 16px rgba(20,48,71,0.28)' : 'none',
            }}
          >
            {c.name || `Kategorie ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="rounded-2xl bg-white p-6 md:p-8" style={{ border: '1px solid #e5e8ed', boxShadow: '0 12px 34px rgba(20,48,71,0.10)' }}>
        <h3 className="mb-5 text-xl font-extrabold" style={{ color: '#143047' }}>{cat?.name}</h3>
        <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {(cat?.items || []).map((it, i) => (
            <li key={i} className="flex items-start gap-2.5 text-gray-700">
              <svg className="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#d9531e" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <span>{it}</span>
            </li>
          ))}
        </ul>
        {cat?.note && (
          <p className="mt-6 pt-5 text-sm leading-relaxed text-gray-600" style={{ borderTop: '1px solid #eef2f7' }}>{cat.note}</p>
        )}
      </div>
    </div>
  );
}

/**
 * EventPageView
 * ─────────────────────────────────────────────────────────────────────────────
 * Präsentations-Komponente für eine komplette Event-Seite.
 * EINZIGE Quelle der Wahrheit – wird sowohl von der öffentlichen Route
 * (/events/[slug]) als auch von der Admin-Live-Vorschau (/admin/events/preview)
 * gerendert. So kann die Vorschau niemals von der echten Seite abweichen.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface PinIcon {
  id: string;
  name: string;
  image?: string | null;
}

export interface EventPageViewProps {
  event: EventRecord;
  series?: Pick<SeriesRecord, 'slug' | 'title'> | null;
  packages?: PackageRecord[];
  faqs?: EventFaqRecord[];
  pinIcons?: PinIcon[];
  /** Admin-Vorschau: macht Elemente anklickbar (Click-to-Edit). */
  editable?: boolean;
}

/* ─── Date helpers ──────────────────────────────────────────────────────────── */

function parseFlexibleDate(value?: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const date = new Date(Number(dotMatch[3]), Number(dotMatch[2]) - 1, Number(dotMatch[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatEventDate(value?: string | null) {
  if (!value) return '';
  const date = parseFlexibleDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function getEventDateRange(start?: string | null, end?: string | null) {
  const from = formatEventDate(start);
  const to = formatEventDate(end);
  if (from && to) return `${from} – ${to}`;
  if (from) return from;
  return to;
}

function getEventLocationLine(event: {
  venue?: string | null;
  location_name?: string | null;
  location_city?: string | null;
  location_region?: string | null;
  location_country?: string | null;
}) {
  return [event.location_city, event.location_name, event.venue, event.location_region, event.location_country]
    .filter(Boolean)
    .join(', ');
}

function buildHeroIntro(event: EventRecord) {
  if (event.description) return event.description;
  const baseName = event.name || event.title || 'dieses Event';
  return `Tickets sind heiß begehrt und dementsprechend schwer erhältlich. Als mehrfach ausgezeichneter Sportreisen-Spezialist bieten wir unseren Kunden die Möglichkeit, ${baseName} live zu erleben.`;
}

function buildFirstParagraphHeading(event: EventRecord) {
  if (event.first_paragraph_heading) return event.first_paragraph_heading;
  return `Erleben Sie ${event.name || event.title || 'unser Event'} live!`;
}

function buildFirstParagraphText(event: EventRecord) {
  if (event.first_paragraph_text) return event.first_paragraph_text;
  const eventName = event.name || event.title || 'das Event';
  return `Mit Faltin Travel erleben Sie ${eventName} mit sorgfältig zusammengestellten Tickets und passenden Reisebausteinen. Wir begleiten Sie von der Anfrage bis zur Rückreise.`;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export default function EventPageView({
  event,
  series = null,
  packages = [],
  faqs = [],
  pinIcons = [],
  editable = false,
}: EventPageViewProps) {
  const showAbout       = event.show_about       ?? true;
  const showPackages    = event.show_packages     ?? true;
  const showFaqs        = event.show_faqs         ?? true;
  const showSpielplan   = event.show_spielplan    ?? false;
  const spielplan       = event.spielplan         || [];
  const showWissenswertes       = event.show_wissenswertes       ?? false;
  const wissenswertesTitle      = event.wissenswertes_title      || `Wissenswertes zu ${event.name || event.title}`;
  const wissenswertesText       = event.wissenswertes_text       || '';
  const wissenswertesAccordionTitle = event.wissenswertes_accordion_title || 'Weitere Infos';
  const wissenswertesAccordionText  = event.wissenswertes_accordion_text  || '';
  const showStadionplan    = event.show_stadionplan    ?? false;
  const stadionplanTitle   = event.stadionplan_title   || 'Stadionplan';
  const stadionplanVenueName = event.stadionplan_venue_name || event.venue || '';
  const stadionplanImage   = event.stadionplan_image   || '';
  const stadionplanDescription = event.stadionplan_description || '';
  const showLageplan = event.show_lageplan ?? false;
  const eventPins = (event.lageplan_pins || []) as Array<{
    id: string; name: string; lat: number; lng: number; icon_id: string; label?: string | null;
  }>;
  const geocodeQuery = [event.venue, event.location_name, event.location_city, event.location_region, event.location_country]
    .filter(Boolean)
    .join(', ');
  const venueLabel = event.venue || event.location_name || event.location_city || event.name || '';
  const hasLageplan = showLageplan && (eventPins.length > 0 || geocodeQuery.length > 0);

  const showLeistungen = event.show_leistungen ?? false;
  const leistungenTitle = event.leistungen_title || 'Unsere Leistungen';
  const leistungenItems = (event.leistungen_items || []).filter(Boolean);
  const leistungenImage = event.leistungen_image || '';
  const hasLeistungen = showLeistungen && (leistungenItems.length > 0 || !!leistungenImage);

  const showTicketCats = event.show_ticket_categories ?? false;
  const ticketCatsTitle = event.ticket_categories_title || 'Unsere Tickets';
  const ticketCatsIntro = event.ticket_categories_intro || '';
  const ticketCats = (event.ticket_categories || []).filter((c) => c && (c.name || (c.items || []).length));
  const hasTicketCats = showTicketCats && ticketCats.length > 0;

  const eventDateRange = getEventDateRange(event.start_date, event.end_date);
  const heroLocation = getEventLocationLine(event);
  // CTA-Buttons springen on-page zum Anfrage-/Packages-Bereich (#tickets)
  const ctaHref = '#tickets';
  const heroIntro   = buildHeroIntro(event);
  const heroCtaLabel = `Jetzt ${event.name || event.title || 'Event'} Tickets unverbindlich anfragen`;
  const firstParagraphHeading = buildFirstParagraphHeading(event);
  const firstParagraphText    = buildFirstParagraphText(event);
  type AboutImg = { url: string; alt?: string | null; title?: string | null };
  const firstParagraphImages = ([
    { url: event.first_paragraph_image_1, alt: event.first_paragraph_image_1_alt, title: event.first_paragraph_image_1_title },
    { url: event.first_paragraph_image_2, alt: event.first_paragraph_image_2_alt, title: event.first_paragraph_image_2_title },
    { url: event.first_paragraph_image_3, alt: event.first_paragraph_image_3_alt, title: event.first_paragraph_image_3_title },
  ].filter((x) => x.url) as AboutImg[]);
  // Fallback: wenn keine Absatz-Bilder gepflegt sind, ein vorhandenes Event-Bild nutzen (keine leere Spalte)
  const aboutImages = (firstParagraphImages.length > 0
    ? firstParagraphImages
    : ([{ url: event.ticket_image }, { url: event.hero_image }].filter((x) => x.url) as AboutImg[])
  ).slice(0, 2);

  // Modul-Reihenfolge (per Admin/Drag steuerbar). Hero/Nav/CTA bleiben fest.
  const DEFAULT_MODULE_ORDER = ['leistungen', 'about', 'spielplan', 'wissenswertes', 'stadionplan', 'lageplan', 'ticket_categories', 'packages', 'faq'];
  const moduleOrder = (Array.isArray(event.module_order) && event.module_order.length ? event.module_order : DEFAULT_MODULE_ORDER);
  const orderOf = (key: string) => {
    const i = moduleOrder.indexOf(key);
    return (i === -1 ? DEFAULT_MODULE_ORDER.indexOf(key) : i) + 1;
  };

  const anchors = ([
    hasLeistungen   && { key: 'leistungen', label: 'Unsere Leistungen', href: '#unsere-leistungen' },
    showAbout       && { key: 'about', label: 'Überblick', href: '#leistungen' },
    showSpielplan   && spielplan.length > 0 && { key: 'spielplan', label: 'Spielplan', href: '#spielplan' },
    showWissenswertes && { key: 'wissenswertes', label: 'Wissenswertes', href: '#wissenswertes' },
    showStadionplan && { key: 'stadionplan', label: 'Stadionplan', href: '#stadionplan' },
    hasLageplan     && { key: 'lageplan', label: 'Lageplan', href: '#lageplan' },
    hasTicketCats   && { key: 'ticket_categories', label: 'Ticket-Kategorien', href: '#ticket-kategorien' },
    showPackages    && { key: 'packages', label: 'Packages', href: '#tickets' },
    showFaqs        && { key: 'faq', label: 'FAQ', href: '#faq' },
  ].filter(Boolean) as { key: string; label: string; href: string }[]).sort((a, b) => orderOf(a.key) - orderOf(b.key));

  // Scroll-Spy: aktiven Abschnitt in der Sticky-Nav hervorheben
  const anchorKey = anchors.map((a) => a.href).join('|');
  const [activeHash, setActiveHash] = useState('');
  useEffect(() => {
    const ids = anchorKey ? anchorKey.split('|').map((h) => h.slice(1)) : [];
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!sections.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (vis[0]) setActiveHash('#' + vis[0].target.id);
      },
      { rootMargin: '-150px 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey]);

  // Countdown (client-only, vermeidet Hydration-Mismatch)
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  useEffect(() => {
    const raw = (event.start_date || '').trim();
    if (!raw) { setDaysLeft(null); return; }
    let d: Date | null = null;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      d = new Date(`${raw.slice(0, 10)}T00:00:00`);
    } else {
      const m = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/); // TT.MM.JJJJ
      if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      else { const g = new Date(raw); if (!isNaN(g.getTime())) d = g; }
    }
    if (!d || isNaN(d.getTime())) { setDaysLeft(null); return; }
    setDaysLeft(Math.ceil((d.getTime() - Date.now()) / 86400000));
  }, [event.start_date]);

  return (
    <div className="flex min-h-screen flex-col font-sans" style={{ fontFamily: "'Montserrat', 'Open Sans', system-ui, sans-serif" }}>
      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: 420 }}>
        {event.hero_image ? (
          <div className="absolute inset-0">
            <Image src={event.hero_image} alt={event.hero_image_alt || event.title || event.name || 'Event'} title={event.hero_image_title || undefined} fill className="object-cover object-center" priority />
            <div className="absolute inset-0" style={{ background: 'rgba(14,34,56,0.45)' }} />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#184a7b 0%,#143047 100%)' }} />
        )}

        {editable && (
          <button
            type="button"
            onClick={() => window.parent?.postMessage({ type: 'ft-edit-field', target: 'hero_image' }, '*')}
            className="absolute right-4 top-4 z-20 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold shadow"
            style={{ color: '#143047' }}
          >
            ✎ Hero-Bild ändern
          </button>
        )}

        <div className="relative z-10 flex flex-col items-center justify-center px-4 py-16">
          {series && (
            editable ? (
              <Editable
                editable
                target="series"
                as="span"
                className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
              >
                {series.title}
              </Editable>
            ) : (
              <Link
                href={`/${series.slug}`}
                className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
              >
                {series.title}
              </Link>
            )
          )}

          <div
            className="w-full max-w-4xl text-center rounded-sm px-8 py-10"
            style={{ background: 'rgba(14,34,56,0.82)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <InlineEditable
              editable={editable}
              field="title"
              singleLine
              value={event.title || ''}
              display={event.title || event.name}
              placeholder={event.name || 'Event-Titel'}
              as="h1"
              className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-3"
            />
            <Editable editable={editable} target="location" as="div" className="mb-6 flex flex-wrap items-center justify-center gap-2.5">
              {heroLocation && (
                <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <MapPin className="h-4 w-4 shrink-0" style={{ color: '#f5c842' }} /> {heroLocation}
                </span>
              )}
              {eventDateRange && (
                <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <CalendarDays className="h-4 w-4 shrink-0" style={{ color: '#f5c842' }} /> {eventDateRange}
                </span>
              )}
              {daysLeft !== null && daysLeft > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold text-white" style={{ background: 'rgba(217,83,30,0.30)', border: '1px solid rgba(245,200,66,0.5)' }}>
                  ⏳ Noch {daysLeft} {daysLeft === 1 ? 'Tag' : 'Tage'}
                </span>
              )}
            </Editable>
            <InlineEditable
              editable={editable}
              field="description"
              value={event.description || ''}
              display={heroIntro}
              placeholder="Intro-/Beschreibungstext…"
              as="p"
              className="text-base md:text-lg text-white/90 leading-relaxed max-w-3xl mx-auto"
            />
          </div>

          <div className="mt-6">
            <a
              href={ctaHref}
              className="inline-flex items-center rounded-sm px-8 py-4 text-base md:text-lg font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] shadow-lg"
              style={{ background: '#d9531e' }}
            >
              {heroCtaLabel}
            </a>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {[
              { Icon: ShieldCheck, label: 'Schweizer Reisegarantie' },
              { Icon: Ticket, label: 'Offizielle Hospitality-Tickets' },
              { Icon: Award, label: '20+ Jahre Erfahrung' },
            ].map(({ Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs md:text-sm font-semibold text-white"
                style={{ background: 'rgba(11,24,40,0.6)', border: '1px solid rgba(255,255,255,0.18)' }}
              >
                <Icon className="h-4 w-4 shrink-0" style={{ color: '#f5c842' }} /> {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STICKY ANCHOR NAV ────────────────────────────────────────────────── */}
      {anchors.length > 0 && (
        <nav className="sticky z-40" style={{ top: 84 }}>
          <div
            style={{
              background: 'linear-gradient(180deg, #18395a 0%, #102538 100%)',
              // 1px-Linie in der Nav-Eigenfarbe deckt den Sub-Pixel-Spalt ab (sonst blitzt der helle Body-BG beim Scroll durch)
              boxShadow: '0 1px 0 0 #102538, 0 12px 28px rgba(8,20,33,0.35)',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
            }}
          >
            {/* Desktop: volle Leiste */}
            <div className="mx-auto hidden w-full max-w-6xl md:flex">
              {anchors.map((anchor) => {
                const isActive = activeHash === anchor.href;
                return (
                  <a
                    key={anchor.href}
                    href={anchor.href}
                    className={`group relative flex-1 whitespace-nowrap px-4 py-4 text-center text-sm font-semibold tracking-wide transition-colors ${
                      isActive ? 'text-white' : 'text-white/65 hover:text-white'
                    }`}
                  >
                    <span className="relative z-10">{anchor.label}</span>
                    {/* Hover-Glow */}
                    <span
                      className="pointer-events-none absolute inset-1 rounded-lg bg-white/0 transition-all group-hover:bg-white/5"
                      aria-hidden
                    />
                    {/* Aktiv-Unterstrich */}
                    <span
                      className="pointer-events-none absolute inset-x-3 bottom-1.5 h-[3px] rounded-full transition-all duration-300"
                      style={{
                        background: '#d9531e',
                        opacity: isActive ? 1 : 0,
                        transform: isActive ? 'scaleX(1)' : 'scaleX(0.4)',
                      }}
                      aria-hidden
                    />
                  </a>
                );
              })}
            </div>

            {/* Mobil: kompaktes Dropdown statt horizontalem Scrollen */}
            <div className="px-4 py-2.5 md:hidden">
              <div className="relative">
                <label htmlFor="ft-section-nav" className="sr-only">Zum Abschnitt springen</label>
                <select
                  id="ft-section-nav"
                  value={activeHash || anchors[0].href}
                  onChange={(e) => {
                    const target = document.getElementById(e.target.value.slice(1));
                    if (target) target.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full appearance-none rounded-lg border border-white/20 px-4 py-2.5 pr-10 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#d9531e]"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  {anchors.map((anchor) => (
                    <option key={anchor.href} value={anchor.href} style={{ background: '#102538', color: '#ffffff' }}>
                      {anchor.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" aria-hidden />
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* ── UNSERE LEISTUNGEN ────────────────────────────────────────────────── */}
      {hasLeistungen && (
        <section className="py-14 px-4 scroll-mt-40" id="unsere-leistungen" style={{ ...BLUE_GLOW, order: orderOf('leistungen') }}>
          <div className="container mx-auto max-w-6xl">
            <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
              <div>
                <InlineEditable
                  editable={editable}
                  field="leistungen_title"
                  singleLine
                  value={event.leistungen_title || ''}
                  display={leistungenTitle}
                  placeholder="Unsere Leistungen"
                  as="h2"
                  className="mb-6 text-3xl md:text-4xl font-extrabold leading-tight text-white"
                />
                {editable ? (
                  <Editable editable target="leistungen_items" as="ul" className="space-y-2.5">
                    {leistungenItems.map((it, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-white/90">
                        <span className="mt-1 leading-none" style={{ color: '#d9531e' }}>●</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </Editable>
                ) : (
                  <ul className="space-y-2.5">
                    {leistungenItems.map((it, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-white/90">
                        <span className="mt-1 leading-none" style={{ color: '#d9531e' }}>●</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-8">
                  <a
                    href={ctaHref}
                    className="inline-flex items-center rounded-sm px-7 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:opacity-90 hover:scale-[1.02]"
                    style={{ background: '#d9531e' }}
                  >
                    Jetzt unverbindlich anfragen.
                  </a>
                </div>
              </div>
              {leistungenImage && (
                <Editable editable={editable} target="leistungen_items" as="div" className="relative h-72 overflow-hidden rounded-xl bg-white/5 md:h-96">
                  <Image src={leistungenImage} alt={event.leistungen_image_alt || leistungenTitle} title={event.leistungen_image_title || undefined} fill className="object-cover" />
                </Editable>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── LEISTUNGEN / ABOUT (Erster Absatz) ───────────────────────────────── */}
      {showAbout && (
        <section className="py-14 px-4 bg-white scroll-mt-40" id="leistungen" style={{ order: orderOf('about') }}>
          <div className="container mx-auto max-w-6xl">
            <div className={`grid grid-cols-1 gap-10 md:items-center ${aboutImages.length > 0 ? 'md:grid-cols-[1.05fr_1fr]' : ''}`}>
              <div className={aboutImages.length > 0 ? '' : 'mx-auto max-w-3xl text-center'}>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest" style={{ background: '#eef3fb', color: '#18395a' }}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#d9531e' }} /> Überblick
                </div>
                <InlineEditable
                  editable={editable}
                  field="first_paragraph_heading"
                  singleLine
                  value={event.first_paragraph_heading || ''}
                  display={firstParagraphHeading}
                  placeholder="Überschrift…"
                  as="h2"
                  className="text-3xl md:text-4xl font-extrabold mb-5 leading-tight"
                  style={{ color: '#143047' }}
                />
                <InlineEditable
                  editable={editable}
                  field="first_paragraph_text"
                  value={event.first_paragraph_text || ''}
                  display={firstParagraphText}
                  placeholder="Einleitungstext…"
                  as="p"
                  className="text-base md:text-lg leading-relaxed text-gray-700"
                />
              </div>
              {aboutImages.length > 0 && (
                <div className={aboutImages.length > 1 ? 'grid grid-cols-1 gap-4' : ''}>
                  {aboutImages.map((img, index) => (
                    <Editable
                      editable={editable}
                      target="about_images"
                      as="div"
                      key={`${img.url}-${index}`}
                      className={`group relative overflow-hidden rounded-2xl bg-gray-100 ${aboutImages.length > 1 ? 'h-56' : 'h-72 md:h-[420px]'}`}
                      style={{ boxShadow: '0 18px 40px rgba(20,48,71,0.18)', border: '1px solid #e5e8ed' }}
                    >
                      <Image
                        src={img.url}
                        alt={img.alt || `${event.title || event.name || 'Event'} Bild ${index + 1}`}
                        title={img.title || undefined}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(20,48,71,0.28))' }} />
                    </Editable>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── SPIELPLAN ────────────────────────────────────────────────────────── */}
      {showSpielplan && spielplan && spielplan.length > 0 && (
        <section className="py-14 px-4 scroll-mt-40" id="spielplan" style={{ background: '#eef3fb', borderTop: '1px solid #e5e8ed', borderBottom: '1px solid #e5e8ed', order: orderOf('spielplan') }}>
          <div className="container mx-auto max-w-4xl">
            <Editable editable={editable} target="spielplan" as="h2" className="text-3xl md:text-4xl font-extrabold mb-8 leading-tight" style={{ color: '#143047' }}>Spielplan</Editable>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead style={{ background: '#143047' }}>
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/70">Datum</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/70">Session</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/70">Spielpaarung</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/70">Runde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spielplan.map((item, idx) => (
                      <tr key={idx} className="border-t border-gray-100 hover:bg-blue-50/40 transition">
                        <td className="px-6 py-4 font-bold whitespace-nowrap" style={{ color: '#143047' }}>{item.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-sm px-3 py-1 text-xs font-bold text-white" style={{ background: '#143047' }}>{item.session}</span>
                        </td>
                        <td className="px-6 py-4 text-gray-700 whitespace-pre-line leading-relaxed">{item.matchup}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.round ? (
                            <span className="inline-flex items-center rounded-sm bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{item.round}</span>
                          ) : <span className="text-gray-400">–</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── WISSENSWERTES ────────────────────────────────────────────────────── */}
      {showWissenswertes && (
        <section className="py-14 px-4 scroll-mt-40" id="wissenswertes" style={{ ...BLUE_GLOW, order: orderOf('wissenswertes') }}>
          <div className="container mx-auto max-w-4xl">
            <InlineEditable
              editable={editable}
              field="wissenswertes_title"
              singleLine
              value={event.wissenswertes_title || ''}
              display={wissenswertesTitle}
              placeholder="Titel…"
              as="h2"
              className="text-3xl md:text-4xl font-extrabold mb-5 leading-tight text-white"
            />
            <InlineEditable
              editable={editable}
              field="wissenswertes_text"
              value={wissenswertesText}
              display={wissenswertesText}
              placeholder="Text…"
              as="p"
              className="text-base md:text-lg leading-relaxed text-white/80 mb-6"
            />
            {wissenswertesAccordionText && (
              <details className="group overflow-hidden rounded-xl [&_summary::-webkit-details-marker]:hidden" style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)' }}>
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 font-bold text-base text-white select-none transition hover:bg-white/5">
                  <span>{wissenswertesAccordionTitle}</span>
                  <div className="flex items-center justify-center w-7 h-7 rounded-full border font-bold text-xl leading-none transition-all duration-300 group-open:rotate-45" style={{ borderColor: '#d9531e', color: '#d9531e' }}>+</div>
                </summary>
                <div className="px-6 pb-6 pt-4 text-white/80 text-base leading-relaxed space-y-4 whitespace-pre-line" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  {wissenswertesAccordionText.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </details>
            )}
          </div>
        </section>
      )}

      {/* ── STADIONPLAN ──────────────────────────────────────────────────────── */}
      {showStadionplan && (
        <section className="py-14 px-4 scroll-mt-40" id="stadionplan" style={{ background: '#eef3fb', borderTop: '1px solid #e5e8ed', borderBottom: '1px solid #e5e8ed', order: orderOf('stadionplan') }}>
          <div className="container mx-auto max-w-6xl">
            <InlineEditable
              editable={editable}
              field="stadionplan_title"
              singleLine
              value={event.stadionplan_title || ''}
              display={stadionplanTitle}
              placeholder="Titel…"
              as="h2"
              className="text-3xl md:text-4xl font-extrabold mb-8 leading-tight"
              style={{ color: '#143047' }}
            />
            <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1.2fr] gap-10 items-start">
              {stadionplanImage ? (
                <Editable editable={editable} target="stadionplan" as="div" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex justify-center items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stadionplanImage} alt={event.stadionplan_image_alt || stadionplanTitle} title={event.stadionplan_image_title || undefined} className="max-h-[500px] w-auto object-contain rounded-lg" />
                </Editable>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-400 text-sm">Kein Plan-Bild hinterlegt</div>
              )}
              <div className="flex flex-col justify-start">
                {stadionplanVenueName && (
                  <h3 className="text-xl md:text-2xl font-extrabold mb-5 leading-tight" style={{ color: '#143047' }}>{stadionplanVenueName}</h3>
                )}
                <InlineEditable
                  editable={editable}
                  field="stadionplan_description"
                  value={stadionplanDescription}
                  placeholder="Beschreibung…"
                  className="text-gray-700 text-sm md:text-base leading-relaxed space-y-4"
                  display={stadionplanDescription.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── LAGEPLAN ─────────────────────────────────────────────────────────── */}
      {hasLageplan && (
        <section className="py-14 px-4 bg-white scroll-mt-40" id="lageplan" style={{ order: orderOf('lageplan') }}>
          <div className="container mx-auto max-w-6xl">
            <Editable editable={editable} target="lageplan" as="h2" className="text-3xl md:text-4xl font-extrabold mb-2 leading-tight" style={{ color: '#143047' }}>Lageplan</Editable>
            {getEventLocationLine(event) && (
              <p className="text-base text-gray-600 mb-8 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#d9531e">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                {getEventLocationLine(event)}
              </p>
            )}
            <div className="w-full" style={{ height: 480 }}>
              <LageplanMap pins={eventPins} pinIcons={pinIcons} geocodeQuery={geocodeQuery} venueLabel={venueLabel} />
            </div>
          </div>
        </section>
      )}

      {/* ── UNSERE TICKETS (Kategorien-Tabs) ─────────────────────────────────── */}
      {hasTicketCats && (
        <section className="py-14 px-4 bg-white scroll-mt-40" id="ticket-kategorien" style={{ order: orderOf('ticket_categories') }}>
          <TicketCategories title={ticketCatsTitle} intro={ticketCatsIntro} categories={ticketCats} editable={editable} />
        </section>
      )}

      {/* ── PACKAGES / TICKETS ───────────────────────────────────────────────── */}
      {showPackages && (
        <section className="py-14 px-4 scroll-mt-40" id="tickets" style={{ background: '#eef3fb', borderTop: '1px solid #e5e8ed', order: orderOf('packages') }}>
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-2 leading-tight text-center" style={{ color: '#143047' }}>Unsere Packages</h2>
            <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto">
              Wählen Sie Ihr Package — von einzelnen Spieltagen bis zu exklusiven Halbfinale- und Finale-Kombinationen.
            </p>

            {packages.length === 0 && (
              <EventContactForm eventSlug={event.slug} eventName={event.name || event.title} />
            )}

            {packages.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                {packages.map((pkg) => (
                  <a
                    key={pkg.id}
                    href={`#pkg-${pkg.slug || pkg.id}`}
                    className="group block rounded-xl p-5 transition-all hover:-translate-y-1"
                    style={{
                      background: pkg.popular ? '#143047' : 'white',
                      border: pkg.popular ? '2px solid #143047' : '1.5px solid #e5e8ed',
                      boxShadow: pkg.popular ? '0 6px 20px rgba(20,48,71,0.18)' : '0 2px 8px rgba(0,0,0,0.06)',
                      color: pkg.popular ? 'white' : '#143047',
                    }}
                  >
                    {pkg.popular && (
                      <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f5c842' }}>★ Empfohlen</div>
                    )}
                    {pkg.available_spots && pkg.available_spots <= 10 && (
                      <div className="text-xs font-bold mb-2" style={{ color: pkg.popular ? '#fca5a5' : '#d9531e' }}>
                        Nur noch {pkg.available_spots} Plätze
                      </div>
                    )}
                    <div className="font-extrabold text-base leading-tight mb-1">{pkg.title}</div>
                    <div className="text-sm mb-3" style={{ opacity: 0.7 }}>{pkg.short_description?.slice(0, 80)}{(pkg.short_description?.length ?? 0) > 80 ? '…' : ''}</div>
                    <div className="font-extrabold text-2xl">{Number(pkg.price || 0).toLocaleString('de-DE')} €</div>
                    <div className="text-xs mt-0.5" style={{ opacity: 0.65 }}>pro Person im DZ</div>
                    <div className="mt-4 text-xs font-bold text-center py-2 rounded-lg transition-all group-hover:opacity-90" style={{ background: pkg.popular ? '#d9531e' : '#143047', color: 'white' }}>
                      Details &amp; Buchen →
                    </div>
                  </a>
                ))}
              </div>
            )}

            <div className="space-y-8">
              {packages.map((pkg) => (
                <div key={pkg.id} id={`pkg-${pkg.slug || pkg.id}`} className="scroll-mt-40">
                  <PackageCard
                    id={pkg.slug || pkg.id}
                    eventSlug={event.slug}
                    stars={Number(pkg.stars || 0)}
                    nights={Number(pkg.nights || 0)}
                    price={Number(pkg.price || 0)}
                    title={pkg.title || ''}
                    description={pkg.short_description || pkg.description || ''}
                    popular={Boolean(pkg.popular)}
                    availableSpots={pkg.available_spots || undefined}
                    rating={pkg.rating || undefined}
                    reviews={pkg.reviews || undefined}
                    singleSurcharge={pkg.single_supplement || undefined}
                    eventDateRange={eventDateRange || undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      {showFaqs && (
        <section className="py-14 px-4 scroll-mt-40" id="faq" style={{ ...BLUE_GLOW, order: orderOf('faq') }}>
          <div className="container mx-auto max-w-4xl">
            <Editable editable={editable} target="faq" as="h2" className="text-3xl md:text-4xl font-extrabold mb-8 leading-tight text-white">FAQ zu {event.name || event.title}</Editable>
            {faqs.length === 0 ? (
              <p className="text-white/50">Noch keine FAQs hinterlegt.</p>
            ) : (
              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <details key={faq.id || idx} className="group overflow-hidden rounded-xl [&_summary::-webkit-details-marker]:hidden" style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)' }}>
                    <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 font-semibold text-base md:text-lg text-white select-none transition hover:bg-white/5">
                      <span className="leading-snug">{faq.question}</span>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 transition-all duration-300 group-open:rotate-180" style={{ borderColor: 'rgba(255,255,255,0.45)', color: '#fff' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </summary>
                    <div className="px-5 pb-5 pt-1 text-white/80 text-sm md:text-base leading-relaxed whitespace-pre-line">{faq.answer}</div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── BOTTOM CTA STRIP ─────────────────────────────────────────────────── */}
      <section className="py-12 px-4 text-center" style={{ background: '#143047', order: 100 }}>
        <p className="text-white/70 text-sm mb-4 uppercase tracking-widest font-semibold">Bereit für Ihr Erlebnis?</p>
        <a
          href={ctaHref}
          className="inline-flex items-center rounded-sm px-8 py-4 text-base md:text-lg font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] shadow-lg"
          style={{ background: '#d9531e' }}
        >
          {heroCtaLabel}
        </a>
      </section>

      {/* ── STICKY MOBIL-CTA ──────────────────────────────────────────────────── */}
      {!editable && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 md:hidden"
          style={{ background: 'rgba(11,24,40,0.97)', borderTop: '1px solid rgba(255,255,255,0.16)', backdropFilter: 'blur(4px)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              {eventDateRange && <div className="truncate text-[11px] text-white/65">{eventDateRange}</div>}
              <div className="truncate text-sm font-bold text-white">{event.name || event.title}</div>
            </div>
            <a href={ctaHref} className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-bold text-white shadow-md" style={{ background: '#d9531e' }}>
              Jetzt anfragen
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

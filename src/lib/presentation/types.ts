/**
 * presentation/types.ts – Datenmodell des Präsentations-Builders.
 * Reine Typen (kein Server-Import), nutzbar in Client & Server.
 *
 * Ein Deck besteht aus Folien (`Slide`). Jede Folie hat einen `kind`, der bestimmt,
 * welche Inhaltsfelder gerendert werden. Das Layout selbst kommt aus `layout.ts` und
 * ist für Web-, PDF- und PPTX-Renderer identisch.
 */

export type SlideKind =
  | 'title'     // Titelfolie: grosses Bild + Titelpanel
  | 'story'     // Fliesstext links, Bilder rechts (Event-/Reisebeschreibung)
  | 'program'   // Tagesprogramm (Vormittag/Nachmittag/Abend + WOW)
  | 'hotels'    // Hotelvorstellungen mit Adressblock
  | 'services'  // Inkludierte / nicht inkludierte Leistungen
  | 'pricing'   // Preistabelle
  | 'gallery'   // Bildseite (1–4 Bilder, ganzflächig)
  | 'about'     // Über Faltin Travel + Kontaktpanel
  | 'closing';  // Abschluss / Call-to-Action

export type DeckLang = 'de' | 'en' | 'fr';

export interface SlideImage {
  url: string;
  caption?: string;
  credit?: string;
}

export interface HotelEntry {
  name: string;
  stars?: string;     // z.B. "4-Sterne"
  address?: string;
  phone?: string;
  web?: string;
  text: string;
}

export interface ServiceEntry {
  text: string;
  included: boolean;  // true = inkludiert (Haken), false = nicht inkludiert
}

export interface PriceRow {
  label: string;
  note?: string;
  price: string;      // als Text, damit Währung/Zusätze frei bleiben
}

export interface ProgramBlock {
  label: string;      // "Vormittag", "Nachmittag", "Abend"
  text: string;
}

export interface Slide {
  id: string;
  kind: SlideKind;
  title: string;
  kicker?: string;          // kleine Zeile über dem Titel
  meta?: string[];          // Datum / Ort / Claim – je Zeile ein Eintrag
  body?: string;            // Fliesstext, Leerzeile = neuer Absatz
  bullets?: string[];
  images: SlideImage[];
  hotels?: HotelEntry[];
  services?: ServiceEntry[];
  prices?: PriceRow[];
  program?: ProgramBlock[];
  highlight?: string;       // hervorgehobene Zeile (z.B. WOW-Moment)
  notes?: string;           // Sprechernotizen – landen in der PPTX
}

/** Kopf-/Fussdaten, die auf mehreren Folien auftauchen. */
export interface DeckMeta {
  subtitle?: string;    // "Travel Package"
  period?: string;      // "Mi. 15.09. – Mo. 20.09.2027"
  location?: string;    // "Irland, Adare Manor"
  customerName?: string;
  footerNote?: string;
}

export interface Deck {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  lang: DeckLang;
  status: 'draft' | 'final';
  share_token: string;
  share_enabled: boolean;
  meta: DeckMeta;
  slides: Slide[];
}

export interface DeckListRow {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  status: string;
  lang: string;
  slide_count: number;
  share_enabled: boolean;
  share_token: string;
}

/* ─── Beschriftungen je Sprache ───────────────────────────────────────────── */

export const UI_TEXT: Record<DeckLang, Record<string, string>> = {
  de: {
    included: 'Inkludierte Leistungen', notIncluded: 'Nicht inkludiert',
    program: 'Programm', prices: 'Preise', perPerson: 'Preis pro Person',
    hotels: 'Ihre Hotels', about: 'Über Faltin Travel', highlight: 'Highlight',
    morning: 'Vormittag', afternoon: 'Nachmittag', evening: 'Abend',
  },
  en: {
    included: 'Included services', notIncluded: 'Not included',
    program: 'Programme', prices: 'Prices', perPerson: 'Price per person',
    hotels: 'Your hotels', about: 'About Faltin Travel', highlight: 'Highlight',
    morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
  },
  fr: {
    included: 'Prestations incluses', notIncluded: 'Non inclus',
    program: 'Programme', prices: 'Prix', perPerson: 'Prix par personne',
    hotels: 'Vos hôtels', about: 'À propos de Faltin Travel', highlight: 'Temps fort',
    morning: 'Matin', afternoon: 'Après-midi', evening: 'Soirée',
  },
};

export function t(lang: DeckLang, key: string): string {
  return UI_TEXT[lang]?.[key] || UI_TEXT.de[key] || key;
}

export const SLIDE_KIND_LABELS: Record<SlideKind, string> = {
  title: 'Titelfolie',
  story: 'Text & Bild',
  program: 'Programm / Tagesablauf',
  hotels: 'Hotels',
  services: 'Leistungen',
  pricing: 'Preise',
  gallery: 'Bildseite',
  about: 'Über Faltin Travel',
  closing: 'Abschluss',
};

/** Wie viele Bilder ein Folientyp sinnvoll aufnimmt. */
export const SLIDE_IMAGE_SLOTS: Record<SlideKind, number> = {
  title: 2, story: 2, program: 2, hotels: 2, services: 1,
  pricing: 1, gallery: 4, about: 1, closing: 1,
};

/**
 * presentation/blocks.ts – Inhaltsplan einer Folie.
 * ─────────────────────────────────────────────────────────────────────────────
 * Aus einer `Slide` entsteht hier eine lineare Liste typisierter Blöcke. Web-,
 * PDF- und PPTX-Renderer arbeiten ausschliesslich mit dieser Liste — dadurch
 * stimmen Reihenfolge, Texte und Hierarchie in allen drei Ausgaben überein.
 * Der vertikale Umbruch bleibt Sache des jeweiligen Renderers.
 */
import { paragraphs } from './theme';
import { t, type Deck, type Slide } from './types';

export type BlockKind =
  | 'kicker'      // kleine Versalzeile
  | 'title'       // Folientitel
  | 'titleBig'    // Titel der Titelfolie
  | 'meta'        // Datum / Ort / Claim
  | 'para'        // Fliesstext-Absatz (Blocksatz)
  | 'bullet'      // Aufzählungspunkt
  | 'subhead'     // Zwischentitel (Hotelname)
  | 'contact'     // Adress-/Kontaktzeile (klein, gedämpft)
  | 'link'        // Web-Adresse
  | 'highlight'   // hervorgehobene Zeile (WOW / Kernaussage)
  | 'label'       // Spaltenüberschrift (z.B. „Inkludierte Leistungen")
  | 'serviceRow'  // Leistung mit Haken oder Kreuz
  | 'priceRow'    // Preiszeile (Bezeichnung … Preis)
  | 'programCell';// Tagesabschnitt als Kachel

export interface Block {
  kind: BlockKind;
  text?: string;
  /** zusätzliche Felder je nach Blocktyp */
  label?: string;
  note?: string;
  value?: string;
  included?: boolean;
  /** zusätzlicher Abstand über dem Block, als Vielfaches der Grundzeile */
  gap?: number;
}

/** Erzeugt den Inhaltsplan der Textspalte einer Folie. */
export function buildBlocks(slide: Slide, deck: Deck): Block[] {
  const lang = deck.lang;
  const out: Block[] = [];
  const push = (b: Block) => out.push(b);

  if (slide.kicker) push({ kind: 'kicker', text: slide.kicker });
  if (slide.title) push({ kind: slide.kind === 'title' ? 'titleBig' : 'title', text: slide.title });
  for (const m of slide.meta || []) if (m.trim()) push({ kind: 'meta', text: m });

  const body = paragraphs(slide.body);
  if (body.length) {
    body.forEach((p, i) => push({ kind: 'para', text: p, gap: i === 0 ? 1 : 0.55 }));
  }

  switch (slide.kind) {
    case 'program': {
      const cells = (slide.program || []).filter((p) => p.text?.trim());
      cells.forEach((c, i) => push({ kind: 'programCell', label: c.label, text: c.text, gap: i === 0 ? 1 : 0.4 }));
      break;
    }
    case 'hotels': {
      (slide.hotels || []).forEach((h, i) => {
        if (h.text?.trim()) push({ kind: 'para', text: h.text, gap: i === 0 ? 1 : 0.9 });
        const name = [h.name, h.stars ? `(${h.stars})` : ''].filter(Boolean).join(' ');
        if (name) push({ kind: 'subhead', text: name, gap: 0.5 });
        const line = [h.address, h.phone ? `Tel. ${h.phone}` : ''].filter(Boolean).join(' · ');
        if (line) push({ kind: 'contact', text: line });
        if (h.web) push({ kind: 'link', text: h.web });
      });
      break;
    }
    case 'services': {
      const inc = (slide.services || []).filter((s) => s.included && s.text.trim());
      const exc = (slide.services || []).filter((s) => !s.included && s.text.trim());
      if (inc.length) {
        push({ kind: 'label', text: t(lang, 'included'), gap: 1 });
        inc.forEach((s) => push({ kind: 'serviceRow', text: s.text, included: true }));
      }
      if (exc.length) {
        push({ kind: 'label', text: t(lang, 'notIncluded'), gap: 1 });
        exc.forEach((s) => push({ kind: 'serviceRow', text: s.text, included: false }));
      }
      break;
    }
    case 'pricing': {
      const rows = (slide.prices || []).filter((p) => p.label.trim() || p.price.trim());
      rows.forEach((r, i) => push({ kind: 'priceRow', text: r.label, note: r.note, value: r.price, gap: i === 0 ? 1 : 0 }));
      break;
    }
    default:
      break;
  }

  for (const b of slide.bullets || []) if (b.trim()) push({ kind: 'bullet', text: b });
  if (slide.highlight?.trim()) push({ kind: 'highlight', text: slide.highlight, gap: 1 });

  return out;
}

/** Inhalt des rechten Panels (Titelfolie, Über-uns, Abschluss). */
export interface PanelContent {
  kicker?: string;
  title?: string;
  lines: string[];
  showLogo: boolean;
}

export function buildPanel(slide: Slide, deck: Deck, company: {
  name: string; street: string; zip: string; city: string; country: string;
  phone?: string; email?: string; website?: string;
}): PanelContent {
  if (slide.kind === 'title') {
    return {
      title: slide.title,
      kicker: slide.kicker || deck.meta.subtitle,
      lines: [deck.meta.period, deck.meta.location, ...(slide.meta || [])].filter((x): x is string => !!x?.trim()),
      showLogo: true,
    };
  }
  // Über-uns / Abschluss: Firmenanschrift
  const lines = [
    `${company.name}`,
    company.street,
    `${company.zip} ${company.city} · ${company.country}`,
    company.phone ? `Telefon: ${company.phone}` : '',
    company.email ? `E-Mail: ${company.email}` : '',
    company.website || '',
  ].filter(Boolean);
  return { lines, showLogo: true };
}

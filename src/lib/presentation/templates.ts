/**
 * presentation/templates.ts – Startfolien und Übernahme aus dem KI-Incentive-Planer.
 * Reine Datenfabrik ohne Server-Abhängigkeiten (auch im Client nutzbar).
 */
import type { IncentivePlanRecord } from '../incentive/types';
import { t, type Deck, type DeckLang, type Slide, type SlideKind } from './types';

let seq = 0;
/** Kurze, im Browser wie auf dem Server funktionierende Folien-ID. */
export function slideId(): string {
  seq += 1;
  return `s${Date.now().toString(36)}${seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** Standardtext der Über-uns-Folie (entspricht dem gedruckten Faltin-Profil). */
export const ABOUT_TEXT: Record<DeckLang, string> = {
  de: `Faltin Travel ist ein mehrfach ausgezeichneter Sport- und Event-Reiseveranstalter mit Sitz in Regensdorf, Kanton Zürich. Wir stehen für sorgfältig konzipierte Reisepakete, persönliche Betreuung und hohe Qualitätsstandards – von der Planung bis zur Begleitung vor Ort.

Als **autorisierter Vertriebspartner offizieller Reisepakete** arbeiten wir ausschliesslich mit lizenzierten Kontingenten. Das sichert den Zugang zu echten Leistungen mit klar definiertem Umfang.

Faltin Travel ist Teilnehmer am **Garantiefonds der Schweizer Reisebranche**. Die Zahlungen unserer Kundinnen und Kunden sind damit nach den gesetzlichen Vorgaben vollumfänglich abgesichert.

Darüber hinaus sind wir Mitglied im **Schweizer Reise-Verband (SRV)** – ein Bekenntnis zu Professionalität, Branchenkenntnis und anerkannten Qualitätsstandards.`,
  en: `Faltin Travel is an award-winning sports and event travel operator based in Regensdorf near Zurich, Switzerland. We stand for carefully designed travel packages, personal support and high quality standards – from planning to on-site delivery.

As an **authorised distributor of official travel packages** we work exclusively with licensed allocations, securing access to genuine services with a clearly defined scope.

Faltin Travel participates in the **guarantee fund of the Swiss travel industry**. All customer payments are therefore fully protected in line with statutory requirements.

We are also a member of the **Swiss Travel Association (SRV)** – a commitment to professionalism, industry expertise and recognised quality standards.`,
  fr: `Faltin Travel est un opérateur touristique sportif et événementiel primé, basé à Regensdorf, canton de Zurich, en Suisse. Nous défendons des forfaits de voyage soigneusement conçus, un accompagnement personnalisé et des normes de qualité élevées – de la planification à la mise en œuvre sur site.

En tant que **distributeur autorisé de forfaits de voyage officiels**, nous ne négocions que des contingents licenciés, garantissant l'accès à des services authentiques au périmètre clairement défini.

Faltin Travel participe au **fonds de garantie de l'industrie du voyage suisse**. Les versements de nos clients sont ainsi entièrement couverts conformément aux exigences légales.

Nous sommes également membre de l'**Association suisse du voyage (SRV)** – un engagement envers le professionnalisme, l'expertise sectorielle et des standards reconnus.`,
};

/** Leere Folie eines Typs mit sinnvollen Vorgaben. */
export function emptySlide(kind: SlideKind, lang: DeckLang = 'de'): Slide {
  const base: Slide = { id: slideId(), kind, title: '', images: [] };
  switch (kind) {
    case 'title':
      return { ...base, title: 'Titel der Reise', kicker: 'Travel Package' };
    case 'story':
      return { ...base, title: 'Die Reise', body: '' };
    case 'program':
      return {
        ...base, title: 'Tag 1', kicker: t(lang, 'program'),
        program: [
          { label: t(lang, 'morning'), text: '' },
          { label: t(lang, 'afternoon'), text: '' },
          { label: t(lang, 'evening'), text: '' },
        ],
      };
    case 'hotels':
      return { ...base, title: t(lang, 'hotels'), hotels: [{ name: '', stars: '', address: '', phone: '', web: '', text: '' }] };
    case 'services':
      return { ...base, title: t(lang, 'included'), services: [{ text: '', included: true }] };
    case 'pricing':
      return { ...base, title: t(lang, 'prices'), prices: [{ label: '', note: '', price: '' }] };
    case 'gallery':
      return { ...base, title: '' };
    case 'about':
      return { ...base, title: t(lang, 'about'), body: ABOUT_TEXT[lang] };
    case 'closing':
      return { ...base, title: 'Wir liefern Emotionen.', body: '' };
    default:
      return base;
  }
}

/** Grundgerüst eines neuen Decks. */
export function starterSlides(title: string, lang: DeckLang = 'de'): Slide[] {
  const titleSlide = emptySlide('title', lang);
  titleSlide.title = title || 'Neue Präsentation';
  return [titleSlide, emptySlide('story', lang), emptySlide('hotels', lang), emptySlide('services', lang), emptySlide('about', lang)];
}

/**
 * Übernimmt einen fertigen KI-Incentive-Plan als Foliensatz:
 * Titel → Story → je Tag eine Programmfolie → Unterkunft → Highlights → Budget → Über uns.
 */
export function slidesFromIncentive(record: IncentivePlanRecord, lang: DeckLang = 'de'): Slide[] {
  const plan = record.plan;
  if (!plan) return starterSlides(record.title, lang);
  const brief = record.brief;
  const dest = plan.destination;
  const out: Slide[] = [];

  const period = brief?.periods?.[0];
  const periodText = period ? `${period.start} – ${period.end}` : '';
  const where = [dest?.name, dest?.country].filter(Boolean).join(', ');

  out.push({
    id: slideId(), kind: 'title', title: plan.introTitle || record.title,
    kicker: 'Incentive',
    meta: [brief?.groupSize ? `${brief.groupSize} Personen` : '', brief?.days ? `${brief.days} Tage` : ''].filter(Boolean),
    images: dest?.imageUrl ? [{ url: dest.imageUrl, credit: dest.imageCredit }] : [],
  });

  out.push({
    id: slideId(), kind: 'story', title: dest?.name || 'Das Ziel',
    kicker: where, meta: [periodText, dest?.region || ''].filter(Boolean),
    body: [plan.introText, plan.summary].filter(Boolean).join('\n\n'),
    images: dest?.imageUrl ? [{ url: dest.imageUrl, credit: dest.imageCredit }] : [],
    highlight: dest?.weather?.summary ? `Wetter: ${dest.weather.summary}` : undefined,
  });

  for (const day of plan.days || []) {
    out.push({
      id: slideId(), kind: 'program',
      title: day.title || `Tag ${day.day}`,
      kicker: `${t(lang, 'program')} · Tag ${day.day}`,
      meta: day.theme ? [day.theme] : [],
      body: day.text || '',
      program: [
        { label: t(lang, 'morning'), text: day.morning || '' },
        { label: t(lang, 'afternoon'), text: day.afternoon || '' },
        { label: t(lang, 'evening'), text: day.evening || '' },
      ].filter((p) => p.text.trim()),
      highlight: day.wow ? `★ ${day.wow}` : undefined,
      images: day.imageUrl ? [{ url: day.imageUrl, credit: day.imageCredit }] : [],
      notes: day.activities?.map((a) => `${a.name}: ${a.description}`).join('\n') || '',
    });
  }

  if (plan.accommodation?.name) {
    out.push({
      id: slideId(), kind: 'hotels', title: t(lang, 'hotels'),
      hotels: [{ name: plan.accommodation.name, text: plan.accommodation.description || '', address: '', phone: '', web: '' }],
      body: plan.logistics ? `**Anreise & Transfers:** ${plan.logistics}` : '',
      images: dest?.imageUrl ? [{ url: dest.imageUrl }] : [],
    });
  }

  if (plan.wowHighlights?.length) {
    out.push({
      id: slideId(), kind: 'story', title: 'Signature-Momente', kicker: t(lang, 'highlight'),
      bullets: plan.wowHighlights, images: [],
    });
  }

  if (plan.estBudgetPerPerson) {
    out.push({
      id: slideId(), kind: 'pricing', title: t(lang, 'prices'),
      prices: [{ label: t(lang, 'perPerson'), note: 'Richtwert, keine verbindliche Offerte', price: plan.estBudgetPerPerson }],
      images: [],
    });
  }

  out.push(emptySlide('about', lang));
  return out;
}

/** Vorschlag für den Decktitel aus einem Incentive-Plan. */
export function deckTitleFromIncentive(record: IncentivePlanRecord): string {
  return record.plan?.introTitle || record.title || 'Incentive';
}

/** Frisches Deck-Objekt für die Client-Vorschau (ohne Persistenz). */
export function draftDeck(title: string, lang: DeckLang, slides: Slide[]): Deck {
  const now = new Date().toISOString();
  return {
    id: 'draft', created_at: now, updated_at: now, title, lang, status: 'draft',
    share_token: '', share_enabled: false, meta: {}, slides,
  };
}

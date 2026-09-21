/**
 * Besondere Wuensche / Anmerkungen aus dem Freitext einer Anfrage erkennen.
 *
 * Der Kunde schreibt im Anfrageformular unter "Nachricht (optional)" alles hinein,
 * was nicht in die Felder passt: Rollstuhl, Allergie, Hochzeitstag, eigener Flug.
 * Genau diese Anfragen darf niemand im Kanban uebersehen.
 *
 * WICHTIG – warum hier Themen erkannt werden statt "hat Freitext":
 * Ein Abgleich gegen die Produktivdaten (2721 Anfragen, Stand 21.09.2026) ergab,
 * dass 75 % aller Anfragen irgendeinen Freitext haben – fast immer der ganz
 * normale Satz "Ich interessiere mich fuer 2 Karten". Wuerde jede davon leuchten,
 * leuchtet das Board und niemand sieht mehr den einen Rollstuhl darin. Laut
 * markiert wird deshalb nur, was einem konkreten Thema zuzuordnen ist (rund 22 %);
 * uebriger Freitext bekommt nur einen leisen Hinweis (rund 46 %).
 *
 * Die Einordnung ist ein Hinweis, keine Wahrheit. Sie sortiert vor und faerbt ein,
 * der Volltext steht daneben. Lieber eine Kategorie zu viel als ein uebersehener
 * Rollstuhl.
 *
 * Reines TypeScript ohne Abhaengigkeiten, damit Server- und Client-Komponenten
 * dieselbe Logik benutzen.
 */

export type WishKey =
  | 'barrierefrei'
  | 'ernaehrung'
  | 'anlass'
  | 'gruppe'
  | 'anreise'
  | 'tickets'
  | 'zimmer'
  | 'zahlung';

export interface WishCategory {
  key: WishKey | 'freitext';
  /** Kurzform fuer die Chips auf der Karte. */
  label: string;
  /** Langform als Tooltip / Dashboard-Erklaerung. */
  hint: string;
  emoji: string;
  color: string;
  bg: string;
}

/**
 * Reihenfolge = Dringlichkeit. Was oben steht, bestimmt Farbe und Rand der Karte,
 * wenn eine Anfrage mehrere Themen enthaelt: Barrierefreiheit schlaegt Zimmerwunsch.
 */
export const WISH_CATEGORIES: WishCategory[] = [
  { key: 'barrierefrei', label: 'Barrierefrei', hint: 'Mobilität & Barrierefreiheit',     emoji: '♿',          color: '#dc2626', bg: '#fef2f2' },
  { key: 'ernaehrung',   label: 'Ernährung',    hint: 'Allergien & Verpflegung',          emoji: '\u{1F957}',       color: '#ea580c', bg: '#fff7ed' },
  { key: 'anlass',       label: 'Anlass',       hint: 'Geschenk, Geburtstag, Jubiläum',   emoji: '\u{1F381}',       color: '#7c3aed', bg: '#faf5ff' },
  { key: 'gruppe',       label: 'Gruppe',       hint: 'Kinder, Familie, Senioren, Gruppe', emoji: '\u{1F465}',      color: '#0d9488', bg: '#f0fdfa' },
  { key: 'anreise',      label: 'Anreise',      hint: 'Flug, Transfer, Zusatznächte',     emoji: '✈️',    color: '#1a6fa8', bg: '#f0f7ff' },
  { key: 'tickets',      label: 'Tickets',      hint: 'VIP, Hospitality, Kategorie, Plätze', emoji: '\u{1F3AB}',    color: '#d9531e', bg: '#fff8f5' },
  { key: 'zimmer',       label: 'Zimmer',       hint: 'Zimmer- & Hotelwünsche',           emoji: '\u{1F6CF}️', color: '#143047', bg: '#eef2f7' },
  { key: 'zahlung',      label: 'Zahlung',      hint: 'Rechnung, Raten, Storno',          emoji: '\u{1F4B6}',       color: '#16a34a', bg: '#f0fdf4' },
];

/** Leiser Hinweis: Freitext vorhanden, aber kein Thema erkannt. */
export const FREITEXT_CATEGORY: WishCategory = {
  key: 'freitext',
  label: 'Freitext',
  hint: 'Nachricht ohne erkennbares Thema',
  emoji: '\u{1F4DD}',
  color: '#6b7280',
  bg: '#f5f7fa',
};

const BY_KEY = new Map<WishKey, WishCategory>(WISH_CATEGORIES.map((c) => [c.key as WishKey, c]));

/**
 * Schluesselwoerter je Thema. Deutsch bildet Komposita, darum matcht der Wortstamm
 * als Teilstring ("rollstuhl" trifft auch "Rollstuhlfahrerin"). Wo das zu falschen
 * Treffern fuehrt (zug in Bezug, Flugzeug), begrenzt \b. Englisch ist ergaenzt,
 * weil regelmaessig Anfragen aus UK/US eingehen.
 */
const KEYWORDS: Record<WishKey, string[]> = {
  barrierefrei: [
    'rollstuhl', 'rollator', 'gehbehind', 'gehhilfe', 'barrierefrei', 'barriere-frei',
    // 'handicap' bewusst NICHT: bei Ryder Cup & Co. ist das die Golf-Vorgabe.
    'behinder', 'mobilitätseingeschr', 'mobilitaetseingeschr',
    'eingeschränkt mobil', 'schlecht zu fuß', 'nicht gut zu fuß',
    'keine treppe', 'ohne treppe', 'treppenfrei', 'ebenerdig', 'aufzug', 'fahrstuhl',
    'pflegebedürftig', 'begleitperson', 'blind', 'gehörlos', 'schwerhörig',
    'hörgerät', 'sauerstoff', 'dialyse',
    'wheelchair', 'accessible', 'disabled', 'disability', 'step-free',
  ],
  ernaehrung: [
    'allergi', 'unverträglich', 'unvertraeglich', 'glutenfrei', 'gluten',
    'laktose', 'vegan', 'vegetari', 'halal', 'koscher', 'diät', 'diaet',
    'zöliakie', 'zoeliakie', 'nussallergie', 'meeresfrüchte',
    'kein schweinefleisch', 'ernährung', 'lebensmittelunvertr',
    'allerg', 'dietary', 'lactose', 'gluten-free',
  ],
  anlass: [
    'geburtstag', 'jubiläum', 'jubilaeum', 'hochzeit', 'jahrestag',
    'überrasch', 'ueberrasch', 'junggesell', 'flitterwochen', 'verlobung',
    'geschenk', 'schenken', 'verschenken', 'weihnacht',
    'birthday', 'anniversary', 'honeymoon', 'surprise', 'present for',
  ],
  gruppe: [
    'gruppe', 'kind\\b', 'kinder', 'familie', 'jugendlich', 'senior',
    'jahre alt', 'jährig', 'jaehrig', 'minderjährig', 'betriebsausflug',
    'firmenausflug', 'verein', 'fanclub', 'freundeskreis', 'junggesellenabschied',
    'children', 'kids',
  ],
  anreise: [
    'flug', 'flughafen', 'abflug', 'anreise', 'abreise', 'transfer', 'shuttle',
    '\\bbahn\\b', '\\bzug\\b', 'zugticket', 'bahnticket', 'mietwagen', 'parkplatz',
    'verlänger', 'verlaenger', 'zusatznacht', 'zusätzliche nächte',
    'zusätzliche nacht', 'extra nacht', 'früher an', 'später ab',
    'eigene anreise', 'selbst anreise', 'ohne flug', 'nur hotel',
    'flight', 'own travel',
  ],
  tickets: [
    '\\bvip\\b', 'hospitality', 'kategorie', 'tribüne', 'tribuene', 'sitzplatz',
    'sitzplätze', 'stehplatz', 'nebeneinander', 'zusammen sitzen',
    'logen', 'business seat', 'premium', 'oberrang', 'unterrang',
  ],
  zimmer: [
    'doppelbett', 'einzelbett', 'getrennte bett', 'twin', 'nichtraucher',
    'raucherzimmer', 'balkon', 'meerblick', 'benachbarte zimmer', 'zimmer nebenan',
    'gleiche etage', 'ruhiges zimmer', 'ruhige lage', 'klimaanlage', 'badewanne',
    'kinderbett', 'zustellbett', 'suite', 'upgrade', 'hotelwunsch',
    'anderes hotel', 'näher am', 'naeher am', 'später check', 'late check',
    'early check', 'frühstück',
  ],
  zahlung: [
    'ratenzahlung', 'in raten', 'anzahlung', 'auf rechnung', 'firmenrechnung',
    'rechnungsadresse', 'gutschein', 'zahlungsziel', 'überweisung',
    'ueberweisung', 'kreditkarte', 'rabatt', 'skonto', 'storno',
    'reiserücktritt', 'versicherung',
  ],
};

const PATTERNS = Object.fromEntries(
  (Object.keys(KEYWORDS) as WishKey[]).map((key) => [key, new RegExp(KEYWORDS[key].join('|'), 'i')]),
) as Record<WishKey, RegExp>;

/**
 * Was Kunden statt einer Nachricht tippen: Platzhalter, Tastaturtests und die
 * blosse Wiederholung der Personenzahl. Das ist keine Anmerkung.
 */
const BELANGLOS = new RegExp(
  '^(?:' +
    '[-–—.,;:!?*_/\\s]*' +                                  // nur Satzzeichen
    '|test\\w*|asdf\\w*|[a-z]{1,4}|x+' +                              // Tastaturtests
    '|keine?(?:\\s+angaben?)?|keine\\s+wünsche|kein\\s+wunsch' +
    '|nein|nichts|entfällt|n\\.?\\s?a\\.?|none|no' +
    // "2 Personen", "für 4 Tickets", "Tickets für 2 Personen", "zwei Karten"
    '|(?:tickets?\\s+)?(?:f(?:ü|ue)r\\s+)?' +
      '(?:\\d+|zwei|drei|vier|f(?:ü|ue)nf|sechs|sieben|acht)' +
      '(?:\\s*[-–]\\s*\\d+)?\\s*' +
      '(?:personen?|pers\\.?|erwachsene|tickets?|karten?|pl(?:ä|ae)tze?|pax)\\.?' +
  ')$',
  'i',
);

/** Normalisiert den Freitext: Umbrueche raus, Mehrfachleerzeichen weg. */
function norm(text?: string | null): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

/**
 * Enthaelt der Freitext ueberhaupt eine Aussage? Filtert Platzhalter und die
 * blosse Wiederholung der Personenzahl heraus.
 */
export function hasWishText(text?: string | null): boolean {
  const t = norm(text);
  if (t.length < 15) return false;
  if (t.split(' ').length < 3) return false;
  return !BELANGLOS.test(t);
}

/**
 * Welche Themen stecken im Freitext? Leeres Array heisst: kein erkennbares Thema –
 * das kann trotzdem ein Text sein (siehe {@link hasWishText}).
 */
export function detectWishKeys(text?: string | null): WishKey[] {
  const t = norm(text).toLowerCase();
  if (t.length < 10) return [];
  // Reihenfolge von WISH_CATEGORIES beibehalten, damit die Farbe stabil bleibt.
  return WISH_CATEGORIES
    .filter((c) => PATTERNS[c.key as WishKey].test(t))
    .map((c) => c.key as WishKey);
}

export function wishCategory(key: WishKey): WishCategory {
  return BY_KEY.get(key) || WISH_CATEGORIES[0];
}

/** Einzeiler fuer die Kanban-Karte: hinten gekuerzt. */
export function wishSnippet(text?: string | null, max = 120): string {
  const t = norm(text);
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
}

export interface WishInfo {
  /** Ein konkretes Thema wurde erkannt – die Karte wird laut markiert. */
  has: boolean;
  keys: WishKey[];
  categories: WishCategory[];
  /** Fuehrendes Thema – bestimmt Farbe und Rand der Karte. */
  lead?: WishCategory;
  /** Nachricht mit Aussage, aber ohne erkanntes Thema – nur leiser Hinweis. */
  hasText: boolean;
  snippet: string;
  /** Intern gepflegte Notiz vorhanden (schwaecheres Signal als der Kundentext). */
  hasNotes: boolean;
}

/** Vollstaendige Einschaetzung einer Anfrage (Kundennachricht + interne Notiz). */
export function analyzeWishes(message?: string | null, notes?: string | null): WishInfo {
  const hasNotes = hasWishText(notes);
  const text = norm(message);
  const keys = text ? detectWishKeys(text) : [];
  const categories = keys.map(wishCategory);
  return {
    has: categories.length > 0,
    keys,
    categories,
    lead: categories[0],
    hasText: categories.length === 0 && hasWishText(text),
    snippet: wishSnippet(text),
    hasNotes,
  };
}

/** Zaehlung ueber eine Liste Anfragen – Grundlage fuer die Dashboard-Kacheln. */
export function wishCounts(infos: WishInfo[]): {
  /** Anfragen mit erkanntem Thema. */
  total: number;
  /** Anfragen mit Freitext, aber ohne Thema. */
  freitext: number;
  byKey: Record<WishKey, number>;
} {
  const byKey = Object.fromEntries(WISH_CATEGORIES.map((c) => [c.key, 0])) as Record<WishKey, number>;
  let total = 0;
  let freitext = 0;
  for (const info of infos) {
    if (info.hasText) freitext++;
    if (!info.has) continue;
    total++;
    for (const key of info.keys) byKey[key]++;
  }
  return { total, freitext, byKey };
}

/**
 * belege/kontenplan.ts — Kontenplan der Faltin Travel AG (Stand Paul Limacher, 09.11.2026)
 * und die Regeln, mit denen ein Beleg vorkontiert wird.
 * ─────────────────────────────────────────────────────────────────────────────
 * Reine Logik ohne Node-Abhängigkeiten (Client + Server + Tests).
 *
 *  - KONTEN:      Blatt-Konten (6-stellig) aus «Kontenplan Erfolgsrechnung.xls» und den
 *                 für Belege nötigen Bilanzkonten aus «Kontenplan Bilanz.xls».
 *  - KATEGORIEN:  was die Erfassenden wählen (verständlich, mit Symbol). Jede Kategorie
 *                 kennt ihr Aufwandkonto – je nach Inland/Ausland ein anderes.
 *  - Gegenkonto:  ergibt sich aus der Zahlungsart (bar, Firmenkarte, privat, Rechnung, Bank)
 *                 und der Währung.
 *  - Vorsteuer:   nur bei Schweizer Belegen; Konto 117000 (Material/Dienstleistungen, Klasse 4)
 *                 bzw. 117100 (Investitionen und übriger Betriebsaufwand).
 * Die Buchhaltung kann alles im Desktop überschreiben; die Regeln liefern nur den Vorschlag.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface Konto {
  nr: string;
  name: string;
  /** Gruppe für die Auswahl (Kontenklasse/-gruppe). */
  gruppe: string;
}

const G = {
  handel: 'Material, Waren, Drittleistungen',
  personal: 'Personalaufwand',
  raum: 'Raumaufwand',
  urek: 'Unterhalt & Kleininvestitionen',
  fahrzeug: 'Fahrzeugaufwand',
  versicherung: 'Versicherungen, Abgaben, Gebühren',
  energie: 'Energie & Entsorgung',
  verwaltung: 'Verwaltung & Informatik',
  werbung: 'Werbung & Verkauf',
  uebrig: 'Übriger Betriebsaufwand',
  finanz: 'Finanzaufwand',
  ausserordentlich: 'Ausserordentlich',
  liquid: 'Flüssige Mittel',
  forderung: 'Forderungen & Vorsteuer',
  anlage: 'Anlagen (aktivieren)',
  kreditor: 'Verbindlichkeiten',
} as const;

export const KONTEN: Konto[] = [
  // ── Klasse 4: Aufwand für Material, Waren und Drittleistungen
  { nr: '420000', name: 'Handelswareneinkauf (Inland)', gruppe: G.handel },
  { nr: '420010', name: 'Handelswareneinkauf (Ausland)', gruppe: G.handel },
  { nr: '427000', name: 'Direkte Einkaufsspesen Handelswareneinkauf', gruppe: G.handel },
  { nr: '429000', name: 'Einkaufspreisminderungen Handelswaren', gruppe: G.handel },
  { nr: '440000', name: 'Aufwand für Drittleistungen (Dienstleistungen)', gruppe: G.handel },
  // ── Klasse 5: Personalaufwand (nur belegrelevante Konten)
  { nr: '540030', name: 'Pauschalspesen', gruppe: G.personal },
  { nr: '548000', name: 'Personalbeschaffung', gruppe: G.personal },
  { nr: '548100', name: 'Aus- und Weiterbildung', gruppe: G.personal },
  { nr: '548200', name: 'Spesenentschädigungen effektiv Inland', gruppe: G.personal },
  { nr: '548220', name: 'Spesenentschädigungen effektiv Ausland', gruppe: G.personal },
  { nr: '548900', name: 'Sonstiger Personalaufwand', gruppe: G.personal },
  // ── Klasse 6: Sonstiger Betriebsaufwand
  { nr: '600000', name: 'Fremdmieten Geschäftsräume', gruppe: G.raum },
  { nr: '603000', name: 'Nebenkosten Geschäftsräume', gruppe: G.raum },
  { nr: '604000', name: 'Reinigung und Unterhalt Geschäftsräume', gruppe: G.raum },
  { nr: '611000', name: 'UREK Mobiliar und Einrichtungen', gruppe: G.urek },
  { nr: '613000', name: 'UREK Büromaschinen, EDV- u. Kommunikationssysteme, Software', gruppe: G.urek },
  { nr: '620000', name: 'Reparaturen, Service, Reinigung Personenwagen', gruppe: G.fahrzeug },
  { nr: '620010', name: 'Pneu Personenwagen', gruppe: G.fahrzeug },
  { nr: '621000', name: 'Benzin Personenwagen', gruppe: G.fahrzeug },
  { nr: '622000', name: 'Versicherungen Personenwagen', gruppe: G.fahrzeug },
  { nr: '623000', name: 'Verkehrsabgaben, Beiträge, Gebühren Personenwagen', gruppe: G.fahrzeug },
  { nr: '626000', name: 'Fahrzeugleasing', gruppe: G.fahrzeug },
  { nr: '630000', name: 'Betriebshaftpflichtversicherung', gruppe: G.versicherung },
  { nr: '630100', name: 'Unternehmenssachversicherung', gruppe: G.versicherung },
  { nr: '636000', name: 'Abgaben, Gebühren, Bewilligungen', gruppe: G.versicherung },
  { nr: '640000', name: 'Elektrizität, Gas, Brennstoffe, Heizmaterial, Wasser', gruppe: G.energie },
  { nr: '646000', name: 'Kehrichtabfuhr, Sondermüllabfuhr, Abwasser', gruppe: G.energie },
  { nr: '650000', name: 'Büromaterial, Fotokopien', gruppe: G.verwaltung },
  { nr: '650100', name: 'Drucksachen, Formulare', gruppe: G.verwaltung },
  { nr: '650300', name: 'Fachliteratur', gruppe: G.verwaltung },
  { nr: '651000', name: 'Telefon, Telefax, Natel', gruppe: G.verwaltung },
  { nr: '651300', name: 'Porti', gruppe: G.verwaltung },
  { nr: '652000', name: 'Beiträge, Spenden, Vergabungen, Trinkgelder', gruppe: G.verwaltung },
  { nr: '653000', name: 'Buchführungshonorare und Abschlussberatung', gruppe: G.verwaltung },
  { nr: '653010', name: 'Steuerberatung', gruppe: G.verwaltung },
  { nr: '653100', name: 'Unternehmensberatung', gruppe: G.verwaltung },
  { nr: '653200', name: 'Rechtsberatung', gruppe: G.verwaltung },
  { nr: '654300', name: 'Sonstiger Verwaltungsaufwand', gruppe: G.verwaltung },
  { nr: '656000', name: 'EDV-Dienstleistungshonorare', gruppe: G.verwaltung },
  { nr: '657000', name: 'Lizenzaufwendungen/Update', gruppe: G.verwaltung },
  { nr: '657100', name: 'Wartung/Hotline Hardware', gruppe: G.verwaltung },
  { nr: '657200', name: 'Wartung/Hotline Software', gruppe: G.verwaltung },
  { nr: '657300', name: 'Verbrauchsmaterial EDV', gruppe: G.verwaltung },
  { nr: '657400', name: 'Kleininvestitionen Hardware', gruppe: G.verwaltung },
  { nr: '657410', name: 'Kleininvestitionen Software', gruppe: G.verwaltung },
  { nr: '657500', name: 'Standleitungsgebühren', gruppe: G.verwaltung },
  { nr: '658000', name: 'Konzeptberatung', gruppe: G.verwaltung },
  { nr: '658100', name: 'Individual-Entwicklung, individuelle Anpassungen', gruppe: G.verwaltung },
  { nr: '658200', name: 'Einführungsaufwand, Schulungen', gruppe: G.verwaltung },
  { nr: '658300', name: 'EDV-Projektaufwand', gruppe: G.verwaltung },
  { nr: '658400', name: 'Internetaufwand', gruppe: G.verwaltung },
  { nr: '660000', name: 'Werbeinserate', gruppe: G.werbung },
  { nr: '661000', name: 'Werbedrucksachen, Prospekte', gruppe: G.werbung },
  { nr: '661010', name: 'Preislisten', gruppe: G.werbung },
  { nr: '662100', name: 'Fachmessen, Ausstellungen', gruppe: G.werbung },
  { nr: '666000', name: 'Werbebeiträge, Sponsoring', gruppe: G.werbung },
  { nr: '667000', name: 'Öffentlichkeitsarbeit, Public Relations', gruppe: G.werbung },
  { nr: '668000', name: 'Werbeberatung', gruppe: G.werbung },
  { nr: '669000', name: 'Reisespesen, Kundenbetreuung', gruppe: G.werbung },
  { nr: '669100', name: 'Kundengeschenke', gruppe: G.werbung },
  { nr: '669200', name: 'Kundenanlässe', gruppe: G.werbung },
  { nr: '669300', name: 'Aussendienstspesen pauschal', gruppe: G.werbung },
  { nr: '673900', name: 'Sonstiger Betriebsaufwand', gruppe: G.uebrig },
  { nr: '680000', name: 'Zinsaufwand', gruppe: G.finanz },
  { nr: '684000', name: 'Bankspesen', gruppe: G.finanz },
  { nr: '684200', name: 'Fremdwährungsverluste', gruppe: G.finanz },
  { nr: '801000', name: 'Ausserordentlicher und betriebsfremder Aufwand', gruppe: G.ausserordentlich },
  // ── Bilanz: Gegenkonten, Vorsteuer, Aktivierung
  { nr: '100000', name: 'Kasse', gruppe: G.liquid },
  { nr: '102000', name: 'Credit Suisse CHF Kto. 1832242-21', gruppe: G.liquid },
  { nr: '102002', name: 'Credit Suisse EUR Kto. 1832242-22', gruppe: G.liquid },
  { nr: '102003', name: 'Credit Suisse USD Kto. 1832242-22-1', gruppe: G.liquid },
  { nr: '102004', name: 'Credit Suisse GBP Kto. 1832242-22-2', gruppe: G.liquid },
  { nr: '102005', name: 'UBS CHF', gruppe: G.liquid },
  { nr: '102006', name: 'UBS EUR', gruppe: G.liquid },
  { nr: '102007', name: 'UBS USD', gruppe: G.liquid },
  { nr: '102008', name: 'UBS GBP', gruppe: G.liquid },
  { nr: '109000', name: 'Durchlaufkonto Flüssige Mittel', gruppe: G.liquid },
  { nr: '116000', name: 'Spesenvorschuss gegenüber Gesellschafter', gruppe: G.forderung },
  { nr: '117000', name: 'MWST: Vorsteuer auf Materialaufwand und Dienstleistungen', gruppe: G.forderung },
  { nr: '117100', name: 'MWST: Vorsteuer auf Investitionen und übrigem Betriebsaufwand', gruppe: G.forderung },
  { nr: '119200', name: 'Vorauszahlungen an Lieferanten', gruppe: G.forderung },
  { nr: '130000', name: 'Aktive Rechnungsabgrenzung (Transitorische Aktiven)', gruppe: G.forderung },
  { nr: '151000', name: 'Geschäftsmobiliar', gruppe: G.anlage },
  { nr: '152000', name: 'Büromaschinen', gruppe: G.anlage },
  { nr: '152100', name: 'EDV-Systeme', gruppe: G.anlage },
  { nr: '152200', name: 'Kommunikationssysteme', gruppe: G.anlage },
  { nr: '152600', name: 'Software', gruppe: G.anlage },
  { nr: '153000', name: 'Personenwagen', gruppe: G.anlage },
  { nr: '200000', name: 'Kreditoren in CHF', gruppe: G.kreditor },
  { nr: '200002', name: 'Kreditoren in EUR', gruppe: G.kreditor },
  { nr: '200003', name: 'Kreditoren in USD', gruppe: G.kreditor },
  { nr: '200004', name: 'Kreditoren in GBP', gruppe: G.kreditor },
  { nr: '200020', name: 'Durchlaufkonto Kreditoren', gruppe: G.kreditor },
  { nr: '206000', name: 'Verbindl. aus Lieferungen/Leistungen geg. Gesellschafter', gruppe: G.kreditor },
];

const BY_NR = new Map(KONTEN.map((k) => [k.nr, k]));

export function kontoName(nr: string | null | undefined): string {
  return (nr && BY_NR.get(nr)?.name) || '';
}

export function isKnownKonto(nr: string | null | undefined): boolean {
  return !!nr && BY_NR.has(nr);
}

// ───────────────────────── Kategorien (Erfassung) ─────────────────────────

export interface Kategorie {
  key: string;
  label: string;
  emoji: string;
  /** Kurzer Hinweis, wann man das wählt. */
  hint: string;
  /** Aufwandkonto Inland / Ausland. */
  konto: string;
  kontoAusland?: string;
  /** Kategorie der Event-Kosten (Tabelle expenses), falls der Beleg einem Event zugeordnet ist. */
  expense: string;
  /** Suchwörter für die Vorschlags-Logik (Lieferant/Text). */
  words: string[];
}

export const KATEGORIEN: Kategorie[] = [
  { key: 'kunde_leistung', label: 'Leistung für Kunden', emoji: '🎟️', hint: 'Tickets, Hotel, Transfer, Hospitality für eine Reise', konto: '420000', kontoAusland: '420010', expense: 'tickets', words: ['ticket', 'tickets', 'hospitality', 'stadium', 'stadion', 'ticketmaster', 'axs', 'viagogo', 'stubhub', 'transfer', 'shuttle', 'dmc'] },
  { key: 'essen_kunde', label: 'Essen mit Kunden', emoji: '🥂', hint: 'Bewirtung, Kundenbetreuung', konto: '669000', expense: 'catering', words: ['restaurant', 'ristorante', 'brasserie', 'bar', 'café', 'cafe', 'bistro', 'trattoria', 'grill', 'steakhouse', 'pub'] },
  { key: 'verpflegung', label: 'Verpflegung unterwegs', emoji: '🥪', hint: 'Eigene Verpflegung auf Geschäftsreise', konto: '548200', kontoAusland: '548220', expense: 'personal', words: ['bäckerei', 'baeckerei', 'coop', 'migros', 'kiosk', 'starbucks', 'mcdonald', 'burger', 'subway', 'sandwich', 'take away'] },
  { key: 'reise', label: 'Reise & Fahrt', emoji: '🚆', hint: 'Zug, Taxi, Flug, Parkhaus – eigene Geschäftsreise', konto: '548200', kontoAusland: '548220', expense: 'transfer', words: ['sbb', 'cff', 'ffs', 'db ', 'deutsche bahn', 'uber', 'taxi', 'bolt', 'parking', 'parkhaus', 'parkplatz', 'airline', 'swiss', 'lufthansa', 'easyjet', 'flughafen', 'airport', 'train', 'bahn', 'ticketautomat'] },
  { key: 'hotel_eigen', label: 'Hotel (eigene Reise)', emoji: '🛏️', hint: 'Übernachtung von Mitarbeitenden', konto: '548200', kontoAusland: '548220', expense: 'hotel', words: ['hotel', 'inn', 'resort', 'hostel', 'marriott', 'hilton', 'hyatt', 'novotel', 'ibis', 'motel', 'booking.com'] },
  { key: 'kunde_anlass', label: 'Kundenanlass', emoji: '🎉', hint: 'Event, Apéro, Einladung für Kunden', konto: '669200', expense: 'catering', words: ['apero', 'apéro', 'event', 'catering'] },
  { key: 'kunde_geschenk', label: 'Kundengeschenk', emoji: '🎁', hint: 'Präsente für Kunden und Partner', konto: '669100', expense: 'marketing', words: ['geschenk', 'gift', 'blumen', 'wein', 'confiserie', 'sprüngli', 'spruengli', 'läderach', 'laederach'] },
  { key: 'werbung', label: 'Werbung & Marketing', emoji: '📣', hint: 'Inserate, Social Ads, Drucksachen', konto: '660000', expense: 'marketing', words: ['google ads', 'facebook', 'meta platforms', 'linkedin', 'inserat', 'werbung', 'flyer', 'druckerei', 'print'] },
  { key: 'messe', label: 'Messe & Sponsoring', emoji: '🏟️', hint: 'Messestand, Sponsoring', konto: '662100', expense: 'marketing', words: ['messe', 'fair', 'expo', 'sponsoring'] },
  { key: 'software', label: 'Software & Abos', emoji: '💻', hint: 'Lizenzen, SaaS, Cloud', konto: '657000', expense: 'sonstiges', words: ['microsoft', 'adobe', 'google', 'apple.com', 'openai', 'anthropic', 'canva', 'dropbox', 'zoom', 'slack', 'github', 'aws', 'hetzner', 'license', 'lizenz', 'subscription', 'abo'] },
  { key: 'hardware', label: 'Hardware & Geräte', emoji: '🖥️', hint: 'Kleingeräte, Zubehör (unter Aktivierungsgrenze)', konto: '657400', expense: 'sonstiges', words: ['digitec', 'galaxus', 'mediamarkt', 'media markt', 'interdiscount', 'brack', 'apple store', 'logitech'] },
  { key: 'telefon', label: 'Telefon & Internet', emoji: '📱', hint: 'Natel, Festnetz, Internet', konto: '651000', expense: 'sonstiges', words: ['swisscom', 'sunrise', 'salt', 'upc', 'natel', 'roaming', 'mobile'] },
  { key: 'buero', label: 'Büromaterial', emoji: '📎', hint: 'Papier, Toner, Kleinkram', konto: '650000', expense: 'sonstiges', words: ['papeterie', 'office', 'büro', 'buero', 'toner', 'staples', 'lyreco'] },
  { key: 'porto', label: 'Porto & Versand', emoji: '📮', hint: 'Post, Kurier', konto: '651300', expense: 'sonstiges', words: ['post', 'dhl', 'ups', 'fedex', 'porto', 'swiss post', 'die post'] },
  { key: 'auto', label: 'Auto & Benzin', emoji: '⛽', hint: 'Tanken, Service Geschäftsauto', konto: '621000', expense: 'transfer', words: ['tankstelle', 'shell', 'bp ', 'avia', 'agrola', 'socar', 'esso', 'tamoil', 'benzin', 'diesel', 'fuel'] },
  { key: 'weiterbildung', label: 'Weiterbildung', emoji: '🎓', hint: 'Kurse, Seminare, Fachliteratur', konto: '548100', expense: 'personal', words: ['kurs', 'seminar', 'schulung', 'training', 'akademie', 'udemy', 'buch'] },
  { key: 'gebuehren', label: 'Gebühren & Bank', emoji: '🏦', hint: 'Bankspesen, Bewilligungen, Amtsgebühren', konto: '636000', expense: 'gebuehren', words: ['gebühr', 'gebuehr', 'fee', 'bewilligung', 'amt', 'visa', 'esta'] },
  { key: 'beratung', label: 'Beratung & Treuhand', emoji: '🤝', hint: 'Treuhand, Recht, Beratung', konto: '653100', expense: 'sonstiges', words: ['treuhand', 'beratung', 'consulting', 'anwalt', 'notar', 'advokatur'] },
  { key: 'trinkgeld', label: 'Trinkgeld & Spenden', emoji: '🪙', hint: 'Trinkgelder, Spenden, Beiträge', konto: '652000', expense: 'sonstiges', words: ['trinkgeld', 'tip', 'spende', 'donation'] },
  { key: 'sonstiges', label: 'Sonstiges', emoji: '📦', hint: 'Passt nirgends – die Buchhaltung schaut es an', konto: '654300', expense: 'sonstiges', words: [] },
];

const KAT_BY_KEY = new Map(KATEGORIEN.map((k) => [k.key, k]));

export function kategorie(key: string | null | undefined): Kategorie {
  return (key && KAT_BY_KEY.get(key)) || KAT_BY_KEY.get('sonstiges')!;
}

/** Aufwandkonto einer Kategorie – Ausland, wenn das Belegland nicht die Schweiz ist. */
export function kontoFuerKategorie(key: string | null | undefined, land: string | null | undefined): string {
  const k = kategorie(key);
  const ausland = !!land && land.toUpperCase() !== 'CH' && land.toUpperCase() !== 'LI';
  return ausland && k.kontoAusland ? k.kontoAusland : k.konto;
}

/** Kategorie aus Lieferant/Text erraten (für Belege ohne Vorgeschichte). */
export function kategorieAusText(text: string): string | null {
  const t = ` ${text.toLowerCase()} `;
  let best: { key: string; score: number } | null = null;
  for (const k of KATEGORIEN) {
    let score = 0;
    for (const w of k.words) if (t.includes(w)) score += w.length > 5 ? 2 : 1;
    if (score > 0 && (!best || score > best.score)) best = { key: k.key, score };
  }
  return best?.key ?? null;
}

// ───────────────────────── Zahlungsart → Gegenkonto ─────────────────────────

export type Zahlungsart = 'firmenkarte' | 'bar' | 'privat' | 'rechnung' | 'bank';

export const ZAHLUNGSARTEN: { key: Zahlungsart; label: string; emoji: string; hint: string }[] = [
  { key: 'firmenkarte', label: 'Firmenkarte', emoji: '💳', hint: 'Mit der Faltin-Kreditkarte bezahlt' },
  { key: 'privat', label: 'Privat ausgelegt', emoji: '👛', hint: 'Selbst bezahlt – wird zurückerstattet' },
  { key: 'bar', label: 'Bar (Kasse)', emoji: '💵', hint: 'Aus der Firmenkasse' },
  { key: 'rechnung', label: 'Rechnung offen', emoji: '🧾', hint: 'Muss noch bezahlt werden' },
  { key: 'bank', label: 'Schon überwiesen', emoji: '🏦', hint: 'Per Bank bereits bezahlt' },
];

export function isZahlungsart(v: unknown): v is Zahlungsart {
  return typeof v === 'string' && ZAHLUNGSARTEN.some((z) => z.key === v);
}

/** Konfigurierbare Gegenkonten (settings.json → belege). Standard nach Kontenplan Paul Limacher. */
export interface GegenkontoRegeln {
  firmenkarte: string;
  bar: string;
  privat: string;
  /** Wer als Gesellschafter gilt (E-Mail, klein): «privat» läuft dort auf das Gesellschafter-Konto. */
  gesellschafter_emails: string[];
  privat_gesellschafter: string;
}

export const DEFAULT_GEGENKONTEN: GegenkontoRegeln = {
  firmenkarte: '109000',
  bar: '100000',
  privat: '200000',
  gesellschafter_emails: ['faltin@faltintravel.com'],
  privat_gesellschafter: '206000',
};

const UBS: Record<string, string> = { CHF: '102005', EUR: '102006', USD: '102007', GBP: '102008' };
const KREDITOREN: Record<string, string> = { CHF: '200000', EUR: '200002', USD: '200003', GBP: '200004' };

export function gegenkonto(
  zahlung: Zahlungsart | string | null | undefined,
  waehrung: string | null | undefined,
  person: string | null | undefined,
  regeln: GegenkontoRegeln = DEFAULT_GEGENKONTEN,
): string {
  const cur = (waehrung || 'CHF').toUpperCase();
  switch (zahlung) {
    case 'bar': return regeln.bar;
    case 'privat': {
      const p = (person || '').toLowerCase();
      return p && regeln.gesellschafter_emails.includes(p) ? regeln.privat_gesellschafter : regeln.privat;
    }
    case 'rechnung': return KREDITOREN[cur] || KREDITOREN.CHF;
    case 'bank': return UBS[cur] || UBS.CHF;
    case 'firmenkarte':
    default:
      return regeln.firmenkarte;
  }
}

// ───────────────────────── MWST ─────────────────────────

/** Gültige Schweizer Sätze (ab 2024) plus die alten für ältere Belege. */
export const MWST_SAETZE_CH = [8.1, 3.8, 2.6, 0] as const;
export const MWST_SAETZE_ALT = [7.7, 3.7, 2.5] as const;

/** Vorsteuerkonto zum Aufwandkonto (nur Schweizer Belege mit MWST). */
export function vorsteuerKonto(aufwandKonto: string | null | undefined): string {
  return (aufwandKonto || '').startsWith('4') ? '117000' : '117100';
}

/** Ist Vorsteuer abziehbar? Nur Schweizer (bzw. Liechtensteiner) Belege. */
export function vorsteuerAbziehbar(land: string | null | undefined): boolean {
  const l = (land || 'CH').toUpperCase();
  return l === 'CH' || l === 'LI';
}

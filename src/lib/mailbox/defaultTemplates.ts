/**
 * mailbox/defaultTemplates.ts — Standard-Vorlagen und -Textbausteine (werden beim ersten
 * Start eingespielt, danach im Client pflegbar). Platzhalter: siehe PLACEHOLDERS.
 */
export interface DefaultTemplate {
  id: string;
  kind: 'vorlage' | 'baustein';
  title: string;
  category: string;
  lang?: string;
  subject?: string;
  body: string;
  description?: string;
  shortcut?: string;
  greeting?: string;
}

/** Platzhalter, die der Editor beim Einfügen füllt (leere bleiben als [[…]] markiert). Quelle: Auswertung der Faltin-Versandmails 11/2026. */
export const PLACEHOLDERS: Array<{ key: string; label: string }> = [
  {
    "key": "kunde.anrede",
    "label": "Herr / Frau"
  },
  {
    "key": "kunde.anrede_endung",
    "label": "Grammatische Endung für «Sehr geehrte/r», «Liebe/r»: leer bei Frau, «r» bei Herr"
  },
  {
    "key": "kunde.anrede_en",
    "label": "Mr / Ms"
  },
  {
    "key": "kunde.titel",
    "label": "Akademischer Titel, optional (Dr., Magister …); leer wenn keiner"
  },
  {
    "key": "kunde.vorname",
    "label": "Vorname des Kunden bzw. Ansprechpartners (Du-Form, EN)"
  },
  {
    "key": "kunde.nachname",
    "label": "Nachname des Kunden"
  },
  {
    "key": "kunde.firma",
    "label": "Firma bei Geschäftskunden/Agenturen"
  },
  {
    "key": "event",
    "label": "Eventname inkl. Jahr, z. B. «Ryder Cup 2027», «PDC Darts WM 2027»"
  },
  {
    "key": "event.url",
    "label": "Link zur Eventseite auf faltintravel.com"
  },
  {
    "key": "ort",
    "label": "Reiseziel/Stadt (London, Paris, Turin …)"
  },
  {
    "key": "rq",
    "label": "Anfragenummer, z. B. RQ-13397"
  },
  {
    "key": "buchung.nr",
    "label": "Buchungs-/Dossiernummer (FT-Nummer, z. B. FT32272)"
  },
  {
    "key": "rechnung.nr",
    "label": "Rechnungsnummer (z. B. FT32272 oder FT-D-000045-R)"
  },
  {
    "key": "referenz",
    "label": "Fremdreferenz (Bestellnummer Lieferant, Booking Reference)"
  },
  {
    "key": "betrag",
    "label": "Rechnungsbetrag inkl. Währung, Format «EUR 3.885,-» bzw. EN «EUR 3,885»"
  },
  {
    "key": "zahlbar_bis",
    "label": "Zahlungsfrist, Format TT.MM.JJJJ"
  },
  {
    "key": "zahlungslink",
    "label": "Kreditkarten-Zahlungslink (Saferpay)"
  },
  {
    "key": "bank.iban",
    "label": "IBAN des Faltin-Kontos je Währung (EUR/CHF) – aus Stammdaten, nie fest im Text"
  },
  {
    "key": "bank.bic",
    "label": "SWIFT/BIC der Bank"
  },
  {
    "key": "reise.zeitraum",
    "label": "Zeitraum lesbar, z. B. «Mi. 15.09.2027 – Mo. 20.09.2027»"
  },
  {
    "key": "reise.anreise",
    "label": "Anreisedatum mit Wochentag, z. B. «Do. 03.06.2027»"
  },
  {
    "key": "reise.abreise",
    "label": "Abreisedatum mit Wochentag"
  },
  {
    "key": "anzahl_naechte",
    "label": "Anzahl Übernachtungen"
  },
  {
    "key": "anzahl_personen",
    "label": "Anzahl Personen/Tickets"
  },
  {
    "key": "anzahl_zimmer",
    "label": "Anzahl Zimmer (Hotelanfrage)"
  },
  {
    "key": "hotel",
    "label": "Hotelname"
  },
  {
    "key": "zimmer",
    "label": "Zimmerkategorie, z. B. «Superior-Doppelzimmer», «Family Room»"
  },
  {
    "key": "verpflegung",
    "label": "Verpflegung (EN: board basis), z. B. «buffet breakfast»"
  },
  {
    "key": "kategorie",
    "label": "Ticket-/Sitzkategorie, z. B. «Sitzplatz Tribüne Nord»"
  },
  {
    "key": "leistungen",
    "label": "Leistungsliste, eine Zeile pro Leistung, beginnend mit «Inkl. …»"
  },
  {
    "key": "leistungen_kurz",
    "label": "Leistungen als Fliesstext in einem Satz"
  },
  {
    "key": "preis_pp",
    "label": "Preis pro Person inkl. Währung"
  },
  {
    "key": "preis_zusatznacht",
    "label": "Preis Verlängerungsnacht pro Person (optional)"
  },
  {
    "key": "ticket_hinweis",
    "label": "Ticketart, z. B. «PDF-Tickets (nicht personalisiert / versandbereit)»"
  },
  {
    "key": "tickets.versand_tage",
    "label": "Vorlauf Ticketversand in Tagen, z. B. «7–10»"
  },
  {
    "key": "unterlagen.versand_tage",
    "label": "Vorlauf Reiseunterlagen in Tagen, z. B. «7–14»"
  },
  {
    "key": "frist",
    "label": "Frist für Kundenangaben, z. B. «diesen Freitagmittag»"
  },
  {
    "key": "gebuehr",
    "label": "Gebühr, z. B. «EUR 50,-»"
  },
  {
    "key": "auswahl",
    "label": "Ausgebuchte Auswahl (Hotel, Session, Kategorie)"
  },
  {
    "key": "alternative",
    "label": "Angebotene Alternative als Text/Liste"
  },
  {
    "key": "zeitpunkt",
    "label": "Voraussichtlicher Verkaufsstart, z. B. «Mitte September 2026»"
  },
  {
    "key": "antwort",
    "label": "Freitext: Antwort auf die konkrete Kundenfrage"
  },
  {
    "key": "hinweis",
    "label": "Freitext: besonderer Hinweis (z. B. Hotel umbenannt)"
  },
  {
    "key": "hinweis_einlass",
    "label": "Freitext: Einlass-/Treffpunkt-Regelung vor Ort"
  },
  {
    "key": "naechster_schritt",
    "label": "Freitext: Angebot/Info für das Folgejahr"
  },
  {
    "key": "anhaenge_beschreibung",
    "label": "Beschreibung der Anhänge, z. B. «den Geländeplan und den Netzplan des ÖV»"
  },
  {
    "key": "anfrage_beschreibung",
    "label": "Kurzbeschreibung der Gruppenanfrage (EN)"
  },
  {
    "key": "anliegen",
    "label": "Freitext an Leistungsträger"
  },
  {
    "key": "reisende",
    "label": "Namensliste der Reisenden, eine Zeile pro Person (NACHNAME Vorname)"
  },
  {
    "key": "lieferant.vorname",
    "label": "Vorname Ansprechperson beim Leistungsträger"
  },
  {
    "key": "lieferant.anrede_endung",
    "label": "Endung für «Liebe/r» beim Leistungsträger"
  },
  {
    "key": "lieferant.name",
    "label": "Firma des Leistungsträgers"
  },
  {
    "key": "kontakt.vorort.name",
    "label": "Name der Ansprechperson vor Ort"
  },
  {
    "key": "kontakt.vorort.telefon",
    "label": "Telefon der Ansprechperson vor Ort (geschäftlich)"
  },
  {
    "key": "thema",
    "label": "Betreff interne Notiz"
  },
  {
    "key": "inhalt",
    "label": "Text interne Notiz"
  },
  {
    "key": "kurzinfo",
    "label": "Ein Satz Kontext bei interner Weiterleitung"
  },
  {
    "key": "betreff_original",
    "label": "Betreff der weitergeleiteten Mail"
  },
  {
    "key": "empfaenger.vorname",
    "label": "Vorname des internen Empfängers"
  },
  {
    "key": "absender.vorname",
    "label": "Vorname des Absenders (Gruss in Du-/EN-Mails)"
  },
  {
    "key": "absender.nachname",
    "label": "Nachname des Absenders (Signatur)"
  },
  {
    "key": "absender.funktion",
    "label": "Funktion in der Signatur: «Office Manager», «Inhaber / Geschäftsführer», EN «Owner / CEO»"
  },
  {
    "key": "absender.email",
    "label": "Persönliche Mailadresse des Absenders"
  },
  {
    "key": "absender.mobile",
    "label": "Geschäftliche Mobilnummer (optional, nicht in der Datei hinterlegt)"
  },
  {
    "key": "firma.logo_url",
    "label": "URL Firmenlogo (öffentlich: faltintravel.com/wp-content/uploads/2020/10/Faltin-Travel-Logo.png)"
  },
  {
    "key": "firma.banner_url",
    "label": "URL Banner unter der Signatur (optional)"
  },
  {
    "key": "firma.icon_facebook",
    "label": "URL Social-Icon Facebook"
  },
  {
    "key": "firma.icon_instagram",
    "label": "URL Social-Icon Instagram"
  },
  {
    "key": "firma.icon_linkedin",
    "label": "URL Social-Icon LinkedIn"
  },
  {
    "key": "firma.icon_youtube",
    "label": "URL Social-Icon YouTube"
  },
  {
    "key": "firma.iata",
    "label": "IATA-Nummer der Faltin Travel AG (aus Stammdaten)"
  },
  {
    "key": "b2b",
    "label": "Bedingter Block: nur bei Agentur-/Wiederverkäufer-Empfängern"
  }
];

/** Abgeleitet aus ~150 gesendeten Mails (faltin@, kontakt@, thomet@, request@), ohne Kundendaten.
 * Die Grussformel steht im Feld greeting und wird im Editor über der Signatur gesetzt. */
export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    "id": "anfrage-eingang-angebot",
    "kind": "vorlage",
    "title": "Anfrage-Eingang mit Standardangebot (PDF)",
    "category": "Verkauf",
    "lang": "de",
    "subject": "Ihre unverbindliche Anfrage zu {{event}} [{{rq}}]",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}}\n\nVielen Dank für die freundliche Anfrage zu {{event}}.\n\nGerne präsentieren wir Ihnen unser exklusives Arrangement. Sie finden unser unverbindliches Angebot in Form der angehängten PDF-Datei. Unsere Arrangements verstehen sich bei eigener Anreise, inkl. {{leistungen_kurz}}, detaillierte Reiseinformation & Schweizer Reisegarantie.\n\nWir hoffen, dass Ihnen unser Arrangement gefällt, und würden uns sehr freuen, Sie zu {{event}} als unsere geschätzten Reisegäste begrüssen zu dürfen. Bitte haben Sie Verständnis dafür, dass sich unser Angebot aufgrund der sehr grossen Nachfrage freibleibend versteht, vorbehaltlich der Verfügbarkeit bis zum Zeitpunkt der Buchung. Wir empfehlen Ihnen eine möglichst zeitnahe Buchung.\n\nEs tummeln sich zahlreiche dubiose, nicht autorisierte Händler und Agenturen im Internet, welche Tickets anbieten, diese letztendlich jedoch oftmals nicht liefern können oder gar mit Falschkarten handeln. Bitte seien Sie vorsichtig. Als mehrfach ausgezeichneter Sportreisen-Spezialist und Mitglied im Garantiefonds der Schweizer Reisebranche stehen wir für absolute Seriosität, Sicherheit und Zuverlässigkeit.\n\nFür Ihre verbindliche Buchung benötigen wir:\n– einen kurzen schriftlichen Buchungsauftrag\n– Name des Reiseanmelders inkl. vollständiger Adresse und Telefonnummer\n– Namen aller mitreisenden Personen\n– Unterbringungswunsch (Hotel / Zimmerart)\n\nFür Rückfragen stehen wir Ihnen gerne jederzeit persönlich zur Verfügung.",
    "description": "Automatische Erstantwort auf Web-Anfragen (heute aus request@ durch das Portal). Als Vorlage nützlich, wenn eine Anfrage per Mail/Telefon statt über das Formular kommt.",
    "shortcut": "",
    "greeting": "Herzliche Grüsse\nIhr Faltin Travel Team"
  },
  {
    "id": "angebot-senden",
    "kind": "vorlage",
    "title": "Angebot senden (nach Telefonat oder Rückfrage)",
    "category": "Verkauf",
    "lang": "de",
    "subject": "{{event}} – Ihr unverbindliches Angebot",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nvielen Dank für das freundliche Telefongespräch und Ihr Interesse an unseren {{event}} Arrangements.\n\nGerne lassen wir Ihnen im Anhang unser unverbindliches Angebot zukommen. Das Angebot versteht sich mit eigener Anreise.\n\nAngebot freibleibend, vorbehaltlich der Verfügbarkeit bis zum Zeitpunkt der Buchung/Bestätigung.\n\nWir hoffen, dass Ihnen unser Angebot gefällt, und würden uns freuen, Sie als unsere geschätzten Reisegäste zu {{event}} begrüssen zu dürfen.\n\nFür Rückfragen stehen wir Ihnen selbstverständlich jederzeit gerne persönlich zur Verfügung.",
    "description": "Kunde hat angerufen oder nachgefragt, Angebot liegt als PDF bei.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "angebot-individuell",
    "kind": "vorlage",
    "title": "Individuelles Angebot im Mailtext",
    "category": "Verkauf",
    "lang": "de",
    "subject": "{{event}} – Angebot {{reise.zeitraum}}",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nvielen Dank für Ihre freundliche Anfrage zu {{event}}.\n\nGerne unterbreiten wir Ihnen nachfolgend ein unverbindliches Angebot. Bitte lassen Sie uns wissen, falls Sie Anpassungswünsche haben.\n\n{{event}}\n{{anzahl_naechte}}x Übernachtung/Frühstück im {{hotel}}\nUnterbringung im {{zimmer}} von {{reise.anreise}} – {{reise.abreise}}\n\n{{leistungen}}\n\nZusatzleistungen:\nInkl. Faltin Travel Lanyard\nInkl. Faltin Travel Reisebeutel & Kofferanhänger\nInkl. detaillierte Reiseinformation\nInkl. Schweizer Reisegarantie\n\nPreis pro Person im Doppelzimmer: {{preis_pp}}\n{{#preis_zusatznacht}}Verlängerungsnacht pro Person: {{preis_zusatznacht}}\n{{/preis_zusatznacht}}\nUnsere Packages verstehen sich mit eigener Anreise. Angebot freibleibend, vorbehaltlich der Verfügbarkeit bis zum Zeitpunkt der Buchung/Bestätigung.\n\nEntscheiden Sie sich für eine Buchung, so benötigen wir noch Ihre Rechnungsadresse, die Namen der Reisenden und Ihre Telefonnummer für allfällige Rückfragen.\n\nFür Rückfragen stehen wir Ihnen selbstverständlich jederzeit gerne persönlich zur Verfügung.",
    "description": "Sonderwunsch (andere Nächte, Familienzimmer, Kombi-Tage) – Angebot steht direkt im Text statt im PDF.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "angebot-persoenlich-stefan",
    "kind": "vorlage",
    "title": "Persönliches Angebot vom Inhaber",
    "category": "Verkauf",
    "lang": "de",
    "subject": "AW: {{event}}",
    "body": "Sehr geehrte{{kunde.anrede_endung}} {{kunde.anrede}} {{kunde.nachname}},\n\nvielen Dank für das freundliche Telefongespräch und Ihr Interesse an unseren exklusiven {{event}} Arrangements. Gerne unterbreite ich Ihnen folgendes Angebot:\n\n{{leistungen}}\n\nPreis pro Person: {{preis_pp}}\n\nWir hoffen, dass Ihnen unser Angebot gefällt, und würden uns sehr freuen, Sie zu {{event}} als unsere geschätzten Reisegäste begrüssen zu dürfen.\n\nAuf Wunsch können wir Ihnen einen Gutschein zusenden, falls Sie gerne etwas zum Verschenken hätten.\n\nPS: Bei Gefallen empfehlen wir eine möglichst zeitnahe Buchung. Unser Kontingent ist bereits fast erschöpft.\n\nFür Rückfragen stehe ich Ihnen gerne jederzeit persönlich zur Verfügung.",
    "description": "Stefan schreibt selbst an Premium-/Stammkunden, oft nach Telefonat; Ich-Form, PS mit Dringlichkeit, Gutschein-Option.",
    "shortcut": "",
    "greeting": "Herzliche Grüsse aus der Schweiz"
  },
  {
    "id": "angebot-rueckfrage",
    "kind": "vorlage",
    "title": "Rückfrage zum Angebot beantworten",
    "category": "Verkauf",
    "lang": "de",
    "subject": "AW: Ihre unverbindliche Anfrage zu {{event}} [{{rq}}]",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nherzlichen Dank für Ihre freundliche Nachricht.\n\n{{antwort}}\n\nGerne lassen wir Ihnen im Anhang nochmals unser unverbindliches Angebot zukommen. Das Angebot versteht sich mit eigener Anreise.\n\nDie Eintrittstickets werden Ihnen ca. {{tickets.versand_tage}} Tage vor der Veranstaltung in elektronischer Form per E-Mail zugestellt.\n\nWir hoffen, Ihnen mit diesen Informationen weitergeholfen zu haben, und würden uns freuen, Sie anlässlich des Events begrüssen zu dürfen.\n\nFür weitere Fragen oder Anliegen stehen wir Ihnen jederzeit gerne persönlich zur Verfügung.",
    "description": "Kunde fragt nach Kosten, Ticketfreigabe, Hotel, Versicherung o. ä. auf das Standardangebot.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "buchungsangaben-anfordern",
    "kind": "vorlage",
    "title": "Angaben für die Buchung anfordern",
    "category": "Verkauf",
    "lang": "de",
    "subject": "AW: {{event}} – Ihre Buchung",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nvielen Dank für Ihre freundliche E-Mail und Ihr Interesse an {{event}}.\n\nGerne prüfen wir die Verfügbarkeit und nehmen auf Wunsch eine Buchung für Sie vor. Bitte beachten Sie, dass einzelne Sessions bereits ausgebucht sein können.\n\nDamit wir Ihre Buchung verbindlich bestätigen können, bitten wir Sie um folgende Angaben:\n– Ihren kurzen schriftlichen Buchungsauftrag\n– die gewünschte(n) Session(s) bzw. Turniertage\n– die vollständigen Namen aller Reisenden (Vor- und Nachname)\n– Ihre komplette Rechnungsadresse\n– Ihre Telefonnummer für allfällige Rückfragen\n\nSobald uns diese Informationen vorliegen, kümmern wir uns umgehend um die finale Bestätigung.\n\nWir freuen uns auf Ihre Rückmeldung.",
    "description": "Kunde will buchen, es fehlen Namen, Adresse oder Wunschtermine. Für Frankreich/Paris-Events ggf. Baustein «angaben-geburtsdaten» ergänzen.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "buchungsauftrag-eingang",
    "kind": "vorlage",
    "title": "Buchungsauftrag erhalten – Bestätigung folgt",
    "category": "Buchung",
    "lang": "de",
    "subject": "AW: {{event}}",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nherzlichen Dank für Ihren Buchungsauftrag.\n\nSehr gerne werden wir Ihnen zeitnah eine Buchungsbestätigung/Rechnung zukommen lassen.\n\nFür Rückfragen stehen wir Ihnen in der Zwischenzeit jederzeit gerne persönlich zur Verfügung.",
    "description": "Buchung kam rein, Rechnung wird erst noch erstellt (z. B. Verfügbarkeit beim Leistungsträger in Prüfung).",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "buchungsbestaetigung-rechnung",
    "kind": "vorlage",
    "title": "Buchungsbestätigung / Rechnung senden",
    "category": "Buchung",
    "lang": "de",
    "subject": "{{event}} – Buchungsbestätigung/Rechnung {{rechnung.nr}}",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nvielen Dank für Ihren Buchungsauftrag und das damit entgegengebrachte Vertrauen. Wir freuen uns sehr, Sie zu {{event}} als unsere geschätzten Reisegäste begrüssen zu dürfen.\n\nAnbei finden Sie unsere verbindliche Buchungsbestätigung/Rechnung in Form der angehängten PDF-Datei. Bitte geben Sie bei der Zahlung die Rechnungsnummer {{rechnung.nr}} an. Unter Angabe der IBAN-Nummer sowie des SWIFT/BIC-Codes fallen keine Gebühren an.\n\nFaltin Travel AG\nRiedthofstrasse 172\n8105 Regensdorf\nSchweiz\n\nIBAN: {{bank.iban}}\nSWIFT/BIC-Code: {{bank.bic}}\n\nZahlungszweck: {{rechnung.nr}}\nRechnungsbetrag: {{betrag}}\nZahlbar bis: {{zahlbar_bis}}\n\nAufgrund unserer Teilnahme am Garantiefonds der Schweizer Reisebranche sind die Kundengelder abgesichert. Die Reiseunterlagen gehen ca. {{unterlagen.versand_tage}} Tage vor Reiseantritt in den versicherten Versand. Ihre Tickets erhalten Sie ca. {{tickets.versand_tage}} Tage vor dem Event per E-Mail in elektronischer Form.\n\nKönnen wir sonst noch etwas für Sie tun? Da die Zufriedenheit unserer Kunden unser höchstes Ziel ist, stehen wir Ihnen selbstverständlich weiterhin jederzeit gerne persönlich zur Verfügung.",
    "description": "Kunde hat verbindlich gebucht. Anhänge: Rechnung, AGB (Faltin_Travel_AGB.pdf), Garantiefonds.pdf, ggf. Reisegutschein.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "zahlungseingang-bestaetigen",
    "kind": "vorlage",
    "title": "Zahlungseingang bestätigen",
    "category": "Finanzen",
    "lang": "de",
    "subject": "{{event}} – {{rechnung.nr}}",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\ngerne kommen wir auf Ihre gebuchte {{event}}-Reise zurück.\n\nWir freuen uns, Ihnen den Eingang Ihrer Zahlung bestätigen zu können, und bedanken uns herzlich.\n\nDie detaillierte Reiseinformation inklusive der Tickets erhalten Sie ca. {{tickets.versand_tage}} Tage vor Reisetermin in elektronischer Form von uns zugestellt.\n\nFür Rückfragen stehen wir Ihnen in der Zwischenzeit jederzeit gerne persönlich zur Verfügung.",
    "description": "Zahlung ist eingegangen (häufig als Antwort auf «Habe überwiesen»). Kurzvariante: nur Dank + Bestätigung + Service-Satz.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "zahlungserinnerung",
    "kind": "vorlage",
    "title": "Zahlungserinnerung (freundlich)",
    "category": "Finanzen",
    "lang": "de",
    "subject": "{{event}} – Rechnung {{rechnung.nr}}",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}}\n\nWir haben von unserer Buchhaltung die Information erhalten, dass die Rechnung {{rechnung.nr}} über {{betrag}} (zahlbar bis {{zahlbar_bis}}) noch offen zu sein scheint.\n\nKönnten Sie bitte kurz prüfen, ob die Zahlung bereits erfolgt ist? Falls sich Ihre Zahlung mit dieser Nachricht gekreuzt hat, betrachten Sie diese bitte als gegenstandslos.\n\nVielen Dank für Ihre Unterstützung.",
    "description": "Zahlungsfrist überschritten. Rechnung als PDF erneut anhängen. Ton bewusst neutral, keine Mahngebühr in der ersten Erinnerung.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "zahlungslink-senden",
    "kind": "vorlage",
    "title": "Zahlungslink (Kreditkarte) senden",
    "category": "Finanzen",
    "lang": "de",
    "subject": "AW: {{event}} – Zahlungslink",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nsehr gerne leiten wir Ihnen nachstehend einen Zahlungslink für Ihre gebuchte Reise weiter:\n\n{{zahlungslink}}\n\nDurch Verwendung des oben eingefügten «Bezahlen»-Links bestätigen Sie ausdrücklich, dass Sie bei Faltin Travel AG Produkte oder Dienstleistungen bestellt haben, und dass Sie das Angebot und die dieser E-Mail beigefügten Allgemeinen Geschäftsbedingungen erhalten, gelesen, verstanden und akzeptiert haben.\n\nFür Rückfragen stehen wir Ihnen gerne jederzeit persönlich zur Verfügung.",
    "description": "Kunde bittet um Kartenzahlung statt Überweisung. Anhänge: Rechnung, AGB, Garantiefonds.",
    "shortcut": "",
    "greeting": "Beste Grüsse"
  },
  {
    "id": "zahlung-ueberweisung-schweiz",
    "kind": "vorlage",
    "title": "Hinweis Überweisung in die Schweiz / andere Zahlart",
    "category": "Finanzen",
    "lang": "de",
    "subject": "AW: {{event}} – Zahlung {{rechnung.nr}}",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nherzlichen Dank für Ihre Mitteilung.\n\nFür Überweisungen in die Schweiz müssen mittlerweile sämtliche Angaben vollständig erfasst werden, einschliesslich der vollständigen Adresse des Empfängers. Bitte verwenden Sie die folgenden Angaben:\n\nFaltin Travel AG\nRiedthofstrasse 172\n8105 Regensdorf\nSchweiz\n\nIBAN: {{bank.iban}}\nSWIFT/BIC-Code: {{bank.bic}}\nZahlungszweck: {{rechnung.nr}}\n\nZu Ihrer Sicherheit finden Sie im Anhang zusätzlich unsere Kontobestätigung. Eine Zahlung per PayPal ist leider nicht möglich; gerne senden wir Ihnen alternativ einen Zahlungslink für die Kreditkartenzahlung.\n\nFür Rückfragen stehen wir Ihnen selbstverständlich jederzeit gerne persönlich zur Verfügung.",
    "description": "Bank meldet Fehler bei Empfängername/Namensprüfung oder Kunde fragt nach PayPal.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "namen-nachfordern",
    "kind": "vorlage",
    "title": "Fehlende Namen der Reisenden nachfordern",
    "category": "Buchung",
    "lang": "de",
    "subject": "{{event}} – {{buchung.nr}} – Namen der Reisenden",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\ngerne kommen wir auf Ihre gebuchte {{event}}-Reise zurück.\n\nDa wir die Namen bis {{frist}} ans Hotel bzw. an den Veranstalter mitteilen müssen, bitten wir Sie, uns die fehlenden Namen (Vor- und Nachname) bis {{frist}} zukommen zu lassen.\n\nBitte beachten Sie, dass wir bei einer späteren Namensänderung {{gebuehr}} pro Person in Rechnung stellen müssen.\n\nWir freuen uns auf Ihre Rückmeldung.",
    "description": "Gebucht mit Platzhalternamen; Hotel/Veranstalter braucht die Namen.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "namensaenderung",
    "kind": "vorlage",
    "title": "Namensänderung (Gebühr)",
    "category": "Buchung",
    "lang": "de",
    "subject": "AW: {{event}} – Namensänderung {{buchung.nr}}",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nvielen Dank für Ihre Nachricht.\n\nIhre Buchung wurde mit dem Absenden der Bestellung verbindlich, und die angegebenen Namen wurden unmittelbar beim Veranstalter hinterlegt. Für eine Namensänderung entsteht deshalb eine Gebühr von {{gebuehr}}, für die wir Ihnen eine separate Rechnung zukommen lassen.\n\nBitte lassen Sie uns wissen, ob wir die Änderung so für Sie vornehmen dürfen.\n\nWir freuen uns auf Ihre Rückmeldung.",
    "description": "Kunde will einen Mitreisenden austauschen. Nach Ausführung: kurze Bestätigung + angepasste Buchungsbestätigung im Anhang.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "zusatzleistung-anbieten",
    "kind": "vorlage",
    "title": "Zusatznächte / Upgrade anbieten",
    "category": "Buchung",
    "lang": "de",
    "subject": "AW: {{event}} – Zusatznächte {{buchung.nr}}",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}}\n\nHerzlichen Dank für Ihre Nachricht.\n\nDie gewünschten Zusatzleistungen können wir Ihnen wie folgt anbieten:\n\n{{hotel}}\n{{anzahl_naechte}} Zusatznächte von {{reise.anreise}} – {{reise.abreise}}\n\nPreis pro Person im Doppelzimmer: {{preis_pp}}\n\nBitte lassen Sie uns wissen, ob wir so für Sie buchen dürfen.\n\nWir freuen uns auf Ihre Rückmeldung.",
    "description": "Bestehende Buchung soll verlängert oder um Upgrade/Hospitality ergänzt werden.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "zusatzleistung-bestaetigen",
    "kind": "vorlage",
    "title": "Zusatzbuchung bestätigen",
    "category": "Buchung",
    "lang": "de",
    "subject": "AW: {{event}} – Bestätigung Zusatzbuchung {{buchung.nr}}",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}}\n\nHerzlichen Dank für Ihre Buchung der Zusatzleistungen.\n\n{{hinweis}}\n\nGerne senden wir Ihnen im Anhang die Buchungsbestätigung/Rechnung {{rechnung.nr}} zu. Ihre bestehende Buchung {{buchung.nr}} bleibt im Übrigen unverändert.\n\nFür Rückfragen stehen wir Ihnen jederzeit gerne persönlich zur Verfügung.",
    "description": "Kunde hat Zusatznächte/Upgrade angenommen.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "reiseinformation-vorab",
    "kind": "vorlage",
    "title": "Reiseinformation vorab senden",
    "category": "Service",
    "lang": "de",
    "subject": "{{event}} – Ihre Reiseinformation",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nheute freuen wir uns, Ihnen die detaillierte Reiseinformation für Ihre gebuchte {{event}}-Reise zu übermitteln, aus der Sie alle relevanten Details zu Ihrem Reiseablauf entnehmen können. Zusätzlich finden Sie im Anhang {{anhaenge_beschreibung}}.\n\nDie Tickets erhalten Sie ca. {{tickets.versand_tage}} Tage vor dem Event in elektronischer Form.\n\nFür Rückfragen stehen wir Ihnen selbstverständlich jederzeit gerne persönlich zur Verfügung.",
    "description": "Einige Wochen/Tage vor Abreise, wenn Reiseinfo fertig ist, die Tickets aber noch nicht.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "tickets-reiseunterlagen-versand",
    "kind": "vorlage",
    "title": "Tickets und Reiseunterlagen versenden",
    "category": "Service",
    "lang": "de",
    "subject": "{{event}} – Ihre Tickets und Reiseunterlagen",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nes freut uns, Ihnen heute die detaillierten Reiseunterlagen, einen Situationsplan sowie Ihre Tickets als PDF-Anhänge zustellen zu dürfen. Die Tickets können entweder ausgedruckt oder bequem auf Ihrem Smartphone vorgewiesen werden.\n\nWir wünschen Ihnen eine angenehme Anreise, einen erlebnisreichen Aufenthalt in {{ort}} sowie viele unvergessliche Momente bei {{event}}.\n\nFür Rückfragen stehen wir Ihnen selbstverständlich jederzeit gerne persönlich zur Verfügung.",
    "description": "Ca. 5–14 Tage vor dem Event, sobald die Tickets freigegeben sind. Gruppen: Namen vorher beim Hotel hinterlegen und im ersten Satz erwähnen.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "verfuegbarkeit-ohne-gewaehr",
    "kind": "vorlage",
    "title": "Verfügbarkeit knapp / ausgebucht – Alternative",
    "category": "Verkauf",
    "lang": "de",
    "subject": "AW: {{event}}",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nherzlichen Dank für Ihre Nachricht.\n\nAufgrund der ausserordentlich hohen Nachfrage verfügen wir für {{auswahl}} leider über kein Kontingent mehr. Gerne können wir Ihnen jedoch folgende Alternative anbieten:\n\n{{alternative}}\n\nGrundsätzlich bestehen bei einer sehr schnellen Buchung gute Chancen, jedoch ohne Gewähr. Wir empfehlen Ihnen daher, sämtliche relevanten Angaben, insbesondere die Namen aller Reisenden, bereitzuhalten, damit die Buchung – falls Verfügbarkeit vorhanden ist – ohne Verzögerung abgeschlossen werden kann.\n\nIch hoffe, Ihnen mit diesen Informationen gedient zu haben.\n\nFür Rückfragen stehen wir Ihnen gerne jederzeit persönlich zur Verfügung.",
    "description": "Gewünschtes Hotel/Session ausgebucht oder sehr knapp; immer mit Alternative.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "angebot-noch-nicht-verfuegbar",
    "kind": "vorlage",
    "title": "Angebot noch nicht publiziert – Vormerkung",
    "category": "Verkauf",
    "lang": "de",
    "subject": "AW: {{event}}",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}},\n\nvielen Dank für Ihre freundliche Anfrage zu {{event}}.\n\nVoraussichtlich werden wir unser Angebot {{zeitpunkt}} auf den Markt bringen. Damit wir Ihnen dieses automatisch zukommen lassen können, bitten wir Sie, über unsere Homepage ein unverbindliches Angebot anzufragen, damit wir Ihre E-Mail-Adresse hinterlegen können:\n\n{{event.url}}\n\nNachdem gewisse Termine erfahrungsgemäss sehr schnell ausgebucht sind, empfehlen wir nach Erhalt unseres Angebotes eine möglichst zeitnahe Buchung.\n\nFür weitere Fragen stehen wir Ihnen jederzeit gerne persönlich zur Verfügung.",
    "description": "Event noch nicht buchbar (z. B. Darts-WM vor Verkaufsstart). Bei Verzögerung: «Bei der Publizierung unseres Angebots kommt es leider zu einer Verzögerung …».",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "feedback-nach-reise",
    "kind": "vorlage",
    "title": "Ihre Meinung ist uns wichtig (nach der Reise)",
    "category": "Service",
    "lang": "de",
    "subject": "Ihre Meinung ist uns wichtig",
    "body": "Sehr geehrte{{kunde.anrede_endung}} {{kunde.anrede}} {{kunde.nachname}},\n\nwir hoffen, Sie sind mit vielen schönen Eindrücken aus {{ort}} zurückgekehrt und werden {{event}} in bester Erinnerung behalten.\n\nIhre Meinung ist uns wichtig: Wir würden uns sehr freuen, wenn Sie uns kurz mitteilen, wie Ihnen die Reise gefallen hat und was wir für Sie noch besser machen können.\n\nGerne informieren wir Sie auch frühzeitig über die nächste Ausgabe von {{event}} oder andere Events, die Sie interessieren.\n\nFür Rückfragen stehen wir Ihnen selbstverständlich jederzeit gerne persönlich zur Verfügung.",
    "description": "Wenige Tage nach Rückkehr; führt oft direkt zur nächsten Anfrage.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "danke-fuer-feedback",
    "kind": "vorlage",
    "title": "Antwort auf positives Feedback",
    "category": "Service",
    "lang": "de",
    "subject": "AW: Ihre Meinung ist uns wichtig",
    "body": "Liebe{{kunde.anrede_endung}} {{kunde.anrede}} {{kunde.nachname}}\n\nHerzlichen Dank für Ihre freundliche Nachricht. Es freut uns sehr zu lesen, dass Ihnen die Reise nach {{ort}} so gut gefallen hat.\n\n{{naechster_schritt}}\n\nWir würden uns sehr freuen, Sie schon bald wieder als unsere geschätzten Reisegäste begrüssen zu dürfen.",
    "description": "Kunde bedankt sich nach dem Event; ideal mit Angebot für das Folgejahr.",
    "shortcut": "",
    "greeting": "Herzliche Grüsse"
  },
  {
    "id": "schlussabrechnung",
    "kind": "vorlage",
    "title": "Schlussabrechnung (Firmen-/Incentive-Reise)",
    "category": "Finanzen",
    "lang": "de",
    "subject": "{{event}} Endabrechnung",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}}\n\nGerne lassen wir Ihnen im Anhang die Schlussabrechnung für {{event}} zukommen.\n\nFür Rückfragen stehen wir Ihnen selbstverständlich jederzeit gerne persönlich zur Verfügung.",
    "description": "Nach Incentive/Gruppenreise mit Nachkalkulation.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "rechnung-korrigiert",
    "kind": "vorlage",
    "title": "Angepasste Rechnung senden",
    "category": "Finanzen",
    "lang": "de",
    "subject": "AW: {{event}} – angepasste Rechnung {{rechnung.nr}}",
    "body": "Guten Tag {{kunde.anrede}} {{kunde.nachname}}\n\nHerzlichen Dank für Ihre Rückmeldung.\n\nGerne leiten wir Ihnen im Anhang die angepasste Rechnung weiter – bitte entschuldigen Sie.\n\nFür Rückfragen stehen wir Ihnen jederzeit gerne persönlich zur Verfügung.",
    "description": "Rechnungsadresse/Firma/Namen korrigiert.",
    "shortcut": "",
    "greeting": "Freundliche Grüsse"
  },
  {
    "id": "leistungstraeger-buchung",
    "kind": "vorlage",
    "title": "Buchung bei Partneragentur / DMC (Du)",
    "category": "Lieferanten",
    "lang": "de",
    "subject": "{{event}} – Buchung Ref. {{buchung.nr}}",
    "body": "Liebe{{lieferant.anrede_endung}} {{lieferant.vorname}},\n\nich bitte um Buchung wie folgt:\n\n{{anzahl_naechte}}x Übernachtung/Frühstück im {{hotel}}\nUnterbringung im {{zimmer}} von {{reise.anreise}} – {{reise.abreise}}\n\n{{leistungen}}\n\nNamen:\n{{reisende}}\n\nUnsere Ref.: {{buchung.nr}}\n\nIch freue mich auf eure Bestätigung.",
    "description": "Leistung bei Partneragentur/DMC/Hotel buchen, wenn man sich kennt. Namen in Grossbuchstaben NACHNAME Vorname.",
    "shortcut": "",
    "greeting": "Viele Grüsse aus der Schweiz"
  },
  {
    "id": "leistungstraeger-rueckfrage",
    "kind": "vorlage",
    "title": "Rückfrage an Leistungsträger (Du)",
    "category": "Lieferanten",
    "lang": "de",
    "subject": "AW: {{referenz}}",
    "body": "Hallo {{lieferant.vorname}},\n\n{{anliegen}}\n\nHerzlichen Dank!",
    "description": "Kurze operative Abstimmung mit bekannten Partnern (Namen hinterlegen, Status nachfragen). Einzige Stelle, an der «Herzlichen Dank!» mit Ausrufezeichen vorkommt.",
    "shortcut": "",
    "greeting": "Liebe Grüsse"
  },
  {
    "id": "b2b-angebot-wiederverkaeufer",
    "kind": "vorlage",
    "title": "Kurzangebot an Agentur / Wiederverkäufer (Du)",
    "category": "Verkauf",
    "lang": "de",
    "subject": "AW: {{anzahl_personen}} × {{event}}",
    "body": "Hi {{kunde.vorname}}\n\nWir können tatsächlich noch {{anzahl_personen}}x {{kategorie}} anbieten.\n{{reise.zeitraum}}\n{{leistungen}}\n\nPreis pro Ticket: {{preis_pp}}\n{{ticket_hinweis}}\n\nFür Rückfragen stehe ich dir gerne jederzeit persönlich zur Verfügung.",
    "description": "Stefan an befreundete Sportreise-Agenturen/Reisebüros; knapp, Du-Form, Preis klar.",
    "shortcut": "",
    "greeting": "Beste Grüsse aus der Schweiz"
  },
  {
    "id": "intern-notiz",
    "kind": "vorlage",
    "title": "Interne Notiz an Kollegen",
    "category": "Intern",
    "lang": "de",
    "subject": "{{thema}}",
    "body": "Hi {{empfaenger.vorname}},\n\n{{inhalt}}",
    "description": "Natalie ↔ Stefan (Stornobedingungen prüfen, offene Rechnung, Rückfrage). Ohne Signatur.",
    "shortcut": "",
    "greeting": "Liebe Grüsse"
  },
  {
    "id": "intern-weiterleitung",
    "kind": "vorlage",
    "title": "Interne Weiterleitung zur Bearbeitung",
    "category": "Intern",
    "lang": "de",
    "subject": "WG: {{betreff_original}}",
    "body": "{{empfaenger.vorname}}, kannst du das bitte übernehmen? {{kurzinfo}}",
    "description": "Anfrage/Antwort aus request@ oder kontakt@ an zuständige Person weiterleiten. Heute meist ganz ohne Text – ein Satz Kontext ist besser.",
    "shortcut": "",
    "greeting": "Danke und liebe Grüsse"
  },
  {
    "id": "offer-en",
    "kind": "vorlage",
    "title": "Offer to agency / client (EN)",
    "category": "Verkauf",
    "lang": "en",
    "subject": "RE: {{event}}",
    "body": "Dear {{kunde.vorname}},\n\nThank you very much for your kind enquiry regarding {{event}}.\n\nWe are pleased to provide you with details of our packages:\n\n{{event}}\n{{anzahl_naechte}} nights accommodation including breakfast\nAccommodation in a double room from {{reise.anreise}} to {{reise.abreise}}\n\n{{leistungen}}\n\nPrice per person in a double room: from {{preis_pp}}\n\nPlease note that availability is limited.{{#b2b}} These rates are net rates and you should add your desired commission accordingly.{{/b2b}}\n\nShould you require any further information, please do not hesitate to contact us. We would be delighted to assist you.",
    "description": "Englischsprachige Anfrage von Agentur oder Endkunde; bei Agenturen Netto-Hinweis aktivieren.",
    "shortcut": "",
    "greeting": "Kind regards,"
  },
  {
    "id": "booking-confirmation-en",
    "kind": "vorlage",
    "title": "Booking confirmation / invoice (EN)",
    "category": "Buchung",
    "lang": "en",
    "subject": "{{event}} – Booking confirmation / invoice {{rechnung.nr}}",
    "body": "Dear {{kunde.anrede_en}} {{kunde.nachname}},\n\nThank you for your booking and the trust you have placed in us. We are delighted to welcome you as our valued guests at {{event}}.\n\nPlease find attached our binding booking confirmation / invoice. When making your payment, please quote invoice number {{rechnung.nr}}.\n\nFaltin Travel AG\nRiedthofstrasse 172\n8105 Regensdorf\nSwitzerland\n\nIBAN: {{bank.iban}}\nSWIFT/BIC: {{bank.bic}}\nPayment reference: {{rechnung.nr}}\nAmount: {{betrag}}\nDue date: {{zahlbar_bis}}\n\nAs a member of the guarantee fund of the Swiss travel industry, all customer payments are protected. Your tickets will be sent to you electronically approximately {{tickets.versand_tage}} days before the event.\n\nIf you have any questions, please feel free to contact us at any time.",
    "description": "Verbindliche Buchung eines englischsprachigen Kunden/Partners.",
    "shortcut": "",
    "greeting": "Kind regards,"
  },
  {
    "id": "payment-received-en",
    "kind": "vorlage",
    "title": "Payment received (EN)",
    "category": "Finanzen",
    "lang": "en",
    "subject": "{{event}} – {{rechnung.nr}}",
    "body": "Dear {{kunde.anrede_en}} {{kunde.nachname}},\n\nThank you for your message. We are pleased to confirm that we have received your payment – many thanks.\n\nYour detailed travel information, including your tickets, will be sent to you electronically approximately {{tickets.versand_tage}} days before the event.\n\nIf you have any questions in the meantime, please feel free to contact us at any time.",
    "description": "Zahlungseingang bei englischsprachigen Kunden.",
    "shortcut": "",
    "greeting": "Kind regards,"
  },
  {
    "id": "tickets-en",
    "kind": "vorlage",
    "title": "Tickets and travel documents (EN)",
    "category": "Service",
    "lang": "en",
    "subject": "{{event}} – Your tickets and travel documents",
    "body": "Dear {{kunde.vorname}},\n\nWe are pleased to send you your detailed travel documents, a site map and your tickets as PDF attachments. The tickets can either be printed or simply shown on your smartphone.\n\nWe wish you a pleasant journey, an eventful stay in {{ort}} and many unforgettable moments at {{event}}.\n\nPlease feel free to contact me if you have any questions.",
    "description": "Ticketversand an englischsprachige Kunden (z. B. Firmengruppen).",
    "shortcut": "",
    "greeting": "Best regards,"
  },
  {
    "id": "hotel-group-request-en",
    "kind": "vorlage",
    "title": "Group rate request to hotel (EN)",
    "category": "Lieferanten",
    "lang": "en",
    "subject": "Group request {{reise.anreise}} – {{reise.abreise}}",
    "body": "Dear Sir or Madam,\n\nWe would like to enquire about room availability and rates at your hotel for {{anfrage_beschreibung}}.\n\n{{anzahl_personen}} guests\n{{anzahl_zimmer}} rooms\nArrival: {{reise.anreise}}\nDeparture: {{reise.abreise}}\nStay: {{anzahl_naechte}} nights\nRoom category: {{zimmer}}\nBoard basis: {{verpflegung}}\n\nPlease note that we are a tour operator and our client expects us to provide attractive rates. Our IATA number is {{firma.iata}}.\n\nWe would appreciate your response at your earliest convenience and look forward to the possibility of working with you.\n\nPlease do not hesitate to contact me if you require any further information.",
    "description": "Gruppen-/Incentive-Anfrage an ein neues Hotel.",
    "shortcut": "",
    "greeting": "Kind regards from Switzerland,"
  },
  {
    "id": "supplier-ticket-chase-en",
    "kind": "vorlage",
    "title": "Chase tickets / transfer with supplier (EN)",
    "category": "Lieferanten",
    "lang": "en",
    "subject": "RE: {{event}} – order {{referenz}}",
    "body": "Hi {{lieferant.vorname}},\n\nCould you please let me know when the tickets for order {{referenz}} will be available for transfer? I now have all the ticket holder names and would like to send the tickets to our clients as soon as possible.\n\nI look forward to your reply.",
    "description": "Tickets/Pässe beim Veranstalter oder Hospitality-Partner nachfordern.",
    "shortcut": "",
    "greeting": "Best regards,"
  },
  {
    "id": "corporate-first-response-en",
    "kind": "vorlage",
    "title": "First response to corporate / incentive enquiry (EN)",
    "category": "Verkauf",
    "lang": "en",
    "subject": "RE: {{event}}",
    "body": "Dear {{kunde.vorname}},\n\nThank you for your enquiry and for sharing such a detailed brief. I also appreciate the trust you have placed in us.\n\nWe would be delighted to support you with the planning and delivery of {{event}}. The information you have shared provides an excellent starting point for developing a programme that fits your group and budget.\n\nWould you be available for a call in the coming days to discuss the details and next steps? Please feel free to send me a few times that would suit you.\n\nI look forward to speaking with you.",
    "description": "Firmenkunde/Incentive mit ausführlichem Briefing; Ziel ist ein Telefontermin.",
    "shortcut": "",
    "greeting": "Kind regards,"
  },
  {
    "id": "onsite-contact-en",
    "kind": "vorlage",
    "title": "On-site contact and admission info (EN)",
    "category": "Service",
    "lang": "en",
    "subject": "{{event}} – Stadium admission for your group",
    "body": "Dear {{kunde.anrede_en}} {{kunde.nachname}},\n\n{{hinweis_einlass}}\n\nMy colleague {{kontakt.vorort.name}} will also be at the venue and can assist you if any issues arise. You can reach him/her on:\n\n{{kontakt.vorort.name}} (Faltin Travel)\n{{kontakt.vorort.telefon}}\n\nPlease feel free to contact me if you have any questions.",
    "description": "Kurz vor dem Event: Einlass, Treffpunkt, Ansprechperson vor Ort.",
    "shortcut": "",
    "greeting": "Best regards,"
  },
  {
    "id": "bs-einstieg-dank-nachricht",
    "kind": "baustein",
    "title": "Dank für die Nachricht",
    "category": "Einstieg",
    "lang": "de",
    "subject": "",
    "body": "Herzlichen Dank für Ihre Nachricht.",
    "description": "",
    "shortcut": "einstieg-dank-nachri",
    "greeting": ""
  },
  {
    "id": "bs-einstieg-telefonat",
    "kind": "baustein",
    "title": "Bezug auf Telefonat",
    "category": "Einstieg",
    "lang": "de",
    "subject": "",
    "body": "Vielen Dank für das freundliche Telefongespräch und Ihr Interesse an unseren {{event}} Arrangements.",
    "description": "",
    "shortcut": "einstieg-telefonat",
    "greeting": ""
  },
  {
    "id": "bs-einstieg-gebuchte-reise",
    "kind": "baustein",
    "title": "Bezug auf gebuchte Reise",
    "category": "Einstieg",
    "lang": "de",
    "subject": "",
    "body": "Gerne kommen wir auf Ihre gebuchte {{event}}-Reise zurück.",
    "description": "",
    "shortcut": "einstieg-gebuchte-re",
    "greeting": ""
  },
  {
    "id": "bs-dank-buchungsauftrag",
    "kind": "baustein",
    "title": "Dank für Buchungsauftrag",
    "category": "Buchung",
    "lang": "de",
    "subject": "",
    "body": "Vielen Dank für Ihren Buchungsauftrag und das damit entgegengebrachte Vertrauen. Wir freuen uns sehr, Sie zu {{event}} als unsere geschätzten Reisegäste begrüssen zu dürfen.",
    "description": "",
    "shortcut": "dank-buchungsauftrag",
    "greeting": ""
  },
  {
    "id": "bs-zahlungseingang",
    "kind": "baustein",
    "title": "Zahlungseingang",
    "category": "Finanzen",
    "lang": "de",
    "subject": "",
    "body": "Wir freuen uns, Ihnen den Eingang Ihrer Zahlung bestätigen zu können. Vielen Dank.",
    "description": "",
    "shortcut": "zahlungseingang",
    "greeting": ""
  },
  {
    "id": "bs-bankverbindung",
    "kind": "baustein",
    "title": "Bankverbindung und Zahlungszweck",
    "category": "Finanzen",
    "lang": "de",
    "subject": "",
    "body": "Bitte geben Sie bei der Zahlung die Rechnungsnummer {{rechnung.nr}} an. Unter Angabe der IBAN-Nummer sowie des SWIFT/BIC-Codes fallen keine Gebühren an.\n\nFaltin Travel AG\nRiedthofstrasse 172\n8105 Regensdorf\nSchweiz\n\nIBAN: {{bank.iban}}\nSWIFT/BIC-Code: {{bank.bic}}\n\nZahlungszweck: {{rechnung.nr}}\nRechnungsbetrag: {{betrag}}",
    "description": "",
    "shortcut": "bankverbindung",
    "greeting": ""
  },
  {
    "id": "bs-qr-code-zahlung",
    "kind": "baustein",
    "title": "Zahlung per QR-Rechnung",
    "category": "Finanzen",
    "lang": "de",
    "subject": "",
    "body": "Am einfachsten zahlen Sie mit dem QR-Code auf der Rechnung; sonst bitte als Referenz {{rechnung.nr}} angeben. Zahlbar bis {{zahlbar_bis}}.",
    "description": "",
    "shortcut": "qr-code-zahlung",
    "greeting": ""
  },
  {
    "id": "bs-garantiefonds",
    "kind": "baustein",
    "title": "Garantiefonds / Kundengelder abgesichert",
    "category": "Vertrauen",
    "lang": "de",
    "subject": "",
    "body": "Aufgrund unserer Teilnahme am Garantiefonds der Schweizer Reisebranche sind die Kundengelder abgesichert.",
    "description": "",
    "shortcut": "garantiefonds",
    "greeting": ""
  },
  {
    "id": "bs-vertrauen-spezialist",
    "kind": "baustein",
    "title": "Seriosität / Warnung vor dubiosen Händlern",
    "category": "Vertrauen",
    "lang": "de",
    "subject": "",
    "body": "Es tummeln sich zahlreiche dubiose, nicht autorisierte Händler und Agenturen im Internet, welche Tickets anbieten, diese letztendlich jedoch oftmals nicht liefern können oder gar mit Falschkarten handeln. Bitte seien Sie vorsichtig. Als mehrfach ausgezeichneter Sportreisen-Spezialist, Mitglied im Schweizer Reise-Verband (SRV) und Teilnehmer am Garantiefonds der Schweizer Reisebranche stehen wir für absolute Seriosität, Sicherheit und Zuverlässigkeit.",
    "description": "",
    "shortcut": "vertrauen-spezialist",
    "greeting": ""
  },
  {
    "id": "bs-authorised-distributor",
    "kind": "baustein",
    "title": "Offizieller Distributor",
    "category": "Vertrauen",
    "lang": "de",
    "subject": "",
    "body": "Als Authorised Distributor bieten wir ausschliesslich offiziell autorisierte Reisepakete mit originalen Tickets und transparent definiertem Leistungsumfang an.",
    "description": "",
    "shortcut": "authorised-distribut",
    "greeting": ""
  },
  {
    "id": "bs-angebot-freibleibend",
    "kind": "baustein",
    "title": "Angebot freibleibend",
    "category": "Verkauf",
    "lang": "de",
    "subject": "",
    "body": "Angebot freibleibend, vorbehaltlich der Verfügbarkeit bis zum Zeitpunkt der Buchung/Bestätigung.",
    "description": "",
    "shortcut": "angebot-freibleibend",
    "greeting": ""
  },
  {
    "id": "bs-eigene-anreise",
    "kind": "baustein",
    "title": "Eigene Anreise",
    "category": "Verkauf",
    "lang": "de",
    "subject": "",
    "body": "Unsere Packages verstehen sich mit eigener Anreise. Gerne unterbreiten wir Ihnen auf Wunsch ein Angebot für Flüge, Zusatznächte oder Upgrades.",
    "description": "",
    "shortcut": "eigene-anreise",
    "greeting": ""
  },
  {
    "id": "bs-zeitnah-buchen",
    "kind": "baustein",
    "title": "Sanfte Dringlichkeit",
    "category": "Verkauf",
    "lang": "de",
    "subject": "",
    "body": "Bei Gefallen empfehlen wir eine möglichst zeitnahe Buchung, da unser Kontingent sehr gefragt und dementsprechend schnell ausverkauft ist.",
    "description": "",
    "shortcut": "zeitnah-buchen",
    "greeting": ""
  },
  {
    "id": "bs-first-come",
    "kind": "baustein",
    "title": "First come, first served",
    "category": "Verkauf",
    "lang": "de",
    "subject": "",
    "body": "Aufgrund der aussergewöhnlich hohen Nachfrage bearbeiten wir sämtliche Buchungseingänge nach dem First-come-first-serve-Prinzip.",
    "description": "",
    "shortcut": "first-come",
    "greeting": ""
  },
  {
    "id": "bs-angaben-buchung",
    "kind": "baustein",
    "title": "Benötigte Angaben für die Buchung",
    "category": "Buchung",
    "lang": "de",
    "subject": "",
    "body": "Für Ihre verbindliche Buchung benötigen wir:\n– einen kurzen schriftlichen Buchungsauftrag\n– Name des Reiseanmelders inkl. vollständiger Adresse und Telefonnummer\n– Namen aller mitreisenden Personen\n– Unterbringungswunsch (Hotel / Zimmerart)",
    "description": "",
    "shortcut": "angaben-buchung",
    "greeting": ""
  },
  {
    "id": "bs-angaben-geburtsdaten",
    "kind": "baustein",
    "title": "Zusatzangaben Reisende (personalisierte Tickets)",
    "category": "Buchung",
    "lang": "de",
    "subject": "",
    "body": "Da die Eintrittskarten personalisiert ausgestellt werden, benötigen wir zusätzlich Geburtsdatum, Geburtsort und Nationalität aller Reisenden.",
    "description": "",
    "shortcut": "angaben-geburtsdaten",
    "greeting": ""
  },
  {
    "id": "bs-namensaenderung-gebuehr",
    "kind": "baustein",
    "title": "Gebühr Namensänderung",
    "category": "Buchung",
    "lang": "de",
    "subject": "",
    "body": "Bitte beachten Sie, dass wir bei einer Namensänderung {{gebuehr}} pro Person in Rechnung stellen müssen.",
    "description": "",
    "shortcut": "namensaenderung-gebu",
    "greeting": ""
  },
  {
    "id": "bs-ticketversand",
    "kind": "baustein",
    "title": "Zeitpunkt Ticketversand",
    "category": "Service",
    "lang": "de",
    "subject": "",
    "body": "Die Eintrittstickets werden Ihnen ca. {{tickets.versand_tage}} Tage vor der Veranstaltung in elektronischer Form per E-Mail zugestellt.",
    "description": "",
    "shortcut": "ticketversand",
    "greeting": ""
  },
  {
    "id": "bs-unterlagenversand",
    "kind": "baustein",
    "title": "Zeitpunkt Reiseunterlagen",
    "category": "Service",
    "lang": "de",
    "subject": "",
    "body": "Die Reiseunterlagen gehen ca. {{unterlagen.versand_tage}} Tage vor Reiseantritt in den versicherten Versand.",
    "description": "",
    "shortcut": "unterlagenversand",
    "greeting": ""
  },
  {
    "id": "bs-tickets-smartphone",
    "kind": "baustein",
    "title": "Tickets ausdrucken oder Smartphone",
    "category": "Service",
    "lang": "de",
    "subject": "",
    "body": "Die Tickets können entweder ausgedruckt oder bequem auf Ihrem Smartphone vorgewiesen werden.",
    "description": "",
    "shortcut": "tickets-smartphone",
    "greeting": ""
  },
  {
    "id": "bs-einreise-uk-eta",
    "kind": "baustein",
    "title": "Einreise Grossbritannien (ETA)",
    "category": "Service",
    "lang": "de",
    "subject": "",
    "body": "Reisende aus Deutschland, Österreich, allen EU-Staaten sowie der Schweiz benötigen für die Einreise nach Grossbritannien neben einem Reisepass, der für die gesamte Aufenthaltsdauer gültig ist, eine elektronische Reisegenehmigung (ETA). Diese gibt es offiziell in der App «UK ETA» oder unter gov.uk/eta – bitte spätestens drei Werktage vor der Abreise beantragen.",
    "description": "",
    "shortcut": "einreise-uk-eta",
    "greeting": ""
  },
  {
    "id": "bs-einreise-usa-esta",
    "kind": "baustein",
    "title": "Einreise USA (ESTA)",
    "category": "Service",
    "lang": "de",
    "subject": "",
    "body": "Für die Einreise in die USA benötigen Sie einen gültigen Reisepass sowie eine genehmigte ESTA-Reisegenehmigung. Bitte beantragen Sie diese frühzeitig ausschliesslich über die offizielle Seite esta.cbp.dhs.gov.",
    "description": "",
    "shortcut": "einreise-usa-esta",
    "greeting": ""
  },
  {
    "id": "bs-agb-hinweis",
    "kind": "baustein",
    "title": "AGB und Garantiefonds im Anhang",
    "category": "Rechtliches",
    "lang": "de",
    "subject": "",
    "body": "Im Anhang finden Sie zudem unsere Allgemeinen Geschäftsbedingungen sowie die Bestätigung des Garantiefonds der Schweizer Reisebranche. Es gelten die Teilnahmebedingungen des jeweiligen Veranstalters.",
    "description": "",
    "shortcut": "agb-hinweis",
    "greeting": ""
  },
  {
    "id": "bs-gutschein",
    "kind": "baustein",
    "title": "Reisegutschein zum Verschenken",
    "category": "Verkauf",
    "lang": "de",
    "subject": "",
    "body": "Auf Wunsch können wir Ihnen einen Gutschein zusenden, falls Sie gerne etwas zum Verschenken hätten.",
    "description": "",
    "shortcut": "gutschein",
    "greeting": ""
  },
  {
    "id": "bs-schluss-rueckfragen",
    "kind": "baustein",
    "title": "Schlusssatz Rückfragen",
    "category": "Schluss",
    "lang": "de",
    "subject": "",
    "body": "Für Rückfragen stehen wir Ihnen selbstverständlich jederzeit gerne persönlich zur Verfügung.",
    "description": "",
    "shortcut": "schluss-rueckfragen",
    "greeting": ""
  },
  {
    "id": "bs-schluss-zufriedenheit",
    "kind": "baustein",
    "title": "Schlusssatz nach Buchung",
    "category": "Schluss",
    "lang": "de",
    "subject": "",
    "body": "Können wir sonst noch etwas für Sie tun? Da die Zufriedenheit unserer Kunden unser höchstes Ziel ist, stehen wir Ihnen selbstverständlich weiterhin jederzeit gerne persönlich zur Verfügung.",
    "description": "",
    "shortcut": "schluss-zufriedenhei",
    "greeting": ""
  },
  {
    "id": "bs-schluss-vorfreude",
    "kind": "baustein",
    "title": "Vorfreude auf die Gäste",
    "category": "Schluss",
    "lang": "de",
    "subject": "",
    "body": "Wir hoffen, dass Ihnen unser Angebot gefällt, und würden uns sehr freuen, Sie als unsere geschätzten Reisegäste zu {{event}} begrüssen zu dürfen.",
    "description": "",
    "shortcut": "schluss-vorfreude",
    "greeting": ""
  },
  {
    "id": "bs-entschuldigung",
    "kind": "baustein",
    "title": "Kurze Entschuldigung",
    "category": "Service",
    "lang": "de",
    "subject": "",
    "body": "Bitte entschuldigen Sie, dass wir uns erst heute bei Ihnen melden.",
    "description": "",
    "shortcut": "entschuldigung",
    "greeting": ""
  },
  {
    "id": "bs-en-closing",
    "kind": "baustein",
    "title": "EN Schlusssatz + Gruss",
    "category": "Schluss",
    "lang": "en",
    "subject": "",
    "body": "Should you require any further information, please do not hesitate to contact us. We would be delighted to assist you.",
    "description": "",
    "shortcut": "en-closing",
    "greeting": "Kind regards from Switzerland,"
  },
  {
    "id": "bs-en-net-rates",
    "kind": "baustein",
    "title": "EN Netto-Preise für Agenturen",
    "category": "Verkauf",
    "lang": "en",
    "subject": "",
    "body": "Please note that these rates are net rates and you should add your desired commission accordingly. Prices are final – there will be no additional costs.",
    "description": "",
    "shortcut": "en-net-rates",
    "greeting": ""
  }
];

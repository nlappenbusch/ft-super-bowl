import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTicketTable, parseHolderName, eventDefaults, resolveTicket, groupForMail, seatRange,
  checkMailGroup, renderTicketMail, mailImages, mailSubject, longDate, cityOf, passFileName, normBranding,
  type EventTicket,
} from '../src/lib/eventTicketModel.ts';

const A = (id: number) => `https://nfl.tmtickets.de/wallet/match/?id=${id}&hash=abc${id}&type=0`;
const G = (id: number) => `https://nfl.tmtickets.de/wallet/match/?id=${id}&hash=abc${id}&type=1`;

// So kommt die Lieferantenliste aus Outlook als Text: eine Zelle pro Zeile.
const OUTLOOK = [
  'Kunde', 'Apple', '[Add to apple wallet]', 'Android', 'Area', 'Row', 'Seat', 'E-Mail Adresse',
  'Mr. WEEGE, Fredrik', A(1), G(1), '231', '13', '14', 'angela@mitickets.com<mailto:angela@mitickets.com>',
  'Mr. WEEGE, Fredrik', A(2), G(2), '231', '13', '13', 'angela@mitickets.com<mailto:angela@mitickets.com>',
  'M. Faltin, Stefan', A(3), G(3), '231', '13', '6', 'stefan@faltin.ch<mailto:stefan@faltin.ch>',
].join('\n');

test('Import: Outlook-Text, eine Zelle pro Zeile', () => {
  const rows = parseTicketTable(OUTLOOK);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    holder_raw: 'Mr. WEEGE, Fredrik', apple_url: A(1), android_url: G(1),
    area: '231', row_no: '13', seat: '14', recipient_email: 'angela@mitickets.com',
  });
  assert.equal(rows[2].holder_raw, 'M. Faltin, Stefan');
  assert.equal(rows[2].recipient_email, 'stefan@faltin.ch');
});

test('Import: Tabelle mit Tabs, Android-Link zuerst', () => {
  const rows = parseTicketTable(`Kunde\tApple\tAndroid\tArea\tRow\tSeat\nMs. MUSTER, Anna\t${G(9)}\t${A(9)}\t101\t2\t5`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].apple_url, A(9));
  assert.equal(rows[0].android_url, G(9));
  assert.equal(rows[0].seat, '5');
  assert.equal(rows[0].recipient_email, '');
});

test('Namen: Anrede, Reihenfolge, Grossschrift', () => {
  assert.deepEqual(parseHolderName('Mr. WEEGE, Fredrik'), { salutation: 'Herr', first: 'Fredrik', last: 'Weege' });
  assert.deepEqual(parseHolderName('M. Faltin, Stefan'), { salutation: 'Herr', first: 'Stefan', last: 'Faltin' });
  assert.deepEqual(parseHolderName('Frau Anna Muster-Meier'), { salutation: 'Frau', first: 'Anna', last: 'Muster-Meier' });
  assert.deepEqual(parseHolderName('Lena McDonald'), { salutation: '', first: 'Lena', last: 'McDonald' });
});

const ev = {
  id: 'nfl', name: 'NFL München Game Tickets & Reisen', venue: 'Allianz Arena', location_city: 'München',
  spielplan: [{ date: 'So. 15.11.2026', session: '15:30 Uhr', matchup: 'New England Patriots vs. Detroit Lions', round: '' }],
};

test('Event-Vorgaben: Name ohne «Tickets», Spielplan liefert Paarung, Datum, Kickoff', () => {
  const d = eventDefaults(ev);
  assert.equal(d.event_title, 'NFL München Game');
  assert.equal(d.match_title, 'New England Patriots vs. Detroit Lions');
  assert.equal(d.event_date, '2026-11-15');
  assert.equal(d.kickoff, '15:30');
  assert.equal(d.venue, 'Allianz Arena');
  // «TBA» wird nicht als Paarung übernommen
  assert.equal(eventDefaults({ id: 'x', spielplan: [{ date: 'November 2026', matchup: 'Detroit Lions vs. TBA' }] }).match_title, undefined);
});

function ticket(over: Partial<EventTicket> = {}): EventTicket {
  return {
    id: 't1', created_at: '', updated_at: '', created_by: '', branding: 'ft', event_id: '', event_title: 'NFL Munich Game 2026',
    match_title: 'New England Patriots vs. Detroit Lions', event_date: '2026-11-15', kickoff: '15:30',
    venue: 'FC Bayern Munich Stadium', venue_address: 'Werner-Heisenberg-Allee 25, 80939 München', entrance: 'Kern J',
    category: 'Sitzplatz 2 – On Location', area: '231', row_no: '13', seat: '6', holder_raw: 'M. Faltin, Stefan',
    holder_salutation: 'Herr', holder_first: 'Stefan', holder_last: 'Faltin', recipient_email: 'stefan@faltin.ch',
    apple_url: A(3), android_url: G(3), booking_ref: '', internal_note: '', status: 'offen', draft_mailbox: '',
    draft_web_link: '', draft_at: '', draft_by: '', sort: 0, lang: 'de', hide_holder: false, ...over,
  };
}

test('Ticketwerte haben Vorrang, leere Felder kommen aus dem Event', () => {
  const r = resolveTicket(ticket({ event_id: 'nfl', match_title: '', venue: 'FC Bayern Munich Stadium' }), ev);
  assert.equal(r.match_title, 'New England Patriots vs. Detroit Lions');
  assert.equal(r.venue, 'FC Bayern Munich Stadium');
});

test('Gruppen: je Empfänger und Spiel, Plätze sortiert', () => {
  const list = [
    ticket({ id: 'a', seat: '14', recipient_email: 'angela@mitickets.com' }),
    ticket({ id: 'b', seat: '7', recipient_email: 'angela@mitickets.com' }),
    ticket({ id: 'c' }),
  ];
  const g = [...groupForMail(list).values()];
  assert.equal(g.length, 2);
  assert.deepEqual(g[0].map((t) => t.seat), ['7', '14']);
});

test('Platzbereiche', () => {
  assert.equal(seatRange(['7', '8', '9', '10', '11', '12', '13', '14']), '7–14');
  assert.equal(seatRange(['6', '8', '9']), '6, 8–9');
  assert.equal(seatRange(['A', 'B']), 'A, B');
});

test('Prüfen: gemischte Empfänger oder Branding werden abgelehnt', () => {
  assert.deepEqual(checkMailGroup([ticket()]), []);
  assert.ok(checkMailGroup([ticket(), ticket({ recipient_email: 'x@y.ch' })]).length > 0);
  assert.ok(checkMailGroup([ticket(), ticket({ id: 'z', seat: '7', branding: 'neutral' })]).some((e) => e.includes('Branding')));
  assert.ok(checkMailGroup([ticket({ apple_url: '', android_url: '' })]).some((e) => e.includes('Wallet')));
});

test('Mail FT: Logo, Firmenfuss, Knöpfe mit Original-Links', () => {
  const m = renderTicketMail([ticket()], { assets: { base: 'https://next.faltintravel.com' }, attachedSeats: 1 });
  assert.equal(m.subject, 'Ihr Ticket: NFL Munich Game 2026 – New England Patriots vs. Detroit Lions, 15.11.2026');
  assert.ok(m.html.includes('https://next.faltintravel.com/mail/faltin-logo-weiss.png'));
  assert.ok(m.html.includes('Faltin Travel AG'));
  assert.ok(m.html.includes('Sehr geehrter Herr Faltin'));
  assert.ok(m.html.includes(A(3).replace(/&/g, '&amp;')));
  assert.ok(m.html.includes('Zu Apple Wallet hinzufügen'));
  assert.ok(m.html.includes('Google Wallet / Android'));
  assert.ok(m.html.includes('.pkpass'));
  assert.ok(m.text.includes(A(3)));
});

test('Mail White-Label: keine Faltin-Spuren', () => {
  const list = Array.from({ length: 8 }, (_, i) => ticket({
    id: `w${i}`, branding: 'neutral', seat: String(7 + i), holder_raw: 'Mr. WEEGE, Fredrik',
    holder_first: 'Fredrik', holder_last: 'Weege', recipient_email: 'angela@mitickets.com',
  }));
  const m = renderTicketMail(list, { assets: { base: 'https://next.faltintravel.com', cid: true } });
  assert.ok(!/faltin/i.test(m.html), 'Faltin taucht im White-Label auf');
  assert.ok(m.html.includes('cid:wallet-apple-png@ticket'));
  assert.deepEqual(mailImages('neutral'), ['wallet-apple.png', 'wallet-google.png']);
  assert.ok(!/faltin/i.test(m.text));
  assert.ok(m.html.includes('7–14'));
  assert.ok(m.html.includes('Ticket 8 · Block 231 · Reihe 13 · Platz 14'));
  assert.equal(mailSubject(list), 'Ihre 8 Tickets: NFL Munich Game 2026 – New England Patriots vs. Detroit Lions, 15.11.2026');
  assert.ok(!m.html.includes('.pkpass'));
});

test('Hilfsfunktionen', () => {
  assert.equal(longDate('2026-11-15'), 'Sonntag, 15. November 2026');
  assert.equal(cityOf('Werner-Heisenberg-Allee 25, 80939 München'), 'München');
  assert.equal(cityOf('Basel'), 'Basel');
  assert.equal(passFileName(ticket()), 'Ticket-NFL-Munich-Game-2026-Block231-Reihe13-Platz6.pkpass');
  assert.equal(normBranding('whitelabel'), 'neutral');
  assert.equal(normBranding(''), 'ft');
});

test('Mail Englisch, Inhaber ausgeblendet', () => {
  const list = [ticket({ id: 'e1', seat: '7', lang: 'en', hide_holder: true, branding: 'neutral' }), ticket({ id: 'e2', seat: '8', lang: 'en', hide_holder: true, branding: 'neutral' })];
  const m = renderTicketMail(list, { assets: { base: '', cid: true } });
  assert.equal(m.subject, 'Your 2 tickets: NFL Munich Game 2026 – New England Patriots vs. Detroit Lions, 15.11.2026');
  assert.ok(m.html.includes('lang="en"'));
  assert.ok(m.html.includes('Add to Apple Wallet'));
  assert.ok(m.html.includes('Sunday, 15 November 2026'));
  assert.ok(m.html.includes('Munich · 15 November 2026'));
  assert.ok(m.html.includes('>Hello<'));
  assert.ok(!/Faltin|Ticket in the name|Tickets in the name/.test(m.html));
  assert.ok(!/Zu Apple Wallet|Reihe|Platz /.test(m.html));
  assert.deepEqual(checkMailGroup([...list, ticket({ id: 'e3', seat: '9', branding: 'neutral', hide_holder: true })]).filter((e) => e.includes('Sprachen')).length, 1);
});

test('Deutsch mit Inhaber zeigt «Ticket auf» und persönliche Anrede', () => {
  const m = renderTicketMail([ticket()], { assets: { base: '' } });
  assert.ok(m.html.includes('Ticket auf'));
  assert.ok(m.html.includes('Sehr geehrter Herr Faltin'));
  const h = renderTicketMail([ticket({ hide_holder: true })], { assets: { base: '' } });
  assert.ok(!h.html.includes('Ticket auf'));
  assert.ok(h.html.includes('>Guten Tag<'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptText, parseAmount, findDates, needsAi } from '../src/lib/belege/parse.ts';
import { gegenkonto, kontoFuerKategorie, vorsteuerKonto, kategorieAusText, DEFAULT_GEGENKONTEN, isKnownKonto, KATEGORIEN } from '../src/lib/belege/kontenplan.ts';
import { vatFromGross, receiptPoints, levelFor, streakDays, missingFields, canEdit, badgesFor } from '../src/lib/belege/model.ts';

const TODAY = new Date('2026-11-13T12:00:00Z');

test('Beträge: Schweizer, deutsche und englische Schreibweise', () => {
  assert.equal(parseAmount("1'234.50"), 1234.5);
  assert.equal(parseAmount('1.234,50'), 1234.5);
  assert.equal(parseAmount('1 234,50'), 1234.5);
  assert.equal(parseAmount('12.50'), 12.5);
  assert.equal(parseAmount('12'), null);
});

test('Daten: TT.MM.JJ, ISO, Monatsnamen; Zukunft und uralt fallen weg', () => {
  assert.deepEqual(findDates('Datum 12.11.26 14:03', TODAY), ['2026-11-12']);
  assert.deepEqual(findDates('2026-11-01', TODAY), ['2026-11-01']);
  assert.deepEqual(findDates('Nov 9, 2026', TODAY), ['2026-11-09']);
  assert.deepEqual(findDates('9. November 2026', TODAY), ['2026-11-09']);
  assert.deepEqual(findDates('01.01.2030 und 01.01.2010', TODAY), []);
});

test('Schweizer Restaurantquittung', () => {
  const text = `Restaurant Zunfthaus zur Waag AG
Münsterhof 8
CH-8001 Zürich
Tisch 12  Bedient von Anna
12.11.2026 21:14
2 Zürcher Geschnetzeltes   CHF 92.00
1 Flasche Wein            CHF 68.00
Total CHF                 160.00
MWST 8.1% von 160.00        11.99
Bezahlt Visa              160.00
CHE-105.879.346 MWST`;
  const p = parseReceiptText(text, TODAY);
  assert.equal(p.supplier, 'Restaurant Zunfthaus zur Waag AG');
  assert.equal(p.receipt_date, '2026-11-12');
  assert.equal(p.amount_gross, 160);
  assert.equal(p.currency, 'CHF');
  assert.equal(p.country, 'CH');
  assert.deepEqual(p.vat, [{ rate: 8.1, vat: 11.99 }]);
  assert.match(p.supplier_vat_id, /^CHE-105\.879\.346/);
  assert.equal(needsAi(p, text.length), false);
});

test('Englische Hotelrechnung mit Buchungsbezug, Betrag in der Folgezeile', () => {
  const text = `Shore Hotel Santa Monica
1515 Ocean Ave, Santa Monica, CA 90401
Invoice No: SH-88213
Guest: Faltin Travel / RQ-13347
Date: Feb 15, 2026
Room 4 nights            USD 2,480.00
Taxes                    USD 384.40
Amount due
USD 2,864.40`;
  const p = parseReceiptText(text, TODAY);
  assert.equal(p.supplier, 'Shore Hotel Santa Monica');
  assert.equal(p.amount_gross, 2864.4);
  assert.equal(p.currency, 'USD');
  assert.equal(p.invoice_no, 'SH-88213');
  assert.equal(p.receipt_date, '2026-02-15');
  assert.deepEqual(p.refs, ['RQ-13347']);
  assert.equal(p.country, 'US');
});

test('Kein Text → KI', () => {
  const p = parseReceiptText('', TODAY);
  assert.equal(p.amount_gross, 0);
  assert.equal(needsAi(p, 0), true);
});

test('Kontierung: Kategorie → Konto (Inland/Ausland), Zahlung → Gegenkonto', () => {
  assert.equal(kontoFuerKategorie('reise', 'CH'), '548200');
  assert.equal(kontoFuerKategorie('reise', 'DE'), '548220');
  assert.equal(kontoFuerKategorie('kunde_leistung', 'US'), '420010');
  assert.equal(kontoFuerKategorie('essen_kunde', 'FR'), '669000');
  assert.equal(gegenkonto('rechnung', 'EUR', ''), '200002');
  assert.equal(gegenkonto('bank', 'USD', ''), '102007');
  assert.equal(gegenkonto('privat', 'CHF', 'natalie@faltintravel.com'), '200000');
  assert.equal(gegenkonto('privat', 'CHF', 'faltin@faltintravel.com'), '206000');
  assert.equal(gegenkonto('firmenkarte', 'CHF', ''), DEFAULT_GEGENKONTEN.firmenkarte);
  assert.equal(vorsteuerKonto('420000'), '117000');
  assert.equal(vorsteuerKonto('669000'), '117100');
  for (const k of KATEGORIEN) {
    assert.ok(isKnownKonto(k.konto), `${k.key} → ${k.konto}`);
    if (k.kontoAusland) assert.ok(isKnownKonto(k.kontoAusland));
  }
  assert.equal(kategorieAusText('SBB CFF FFS Billett Zürich HB'), 'reise');
  assert.equal(kategorieAusText('Shell Tankstelle Diesel'), 'auto');
});

test('MWST aus Brutto', () => {
  assert.deepEqual(vatFromGross(108.1, 8.1), { rate: 8.1, vat: 8.1, net: 100 });
  assert.deepEqual(vatFromGross(50, 0), { rate: 0, vat: 0, net: 50 });
});

const base = {
  id: 'abc', status: 'erfasst' as const, receipt_date: '2026-11-13', created_at: '2026-11-13T09:00:00.000Z',
  supplier: 'SBB', amount_gross: 42, category: 'reise', payment: 'firmenkarte', currency: 'CHF',
  event_slug: '', booking_id: '', review_note: '', amount_chf: 42,
};

test('Punkte: sofort + komplett + Zuordnung, verworfen = 0', () => {
  const p = receiptPoints({ ...base, id: 'x1' });
  const labels = p.parts.map((x) => x.label);
  assert.ok(labels.includes('Gleich am selben Tag'));
  assert.ok(labels.includes('Komplett ausgefüllt'));
  assert.equal(receiptPoints({ ...base, status: 'verworfen' }).total, 0);
  const withEvent = receiptPoints({ ...base, id: 'x1', event_slug: 'super-bowl-2027' });
  assert.equal(withEvent.total - p.total, p.jackpot ? 15 : 5);
});

test('Stufen und Serie (Wochenende unterbricht nicht)', () => {
  assert.equal(levelFor(0).level.name, 'Rookie');
  assert.equal(levelFor(350).level.name, 'Profi');
  assert.equal(levelFor(5000).next, null);
  // Fr 13.11. heute, Do, Mi + Fr der Vorwoche? Nein: Mo 9.11. fehlt → Serie 4 (Di–Fr)
  assert.equal(streakDays(['2026-11-13', '2026-11-12', '2026-11-11', '2026-11-10', '2026-11-06'], '2026-11-13'), 4);
  // Montag ohne Beleg, Freitag davor mit → Serie läuft weiter
  assert.equal(streakDays(['2026-11-13', '2026-11-12'], '2026-11-16'), 2);
});

test('Pflichtfelder und Bearbeitungsrechte', () => {
  assert.deepEqual(missingFields({ ...base, supplier: '', amount_gross: 0 }), ['Lieferant', 'Betrag']);
  assert.equal(canEdit({ status: 'erfasst', created_by: 'u1' }, { id: 'u1', reviewer: false }), true);
  assert.equal(canEdit({ status: 'freigegeben', created_by: 'u1' }, { id: 'u1', reviewer: true }), false);
  assert.equal(canEdit({ status: 'erfasst', created_by: 'u1' }, { id: 'u2', reviewer: false }), false);
});

test('Abzeichen', () => {
  const list = [0, 1, 2].map((i) => ({ ...base, id: `b${i}`, currency: ['CHF', 'EUR', 'USD'][i] }));
  const b = badgesFor(list, '2026-11-13');
  const earned = b.filter((x) => x.earned).map((x) => x.id);
  assert.ok(earned.includes('erster'));
  assert.ok(earned.includes('hattrick'));
  assert.ok(earned.includes('welt'));
  assert.ok(!earned.includes('hundert'));
});

/**
 * Unit-Tests der Traffics-Suchlogik (ohne Netzwerk).
 * Lauf: `npm test` (Node ≥ 22.18 entfernt TypeScript-Typen selbst).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeSearchParams, buildSearchQuery, searchPath, normalizeOffers, offerToItems, nightsBetweenIso, compareOffers,
} from '../src/lib/trafficsModel.ts';

const malaga = {
  productType: 'pauschal', fromDate: '2027-05-10', toDate: '2027-05-13', adults: 1,
  departureAirports: 'zrh', arrivalAirports: 'AGP', roomTypes: 'EZ', minCategory: 5,
  carrierCodes: 'LX', directOnly: true,
};

test('Suchparameter: Málaga-Incentive wird sauber abgesichert', () => {
  const r = sanitizeSearchParams(malaga);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.params.duration, 3);
  assert.deepEqual(r.params.departureAirports, ['ZRH']);
  assert.deepEqual(r.params.tourOperators, ['DER']);
  assert.equal(r.params.limit, 40);
});

test('Suchparameter: Fehler bei fehlendem Datum, Rückdatum und Abflughafen', () => {
  assert.equal(sanitizeSearchParams({ ...malaga, fromDate: '' }).ok, false);
  assert.equal(sanitizeSearchParams({ ...malaga, toDate: '2027-05-09' }).ok, false);
  assert.equal(sanitizeSearchParams({ ...malaga, departureAirports: '' }).ok, false);
  assert.equal(sanitizeSearchParams({ ...malaga, productType: 'hotelonly', departureAirports: '' }).ok, true);
});

test('Query: Parameter laut Connector-Spezifikation, stabil sortiert', () => {
  const r = sanitizeSearchParams(malaga);
  assert.ok(r.ok);
  if (!r.ok) return;
  const q = Object.fromEntries(buildSearchQuery(r.params));
  assert.equal(searchPath(r.params), '/offers');
  assert.equal(q.productType, 'pauschal');
  assert.equal(q.departureAirportList, 'ZRH');
  assert.equal(q.arrivalAirportList, 'AGP');
  assert.equal(q.roomTypeList, 'EZ');
  assert.equal(q.minCategory, '5');
  assert.equal(q.tourOperatorList, 'DER');
  assert.equal(q.sortBy, 'price');
  assert.equal(q.navigation, '1,40');
  assert.equal(q['flight[carrierCodeList]'], 'LX');
  assert.equal(q['flight[directness]'], 'N');
  // gleiche Suche in anderer Reihenfolge → gleicher Cache-Schlüssel
  const r2 = sanitizeSearchParams({ ...malaga, carrierCodes: ['lx'], departureAirports: ['ZRH'] });
  assert.ok(r2.ok);
  if (!r2.ok) return;
  assert.deepEqual(buildSearchQuery(r2.params), buildSearchQuery(r.params));
});

test('Query: Flugsuche nutzt /offers/flight ohne Hotelfilter', () => {
  const r = sanitizeSearchParams({ ...malaga, productType: 'flight' });
  assert.ok(r.ok);
  if (!r.ok) return;
  const q = Object.fromEntries(buildSearchQuery(r.params));
  assert.equal(searchPath(r.params), '/offers/flight');
  assert.equal(q.productType, undefined);
  assert.equal(q.roomTypeList, undefined);
});

const sample = {
  totalResultCount: '17',
  offerList: [{
    code: 'ABC123', productType: 'pauschal',
    personPrice: { value: '1234.50', currency: 'EUR' }, totalPrice: { value: '1234.50', currency: 'EUR' },
    travelDate: { fromDate: '2027-05-10', toDate: '2027-05-13', duration: '3' },
    tourOperator: { code: 'DER', name: 'DERTOUR' },
    flightOffer: { flight: {
      outboundLegList: [{ departureAirportCode: 'ZRH', arrivalAirportCode: 'AGP', departureDate: '2027-05-10', departureTime: '09:35', arrivalTime: '12:20', flightCarrierCode: 'LX', flightNumber: '2110' }],
      inboundLegList: [{ departureAirportCode: 'AGP', arrivalAirportCode: 'ZRH', departureDate: '2027-05-13', departureTime: '16:50', arrivalTime: '19:30', flightCarrierCode: 'LX', flightNumber: '2111' }],
    } },
    hotelOffer: {
      hotel: { name: 'Gran Hotel Miramar', category: '5', country: { name: 'Spanien' }, location: { name: 'Málaga', region: { name: 'Costa del Sol' } } },
      roomType: { code: 'EZ', name: 'Einzelzimmer' }, boardType: { code: 'F', name: 'Frühstück' },
    },
  }, { notAnOffer: true }],
};

test('Antwort: /offers wird in flache Treffer überführt', () => {
  const { total, offers } = normalizeOffers(sample);
  assert.equal(total, 17);
  assert.equal(offers.length, 1);
  const o = offers[0];
  assert.equal(o.hotelName, 'Gran Hotel Miramar');
  assert.equal(o.category, 5);
  assert.equal(o.personPrice, 1234.5);
  assert.equal(o.nights, 3);
  assert.equal(o.outbound[0].flightNumber, '2110');
  assert.equal(o.inbound[0].departure, '16:50');
  assert.deepEqual(normalizeOffers(null), { total: 0, offers: [] });
});

test('Übernahme: Pauschale → Hotel (EK/Nacht × Nächte) + Flug mit EK 0', () => {
  const [o] = normalizeOffers(sample).offers;
  let n = 0;
  const items = offerToItems(o, () => `id${++n}`);
  assert.equal(items.length, 2);
  const [hotel, flug] = items;
  assert.equal(hotel.category, 'hotel');
  assert.equal(hotel.qty, 3);
  assert.equal(hotel.amount, 411.5);
  assert.equal(hotel.room_category, 'Einzelzimmer · Frühstück');
  assert.equal(hotel.service_from, '2027-05-10');
  assert.equal(hotel.service_to, '2027-05-13');
  assert.match(hotel.description, /Pauschale inkl\. Flug/);
  assert.equal(flug.category, 'flug');
  assert.equal(flug.amount, 0);
  assert.match(flug.description, /ZRH–AGP LX2110 09:35–12:20/);
});

test('Übernahme: Nur Hotel → keine Flugposition; Nur Flug → Menge 1', () => {
  const [o] = normalizeOffers(sample).offers;
  const hotelOnly = offerToItems({ ...o, productType: 'hotelonly' }, () => 'x');
  assert.equal(hotelOnly.length, 1);
  assert.doesNotMatch(hotelOnly[0].description, /Pauschale/);
  const flight = offerToItems({ ...o, productType: 'flight', hotelName: '' }, () => 'x');
  assert.equal(flight.length, 1);
  assert.equal(flight[0].category, 'flug');
  assert.equal(flight[0].qty, 1);
  assert.equal(flight[0].amount, 1234.5);
});

test('Nächte zwischen zwei Daten', () => {
  assert.equal(nightsBetweenIso('2027-05-10', '2027-05-13'), 3);
  assert.equal(nightsBetweenIso('2027-05-13', '2027-05-10'), 0);
  assert.equal(nightsBetweenIso('', '2027-05-10'), 0);
});

test('Übernahme: Nächte × Nachtpreis ergibt wieder den Pauschalpreis', () => {
  const [o] = normalizeOffers(sample).offers;
  const [hotel] = offerToItems({ ...o, personPrice: 1310 }, () => 'x');
  assert.equal(Math.round(hotel.amount * hotel.qty * 100) / 100, 1310);
});

test('Vergleich: Pauschal gegen Nur-Flug + Nur-Hotel je Hotel', () => {
  const [base] = normalizeOffers(sample).offers;
  const pkg = { ...base, code: 'P1', giataId: '42', personPrice: 1400 };
  const pkgOther = { ...base, code: 'P2', giataId: '99', hotelName: 'Anderes Hotel', personPrice: 1100 };
  const hotel = { ...base, code: 'H1', productType: 'hotelonly', giataId: '42', personPrice: 980, outbound: [], inbound: [] };
  const hotelPricier = { ...hotel, code: 'H2', personPrice: 1050 };
  const flights = [
    { ...base, code: 'F2', productType: 'flight', hotelName: '', personPrice: 520 },
    { ...base, code: 'F1', productType: 'flight', hotelName: '', personPrice: 440 },
  ];
  const { cheapestFlight, rows } = compareOffers([pkg, pkgOther], flights, [hotelPricier, hotel]);
  assert.equal(cheapestFlight?.code, 'F1');
  assert.equal(rows.length, 2);
  const miramar = rows[0];
  assert.equal(miramar.giataId, '42');
  assert.equal(miramar.hotelCode, 'H1');
  assert.equal(miramar.separatePrice, 1420);
  assert.equal(miramar.diff, 20); // Pauschale 20 günstiger
  assert.equal(rows[1].hotelPrice, null);
  assert.equal(rows[1].diff, null);
});

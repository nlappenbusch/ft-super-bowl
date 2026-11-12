import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAddressList, checkSendable, hasInternalMarker, textToHtml, normInquiryStatus, countByStatus } from '../src/lib/inquiryModel.ts';

const ok = { to_addr: 'events@nikkibeach.com', cc_addr: '', subject: 'Gruppenanfrage 12.05.2027', body: 'Guten Tag, wir bitten um ein Angebot für 41 Personen.', status: 'entwurf' as const };

test('Adressliste: trennt, säubert, dedupliziert', () => {
  assert.deepEqual(parseAddressList('A@x.ch; b@y.de , a@x.ch <c@z.com> kaputt'), ['a@x.ch', 'b@y.de', 'c@z.com']);
  assert.deepEqual(parseAddressList(''), []);
});

test('Senden erlaubt bei vollständigem Entwurf', () => {
  const r = checkSendable(ok);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.to, ['events@nikkibeach.com']);
});

test('Senden gesperrt: fehlender Empfänger, [INTERN], schon gesendet', () => {
  assert.equal(checkSendable({ ...ok, to_addr: 'keine-adresse' }).ok, false);
  assert.equal(checkSendable({ ...ok, body: '[INTERN – vor dem Senden entfernen] ' + ok.body }).ok, false);
  assert.equal(checkSendable({ ...ok, status: 'gesendet' }).ok, false);
  assert.equal(hasInternalMarker('[ intern: xy]'), true);
});

test('CC ohne Doppelungen mit An', () => {
  const r = checkSendable({ ...ok, cc_addr: 'events@nikkibeach.com, chef@faltintravel.com' });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.cc, ['chef@faltintravel.com']);
});

test('Klartext → HTML: escapt, Absätze, Links', () => {
  const h = textToHtml('Hallo <Team>\nZeile 2\n\nSiehe https://faltintravel.com');
  assert.match(h, /&lt;Team&gt;<br>Zeile 2/);
  assert.match(h, /<a href="https:\/\/faltintravel.com">/);
  assert.equal((h.match(/<p /g) || []).length, 2);
});

test('Status normalisieren und zählen', () => {
  assert.equal(normInquiryStatus('quatsch'), 'entwurf');
  assert.deepEqual(countByStatus([{ status: 'entwurf' }, { status: 'gesendet' }, { status: 'entwurf' }]), { entwurf: 2, gesendet: 1 });
});

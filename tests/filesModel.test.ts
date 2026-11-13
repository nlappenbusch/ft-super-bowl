import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanFileName, resolveExpiry } from '../src/lib/files/model.ts';
import { expiryInfo, fmtBytes } from '../src/components/files/filesFormat.ts';

const FROM = Date.parse('2026-11-13T10:00:00.000Z');
const L = { defaultDays: 30, maxDays: 365 };
const DAY = 86_400_000;

test('Ablauf: Standard 30 Tage, Tage-Angabe, Ober- und Untergrenze', () => {
  assert.equal(resolveExpiry({}, FROM, L), new Date(FROM + 30 * DAY).toISOString());
  assert.equal(resolveExpiry({ days: 7 }, FROM, L), new Date(FROM + 7 * DAY).toISOString());
  assert.equal(resolveExpiry({ days: 'quatsch' }, FROM, L), new Date(FROM + 30 * DAY).toISOString());
  assert.equal(resolveExpiry({ days: 5000 }, FROM, L), new Date(FROM + 365 * DAY).toISOString());
  assert.equal(resolveExpiry({ expires_at: '2020-01-01T00:00:00Z' }, FROM, L), new Date(FROM + 3_600_000).toISOString());
});

test('Ablauf: Datum ohne Uhrzeit gilt bis Tagesende', () => {
  const r = new Date(resolveExpiry({ expires_at: '2026-12-24' }, FROM, L));
  assert.equal(r.getTime(), new Date('2026-12-24T23:59:59').getTime());
});

test('Dateinamen: keine Pfade, keine Steuerzeichen', () => {
  assert.equal(cleanFileName('../../etc/passwd'), 'passwd');
  assert.equal(cleanFileName('C:\\Users\\x\\Bild 1.jpg'), 'Bild 1.jpg');
  assert.equal(cleanFileName('a\u0000b\nc.pdf'), 'abc.pdf');
  assert.equal(cleanFileName(''), 'datei');
});

test('Restlaufzeit-Ampel', () => {
  assert.equal(expiryInfo(new Date(FROM + 20 * DAY).toISOString(), FROM).tone, 'ok');
  assert.equal(expiryInfo(new Date(FROM + 5 * DAY).toISOString(), FROM).tone, 'soon');
  assert.equal(expiryInfo(new Date(FROM + 3 * 3_600_000).toISOString(), FROM).label, 'noch 3 Std.');
  assert.equal(expiryInfo(new Date(FROM - 1).toISOString(), FROM).tone, 'gone');
});

test('Grössenangabe', () => {
  assert.equal(fmtBytes(20 * 1024 ** 3), '20 GB');
  assert.equal(fmtBytes(1.5 * 1024 ** 2), '1,5 MB');
  assert.equal(fmtBytes(500), '1 KB');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePlanning, dayBlocks, timelineRange, entryRoute, normPlanTime, isPlanningEmpty } from '../src/lib/planningModel.ts';

test('Planung absichern: Defaults, ungültige Werte, leere Einträge', () => {
  const p = sanitizePlanning({
    days: [{ date: '2027-05-10', title: 'Anreise', entries: [
      { time_from: '9:35', title: 'Abflug', kind: 'flug' },
      { title: '', time_from: '' },
      { time_from: '13:00', time_to: '13:30', title: 'Transfer', kind: 'transfer', distance_km: '12', duration_min: 20 },
      { time_from: 'quatsch', title: 'X', kind: 'unbekannt' },
    ] }],
    suppliers: [{ name: 'DTS Spain', type: 'dmc', status: 'nix' }, { name: '' }],
    sources: [{ ref: 'https://we-bus.com', what: 'Buspreise' }],
  });
  assert.equal(p.days[0].entries.length, 3);
  assert.equal(p.days[0].entries[0].time_from, '09:35');
  assert.equal(p.days[0].entries[1].distance_km, 12);
  assert.equal(p.days[0].entries[2].kind, 'programm');
  assert.equal(p.suppliers.length, 1);
  assert.equal(p.suppliers[0].status, 'kandidat');
  assert.equal(p.sources[0].nr, 'B1');
  assert.equal(isPlanningEmpty(sanitizePlanning('kaputt')), true);
});

test('Timeline: Punkte, Fahrzeit als Dauer, über Mitternacht', () => {
  const p = sanitizePlanning({ days: [{ entries: [
    { time_from: '09:35', title: 'Abflug' },
    { time_from: '08:15', title: 'Bus', kind: 'transfer', duration_min: 105 },
    { time_from: '23:30', time_to: '01:00', title: 'Rückfahrt', kind: 'transfer' },
    { time_to: '10:00', title: 'Frühstück', kind: 'essen' },
  ] }] });
  const b = dayBlocks(p.days[0]);
  assert.deepEqual(b.map((x) => [x.entry.title, x.start, x.end, x.point]), [
    ['Bus', 495, 600, false], ['Abflug', 575, 575, true], ['Frühstück', 600, 600, true], ['Rückfahrt', 1410, 1500, false],
  ]);
  assert.deepEqual(timelineRange(p.days), { from: 480, to: 1500 });
});

test('Strecke und Zeit formatieren', () => {
  assert.equal(entryRoute({ route_from: 'Hotel', route_to: 'Granada', distance_km: 130, duration_min: 105, vehicle: 'VIP-Bus' }), 'Hotel → Granada · 130 km · 1 h 45 min · VIP-Bus');
  assert.equal(normPlanTime('0935'), '09:35');
  assert.equal(normPlanTime('25:00'), '');
});

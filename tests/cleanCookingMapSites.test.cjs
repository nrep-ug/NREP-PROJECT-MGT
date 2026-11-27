const test = require('node:test');
const assert = require('node:assert/strict');
const { MAP_SITES, distanceKm, overlappingSites, sitesBySettlement } = require('../lib/cleanCooking/mapSites');

test('every site sits inside Uganda with a unique id', () => {
  assert.equal(new Set(MAP_SITES.map((s) => s.id)).size, MAP_SITES.length);
  for (const s of MAP_SITES) {
    assert.ok(s.lat > -1.5 && s.lat < 4.25, `${s.name} latitude`);
    assert.ok(s.lng > 29.5 && s.lng < 35.05, `${s.name} longitude`);
  }
});

test('every site carries a list of community engagements (empty when not reported)', () => {
  for (const s of MAP_SITES) assert.ok(Array.isArray(s.engagements), s.name);
  assert.deepEqual(MAP_SITES.find((s) => s.id === 'bolomoni').engagements, ['Farming', 'Mining (rainy season)', 'Trained agriculturalists']);
  assert.deepEqual(MAP_SITES.find((s) => s.id === 'kado').engagements, ['Briquette making']);
});

test('distance is in kilometres', () => {
  // One degree of latitude is about 111 km.
  assert.ok(Math.abs(distanceKm({ lat: 0, lng: 32 }, { lat: 1, lng: 32 }) - 111.2) < 0.5);
  assert.equal(distanceKm(MAP_SITES[0], MAP_SITES[0]), 0);
});

test('only sites closer than two radii overlap', () => {
  const sites = [
    { id: 'a', lat: 3.3, lng: 31.3 },
    { id: 'b', lat: 3.3 + 3 / 111.2, lng: 31.3 }, // 3 km away → overlaps at 2 km radius
    { id: 'c', lat: 3.3 + 10 / 111.2, lng: 31.3 }, // 10 km from a, 7 km from b
  ];
  assert.deepEqual(overlappingSites(sites, 2).map((p) => [p.a, p.b, p.km]), [['a', 'b', 3]]);
});

test('sites are grouped by settlement, ignoring the zone note', () => {
  const groups = sitesBySettlement();
  assert.deepEqual(groups.map((g) => [g.settlement, g.sites.length]), [['Bidi Bidi', 5], ['Kiryandongo', 1]]);
});

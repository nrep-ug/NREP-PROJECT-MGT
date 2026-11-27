/**
 * Clean cooking sites shown on the dashboard maps.
 *
 * Coordinates are as supplied by the BCCeC team (Nov 2026). Drimbeni was
 * given only as a plus code; its position is decoded from that code
 * (86FV+WCV near Noko → 6GMH86FV+WCV). The other five were checked against
 * their plus codes and agree to within ~20 m.
 *
 * Positions are not personal data. Names and notes are DRAFT until M&E
 * confirms them. Pure data + helpers — unit tested in
 * tests/cleanCookingMapSites.test.cjs.
 */

/** Service radius drawn around each site: who can reasonably reach it. */
const ACCESS_RADIUS_KM = 2;

const site = (id, name, lat, lng, extra) => ({ id, name, lat, lng, ...extra });

const MAP_SITES = [
  site('bolomoni', 'Bolomoni (Village 10)', 3.2829660, 31.3130780, {
    plusCode: '78M7+575 Erezeli', settlement: 'Bidi Bidi', district: 'Yumbe',
    note: 'Main community engagement: farming, and mining in the rainy season. Trained agriculturalists.',
  }),
  site('kado', 'Kado (Village 7)', 3.2961190, 31.2927418, {
    plusCode: '77WV+C3X Erezeli', settlement: 'Bidi Bidi', district: 'Yumbe',
    note: 'Mainly briquettes.',
  }),
  site('innonga', 'Innonga', 3.3031170, 31.2693667, {
    plusCode: '8739+6PX Noko', settlement: 'Bidi Bidi (Zone 4 annex)', district: 'Yumbe',
  }),
  site('igamara', 'Igamara (Village 5)', 3.3105795, 31.2483771, {
    plusCode: '866X+69J Noko', settlement: 'Bidi Bidi', district: 'Yumbe',
  }),
  site('drimbeni', 'Drimbeni', 3.3248625, 31.2435469, {
    plusCode: '86FV+WCV Noko', settlement: 'Bidi Bidi (Zone 4 annex)', district: 'Yumbe',
    note: 'Position decoded from the plus code (no coordinates were supplied).',
  }),
  site('bweyale', 'Bweyale site', 1.9431758, 32.1588388, {
    plusCode: 'W5V5+7GG Bweyale', settlement: 'Kiryandongo', district: 'Kiryandongo',
    note: 'Site name to be confirmed.',
  }),
];

/** Great-circle distance in km (haversine). */
function distanceKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Pairs of sites whose service areas overlap (closer than two radii), so a
 * household in between could reach either one.
 */
function overlappingSites(sites = MAP_SITES, radiusKm = ACCESS_RADIUS_KM) {
  const pairs = [];
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      const km = distanceKm(sites[i], sites[j]);
      if (km < radiusKm * 2) pairs.push({ a: sites[i].id, b: sites[j].id, km: Math.round(km * 10) / 10 });
    }
  }
  return pairs;
}

/** Sites grouped by settlement, for the map's jump-to list. */
function sitesBySettlement(sites = MAP_SITES) {
  const groups = new Map();
  for (const s of sites) {
    const key = s.settlement.replace(/\s*\(.*\)$/, '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return [...groups.entries()].map(([settlement, list]) => ({ settlement, sites: list }));
}

module.exports = { ACCESS_RADIUS_KM, MAP_SITES, distanceKm, overlappingSites, sitesBySettlement };

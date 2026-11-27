const test = require('node:test');
const assert = require('node:assert/strict');
const {
  attributionFor, epcSalesSeries, marketValues, normalizeDistrict, normalizeRegion, quantityOrNull, summarizeMarketFigures,
} = require('../lib/cleanCooking/marketDomain');

test('district spellings map to the district and keep the place as a sub-location', () => {
  assert.deepEqual(normalizeDistrict('Bushenyi (Ishaka)'), { district: 'Bushenyi', subLocation: 'Ishaka', districtRaw: 'Bushenyi (Ishaka)' });
  assert.deepEqual(normalizeDistrict('Fortportal'), { district: 'Fort Portal', subLocation: null, districtRaw: 'Fortportal' });
  assert.equal(normalizeDistrict('kampala').district, 'Kampala');
  assert.equal(normalizeDistrict('Entebbe').district, 'Wakiso');
  assert.equal(normalizeDistrict('').district, null);
});

test('regions are normalised to the names used elsewhere', () => {
  assert.equal(normalizeRegion('East'), 'Eastern');
  assert.equal(normalizeRegion('West Nile'), 'West Nile');
  assert.equal(normalizeRegion('Central'), 'Central');
});

test('blank stays null (not reported), spreadsheet whole numbers are accepted, junk is rejected', () => {
  assert.equal(quantityOrNull(''), null);
  assert.equal(quantityOrNull(null), null);
  assert.equal(quantityOrNull('0'), 0);
  assert.equal(quantityOrNull('1,301.0'), 1301);
  assert.throws(() => quantityOrNull('12.5'));
  assert.throws(() => quantityOrNull('many'));
});

test('summary keeps figure types apart, skips rejected rows and does not count blanks as zero', () => {
  const s = summarizeMarketFigures([
    { figureType: 'company_market_total', product: 'epc', quantity: 1000, companyName: 'A', verificationStatus: 'unverified' },
    { figureType: 'company_market_total', product: 'epc', quantity: null, companyName: 'B', verificationStatus: 'unverified' },
    { figureType: 'event_product_count', product: 'epc', quantity: 500, district: 'Masaka', verificationStatus: 'unverified' },
    { figureType: 'event_product_count', product: 'briquettes', quantity: 60, district: 'Masaka', verificationStatus: 'verified' },
    { figureType: 'company_market_total', product: 'epc', quantity: 99, companyName: 'C', verificationStatus: 'rejected' },
  ]);
  assert.equal(s.company_market_total.epc, 1000);
  assert.equal(s.company_market_total.notReported, 1);
  assert.equal(s.company_market_total.companies, 2);
  assert.equal(s.event_product_count.epc, 500);
  assert.equal(s.event_product_count.byProduct.briquettes, 60);
  assert.equal(s.event_product_count.verified, 1);
  assert.equal(s.company_market_total.records, 2, 'rejected rows are excluded');
  assert.equal(s.epc_distributed, undefined, 'NREP-distributed EPCs are not a figure type');
});

test('Kiboko and Digi Wave count at 25%; every other company counts in full; reported figure is kept', () => {
  assert.deepEqual(attributionFor('Kiboko', 104000), { attributionRate: 0.25, attributedQuantity: 26000 });
  assert.deepEqual(attributionFor('Digi Wave', 52500), { attributionRate: 0.25, attributedQuantity: 13125 });
  assert.deepEqual(attributionFor('Up Energy', 18000), { attributionRate: 1, attributedQuantity: 18000 });
  assert.deepEqual(attributionFor('Ecopot', null), { attributionRate: 1, attributedQuantity: null });
  assert.ok(!marketValues('figureType').includes('epc_distributed'));

  const s = summarizeMarketFigures([
    { figureType: 'company_market_total', product: 'epc', quantity: 104000, ...attributionFor('Kiboko', 104000), companyName: 'Kiboko', verificationStatus: 'unverified' },
    { figureType: 'company_market_total', product: 'epc', quantity: 18000, ...attributionFor('Up Energy', 18000), companyName: 'Up Energy', verificationStatus: 'unverified' },
  ]);
  assert.equal(s.company_market_total.epc, 44000, 'counted = 26,000 + 18,000');
  assert.equal(s.company_market_total.epcReported, 122000, 'reported total kept');
  assert.deepEqual(s.company_market_total.partlyAttributed, ['Kiboko']);
});

test('EPC sales series groups recorded sales by month, region and district', () => {
  const s = epcSalesSeries([
    { figureType: 'event_product_count', product: 'epc', quantity: 500, eventDate: '2025-02-10T00:00:00.000Z', region: 'Eastern', district: 'Mbale', verificationStatus: 'unverified' },
    { figureType: 'event_product_count', product: 'epc', quantity: 300, eventDate: '2025-02-20T00:00:00.000Z', region: 'Eastern', district: 'Jinja', verificationStatus: 'unverified' },
    { figureType: 'event_product_count', product: 'epc', quantity: 200, eventDate: '2025-03-01T00:00:00.000Z', region: 'Central', district: 'Masaka', verificationStatus: 'unverified' },
    { figureType: 'event_product_count', product: 'briquettes', quantity: 999, eventDate: '2025-03-01T00:00:00.000Z', region: 'Central', district: 'Masaka', verificationStatus: 'unverified' },
    { figureType: 'event_product_count', product: 'epc', quantity: null, eventDate: '2025-03-02T00:00:00.000Z', region: 'Central', district: 'Gulu', verificationStatus: 'unverified' },
    { figureType: 'event_product_count', product: 'epc', quantity: 50, eventDate: '2025-03-03T00:00:00.000Z', region: 'Central', district: 'Kampala', verificationStatus: 'rejected' },
    { figureType: 'company_market_total', product: 'epc', quantity: 7000, verificationStatus: 'unverified' },
  ]);
  assert.equal(s.total, 1000);
  assert.equal(s.events, 3);
  assert.deepEqual(s.byMonth, [{ month: '2025-02', quantity: 800 }, { month: '2025-03', quantity: 200 }]);
  assert.deepEqual(s.byRegion, [{ region: 'Eastern', quantity: 800 }, { region: 'Central', quantity: 200 }]);
  assert.equal(s.byDistrict[0].district, 'Mbale');
  assert.equal(s.firstDate.slice(0, 10), '2025-02-10');
});

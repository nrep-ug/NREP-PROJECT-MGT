const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canonicalBrand,
  normalizeEmail,
  normalizeUgPhone,
  parseCompanySalesSheet,
  parseQuantity,
  parseSizeLitres,
  periodFromLabel,
  summarizeCompanySales,
} = require('../lib/cleanCooking/domain');

test('Ugandan phone numbers normalise to E.164 and reject junk', () => {
  assert.equal(normalizeUgPhone('0700123456'), '+256700123456');
  assert.equal(normalizeUgPhone('0700 123 456'), '+256700123456');
  assert.equal(normalizeUgPhone('+256-772-000-111'), '+256772000111');
  assert.equal(normalizeUgPhone('256764000222'), '+256764000222');
  assert.equal(normalizeUgPhone('700123456'), '+256700123456');
  assert.equal(normalizeUgPhone(''), '');
  assert.equal(normalizeUgPhone('12345'), null);
  assert.equal(normalizeUgPhone('0802235556'), null);
});

test('emails are lower-cased and validated', () => {
  assert.equal(normalizeEmail(' NRhoda22@Yahoo.co.uk '), 'nrhoda22@yahoo.co.uk');
  assert.equal(normalizeEmail(''), '');
  assert.equal(normalizeEmail('not-an-email'), null);
});

test('sizes and brands are normalised', () => {
  assert.equal(parseSizeLitres('6L'), 6);
  assert.equal(parseSizeLitres('6.5 litres'), 6.5);
  assert.equal(parseSizeLitres('big'), null);
  assert.equal(canonicalBrand('Pixels', ['Pixel']), 'Pixel');
  assert.equal(canonicalBrand('SimbaLand', ['Simbaland']), 'Simbaland');
  assert.equal(canonicalBrand(' ECO QUICKPOT', []), 'ECO QUICKPOT');
});

test('quantities accept spreadsheet whole numbers like "150.0" but never round fractions', () => {
  assert.equal(parseQuantity('150'), 150);
  assert.equal(parseQuantity('150.0'), 150);
  assert.equal(parseQuantity('1,057.00'), 1057);
  assert.equal(parseQuantity('150.5'), null);
  assert.equal(parseQuantity('-3'), null);
  assert.equal(parseQuantity(''), null);
});

test('period labels from the sales sheet become whole-month date ranges', () => {
  const q1 = periodFromLabel('Jan-March', 2025);
  assert.equal(q1.periodLabel, 'Jan–Mar 2025');
  assert.equal(q1.periodStart, '2025-01-01T00:00:00.000Z');
  assert.equal(q1.periodEnd, '2025-03-31T23:59:59.000Z');
  assert.equal(periodFromLabel('April-Nov', 2025).periodLabel, 'Apr–Nov 2025');
  assert.equal(periodFromLabel('Sep–Nov', 2025).periodEnd, '2025-11-30T23:59:59.000Z');
  assert.equal(periodFromLabel('Nov-Jan', 2025), null);
  assert.equal(periodFromLabel('Jan-March', 'x'), null);
});

test('sales sheet parser carries the company forward and reports bad rows', () => {
  const table = [
    ['EPCs SOLD BY DIFFERENT COMPANIES', '', '', '', '', '', ''],
    ['No.', 'Company', 'Reporting Period', 'Brand', 'Product', 'Size', 'Quantity'],
    ['1', 'Eco-Group Ltd', 'Jan-March', ' ECO QUICKPOT', 'EPC', '6L', '150'],
    ['', '', 'Jan-March', ' ECO QUICKPOT', 'EPC', '8L', '86'],
    ['', '', '', '', '', '', ''],
    ['11', 'Biogas Solutions Ltd', 'April-Nov', 'Digi Wave', '', '7L', '48'],
    ['', '', 'April-Nov', 'Digi Wave', 'EPC', '7L', 'many'],
  ];
  const { rows, errors } = parseCompanySalesSheet(table, { year: 2025 });
  assert.equal(rows.length, 3);
  assert.equal(rows[1].companyName, 'Eco-Group Ltd');
  assert.equal(rows[1].quantity, 86);
  assert.equal(rows[2].product, 'EPC', 'blank product defaults to EPC');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 7);
});

test('summary totals by company, brand, size and period', () => {
  const companies = [{ $id: 'a', name: 'Wana' }, { $id: 'b', name: 'UpEnergy' }];
  const sales = [
    { companyId: 'a', brand: 'Tefal', sizeLitres: 6, quantity: 1408, periodLabel: 'Jan–Mar 2025', periodStart: '2025-01-01' },
    { companyId: 'a', brand: 'Tefal', sizeLitres: 6, quantity: 1593, periodLabel: 'Apr–Nov 2025', periodStart: '2025-04-01' },
    { companyId: 'b', brand: 'PowerUP', sizeLitres: 6, quantity: 316, periodLabel: 'Jan–Mar 2025', periodStart: '2025-01-01' },
  ];
  const s = summarizeCompanySales(sales, companies);
  assert.equal(s.totalQuantity, 3317);
  assert.equal(s.companiesReporting, 2);
  assert.deepEqual(s.byCompany[0], { company: 'Wana', quantity: 3001 });
  assert.deepEqual(s.byPeriod.map((p) => p.period), ['Jan–Mar 2025', 'Apr–Nov 2025']);
  assert.deepEqual(s.bySize, [{ size: '6L', quantity: 3317 }]);
});

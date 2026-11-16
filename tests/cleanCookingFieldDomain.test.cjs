const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const {
  FieldValidationError,
  appendStageHistory,
  validateFieldSale,
  validateFollowUp,
  validateLead,
  validateLeadUpdate,
} = require('../lib/cleanCooking/fieldDomain');

const today = new Date().toISOString().slice(0, 10);

test('individual lead keeps one age band and drops identity without consent', () => {
  const lead = validateLead({
    clientSubmissionId: randomUUID(),
    customerType: 'individual',
    customerName: 'Jane Doe',
    customerPhone: '0772 000 111',
    consentShareIdentity: false,
    ageBand: '18_35',
    gender: 'female',
    source: 'demonstration',
    generatedOn: today,
  });
  assert.equal(lead.customerName, null, 'no name stored without consent');
  assert.equal(lead.customerPhone, null, 'no phone stored without consent');
  assert.equal(lead.ageBand, '18_35');
  assert.equal(lead.stage, 'enquiry_received');
  assert.equal(lead.institutionType, null);
});

test('institution lead records type, not age; identity kept with consent', () => {
  const lead = validateLead({
    clientSubmissionId: randomUUID(),
    customerType: 'institution',
    institutionType: 'school',
    ageBand: '36_plus',
    customerName: 'St. Mary’s PS',
    customerPhone: '0700123456',
    consentShareIdentity: true,
    consentFollowUp: true,
    source: 'community_event',
    generatedOn: today,
  });
  assert.equal(lead.ageBand, null, 'age band is for individuals only');
  assert.equal(lead.institutionType, 'school');
  assert.equal(lead.customerPhone, '+256700123456');
});

test('follow-up consent requires identity consent', () => {
  assert.throws(() => validateLead({
    clientSubmissionId: randomUUID(), customerType: 'individual', consentFollowUp: true,
    source: 'walk_in', generatedOn: today,
  }), FieldValidationError);
});

test('payment channel and financing are independent (instalments via mobile money)', () => {
  const sale = validateFieldSale({
    clientSubmissionId: randomUUID(), customerType: 'individual', saleDate: today,
    brand: 'Tefal', sizeLitres: '6', quantity: 1, unitPriceUgx: '350,000',
    paymentChannel: 'mobile_money', financing: 'instalments',
  });
  assert.equal(sale.paymentChannel, 'mobile_money');
  assert.equal(sale.financing, 'instalments');
  assert.equal(sale.unitPriceUgx, 350000);
  assert.equal(sale.sizeLitres, 6);
});

test('sales reject bad input', () => {
  const base = { clientSubmissionId: randomUUID(), customerType: 'individual', saleDate: today, brand: 'Tefal', quantity: 1, paymentChannel: 'cash', financing: 'paid_in_full' };
  assert.throws(() => validateFieldSale({ ...base, quantity: 0 }), /Quantity/);
  assert.throws(() => validateFieldSale({ ...base, paymentChannel: 'cheque' }), /Payment channel/);
  assert.throws(() => validateFieldSale({ ...base, clientSubmissionId: 'abc' }), /submission ID/);
  assert.throws(() => validateFieldSale({ ...base, saleDate: '2999-01-01' }), /future/);
});

test('lead updates cannot jump to converted without a sale', () => {
  assert.throws(() => validateLeadUpdate({ stage: 'converted_to_sale' }), /Record sale/);
  assert.deepEqual(validateLeadUpdate({ stage: 'quotation_shared' }), { stage: 'quotation_shared' });
});

test('follow-up rules', () => {
  const ok = validateFollowUp({ clientSubmissionId: randomUUID(), saleId: 's1', conductedOn: today, method: 'phone_call', usageStatus: 'regular_use', usageFrequency: 'daily', barriers: ['none'] });
  assert.equal(ok.usageFrequency, 'daily');
  const notReached = validateFollowUp({ clientSubmissionId: randomUUID(), saleId: 's1', conductedOn: today, method: 'visit', usageStatus: 'not_reached', barriers: ['broken'] });
  assert.equal(notReached.usageFrequency, null);
  assert.deepEqual(notReached.barriers, []);
  assert.throws(() => validateFollowUp({ clientSubmissionId: randomUUID(), saleId: 's1', conductedOn: today, method: 'visit', usageStatus: 'regular_use', usageFrequency: 'daily', barriers: ['none', 'broken'] }), /No problems/);
});

test('stage history stays bounded', () => {
  let json = '[]';
  for (let i = 0; i < 200; i += 1) json = appendStageHistory(json, { to: 'quotation_shared', at: new Date().toISOString(), by: 'x'.repeat(20) });
  assert.ok(json.length <= 5800);
  assert.ok(JSON.parse(json).length > 10);
});

test('field summary counts only non-rejected sales, verified separately, and latest follow-up per sale', () => {
  const { summarizeFieldActivity } = require('../lib/cleanCooking/fieldDomain');
  const s = summarizeFieldActivity({
    sales: [
      { $id: 'a', district: 'Kabale', quantity: 2, verificationStatus: 'verified' },
      { $id: 'b', district: 'Kabale', quantity: 1, verificationStatus: 'submitted' },
      { $id: 'c', district: 'Mbale', quantity: 5, verificationStatus: 'rejected' },
    ],
    leads: [
      { district: 'Kabale', stage: 'converted_to_sale' },
      { district: 'Kabale', stage: 'enquiry_received' },
      { district: 'Mbale', stage: 'closed_without_sale' },
      { district: 'Mbale', stage: 'quotation_shared' },
    ],
    followups: [
      { saleId: 'a', usageStatus: 'not_in_use', conductedOn: '2026-01-01' },
      { saleId: 'a', usageStatus: 'regular_use', conductedOn: '2026-02-01' },
      { saleId: 'b', usageStatus: 'not_reached', conductedOn: '2026-02-01' },
    ],
  });
  assert.equal(s.sales.submittedQuantity, 3, 'rejected sale excluded');
  assert.equal(s.sales.verifiedQuantity, 2);
  assert.equal(s.sales.awaitingReview, 1);
  assert.equal(s.leads.conversionRate, 0.25);
  assert.equal(s.adoption.customersReached, 1, 'not_reached ignored, repeat visits counted once');
  assert.equal(s.adoption.inUseRate, 1, 'latest follow-up wins');
  assert.equal(s.byDistrict[0].district, 'Kabale');
});

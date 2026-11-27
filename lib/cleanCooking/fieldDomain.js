/**
 * Validation for champion field submissions (leads, sales, follow-ups).
 * Pure functions — unit tested in tests/cleanCookingFieldDomain.test.cjs.
 * Each validator returns clean fields or throws FieldValidationError.
 */

const { cleanText, normalizeUgPhone, parseSizeLitres } = require('./domain');
const { values, OPEN_LEAD_STAGES } = require('./fieldOptions');

class FieldValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FieldValidationError';
  }
}

const fail = (message) => { throw new FieldValidationError(message); };

function oneOf(key, value, label, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) fail(`${label} is required.`);
    return null;
  }
  if (!values(key).includes(value)) fail(`${label} is not a valid choice.`);
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function submissionId(value) {
  const id = cleanText(value, 64);
  if (!UUID_RE.test(id)) fail('Missing submission ID. Please reload the form.');
  return id.toLowerCase();
}

/** A calendar date (YYYY-MM-DD or ISO), not in the future beyond today, not before 2020. */
function pastDate(value, label, { allowFuture = false } = {}) {
  const text = cleanText(value, 40);
  if (!text) fail(`${label} is required.`);
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00.000Z` : text);
  if (Number.isNaN(date.getTime())) fail(`${label} is not a valid date.`);
  if (date.getUTCFullYear() < 2020) fail(`${label} is too far in the past.`);
  const tomorrow = Date.now() + 36 * 3600 * 1000;
  if (!allowFuture && date.getTime() > tomorrow) fail(`${label} cannot be in the future.`);
  return date.toISOString();
}

function futureDate(value, label) {
  const text = cleanText(value, 40);
  if (!text) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00.000Z` : text);
  if (Number.isNaN(date.getTime())) fail(`${label} is not a valid date.`);
  return date.toISOString();
}

/**
 * Customer block shared by leads and sales.
 * - Age band: individuals only, single choice (review comment 2).
 * - Institutions record type + the contact person's role instead.
 * - Name/phone are kept ONLY with consent to share identity; otherwise the
 *   record is anonymised (review comment 5).
 */
function customerFields(body) {
  const customerType = oneOf('customerType', body.customerType, 'Customer type');
  const consentShareIdentity = body.consentShareIdentity === true;
  const consentFollowUp = body.consentFollowUp === true;
  const fields = {
    customerType,
    consentShareIdentity,
    consentFollowUp,
    customerName: null,
    customerPhone: null,
    gender: null,
    ageBand: null,
    institutionType: null,
    contactPersonRole: null,
  };

  if (customerType === 'individual') {
    fields.gender = oneOf('gender', body.gender, 'Gender', { required: false });
    fields.ageBand = oneOf('ageBand', body.ageBand || 'unknown', 'Age group');
  } else {
    fields.institutionType = oneOf('institutionType', body.institutionType, 'Type of institution');
    fields.contactPersonRole = cleanText(body.contactPersonRole, 100) || null;
  }

  if (consentShareIdentity) {
    fields.customerName = cleanText(body.customerName, 160) || null;
    if (body.customerPhone) {
      const phone = normalizeUgPhone(body.customerPhone);
      if (!phone) fail('Customer phone number is not a valid Ugandan number.');
      fields.customerPhone = phone;
    }
    if (!fields.customerName && !fields.customerPhone) fail('Add the customer’s name or phone, or record without identity.');
  }
  if (consentFollowUp && !fields.customerPhone && consentShareIdentity === false) {
    // Follow-up contact needs a way to reach them.
    fail('To follow up later we need permission to keep the customer’s phone number.');
  }
  return fields;
}

function validateLead(body = {}) {
  const stage = oneOf('leadStage', body.stage || 'enquiry_received', 'Stage');
  if (!OPEN_LEAD_STAGES.includes(stage)) fail('A new lead must start at an open stage. Record the sale separately.');
  return {
    clientSubmissionId: submissionId(body.clientSubmissionId),
    ...customerFields(body),
    source: oneOf('leadSource', body.source, 'How the lead was found'),
    sourceDetail: cleanText(body.sourceDetail, 300) || null,
    generatedOn: pastDate(body.generatedOn, 'Date'),
    location: cleanText(body.location, 160) || null,
    stage,
    mainBarrier: oneOf('mainBarrier', body.mainBarrier || 'none', 'Main barrier'),
    nextAction: cleanText(body.nextAction, 300) || null,
    followUpDate: futureDate(body.followUpDate, 'Follow-up date'),
    notes: cleanText(body.notes, 500) || null,
  };
}

/** Partial update of an existing lead's progress (not its customer details). */
function validateLeadUpdate(body = {}) {
  const fields = {};
  if (body.stage !== undefined) {
    fields.stage = oneOf('leadStage', body.stage, 'Stage');
    if (fields.stage === 'converted_to_sale') fail('Use “Record sale” to convert a lead — the sale links to it automatically.');
  }
  if (body.mainBarrier !== undefined) fields.mainBarrier = oneOf('mainBarrier', body.mainBarrier, 'Main barrier');
  if (body.nextAction !== undefined) fields.nextAction = cleanText(body.nextAction, 300) || null;
  if (body.followUpDate !== undefined) fields.followUpDate = futureDate(body.followUpDate, 'Follow-up date');
  if (body.notes !== undefined) fields.notes = cleanText(body.notes, 500) || null;
  if (!Object.keys(fields).length) fail('Nothing to update.');
  return fields;
}

function validateFieldSale(body = {}) {
  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) fail('Quantity must be a whole number of at least 1.');
  let sizeLitres = null;
  if (body.sizeLitres !== undefined && body.sizeLitres !== null && body.sizeLitres !== '') {
    sizeLitres = parseSizeLitres(body.sizeLitres);
    if (sizeLitres === null) fail('Size must be a number of litres, e.g. 6.');
  }
  let unitPriceUgx = null;
  if (body.unitPriceUgx !== undefined && body.unitPriceUgx !== null && body.unitPriceUgx !== '') {
    unitPriceUgx = Number(String(body.unitPriceUgx).replace(/[,\s]/g, ''));
    if (!Number.isInteger(unitPriceUgx) || unitPriceUgx < 0 || unitPriceUgx > 100000000) fail('Price must be a whole number of shillings.');
  }
  const brand = cleanText(body.brand, 100);
  if (!brand) fail('Brand is required.');
  return {
    clientSubmissionId: submissionId(body.clientSubmissionId),
    ...customerFields(body),
    leadId: cleanText(body.leadId, 64) || null,
    saleDate: pastDate(body.saleDate, 'Sale date'),
    location: cleanText(body.location, 160) || null,
    brand,
    model: cleanText(body.model, 100) || null,
    sizeLitres,
    quantity,
    unitPriceUgx,
    supplierCompanyId: cleanText(body.supplierCompanyId, 64) || null,
    paymentChannel: oneOf('paymentChannel', body.paymentChannel, 'Payment channel'),
    financing: oneOf('financing', body.financing, 'Financing arrangement'),
    notes: cleanText(body.notes, 500) || null,
  };
}

function validateFollowUp(body = {}) {
  const usageStatus = oneOf('usageStatus', body.usageStatus, 'Usage');
  const inUse = usageStatus === 'regular_use' || usageStatus === 'occasional_use';
  const barriers = Array.isArray(body.barriers) ? [...new Set(body.barriers)] : [];
  for (const b of barriers) if (!values('usageBarrier').includes(b)) fail('One of the problems is not a valid choice.');
  if (barriers.includes('none') && barriers.length > 1) fail('“No problems” cannot be combined with other problems.');
  const saleId = cleanText(body.saleId, 64);
  if (!saleId) fail('Choose the sale you followed up.');
  return {
    clientSubmissionId: submissionId(body.clientSubmissionId),
    saleId,
    conductedOn: pastDate(body.conductedOn, 'Follow-up date'),
    method: oneOf('followUpMethod', body.method, 'How you followed up'),
    usageStatus,
    usageFrequency: inUse ? oneOf('usageFrequency', body.usageFrequency, 'How often') : null,
    barriers: usageStatus === 'not_reached' ? [] : barriers.slice(0, 8),
    notes: cleanText(body.notes, 500) || null,
  };
}

/** Append a stage change to the lead's JSON history (kept small). */
function appendStageHistory(historyJson, entry) {
  let history = [];
  try { history = JSON.parse(historyJson || '[]'); } catch { history = []; }
  if (!Array.isArray(history)) history = [];
  history.push(entry);
  let json = JSON.stringify(history);
  while (json.length > 5800 && history.length > 1) { history.shift(); json = JSON.stringify(history); }
  return json;
}

/**
 * Dashboard figures for champion field work.
 * - Sales: rejected ones never count; only VERIFIED count as results.
 * - Lead conversion = converted / all leads.
 * - Adoption uses each sale's LATEST reached follow-up, so repeat visits do not inflate it.
 */
function summarizeFieldActivity({ sales = [], leads = [], followups = [] } = {}) {
  const live = sales.filter((s) => s.verificationStatus !== 'rejected');
  const qty = (list) => list.reduce((n, s) => n + (Number(s.quantity) || 0), 0);
  const verified = live.filter((s) => s.verificationStatus === 'verified');

  const byStage = {};
  for (const l of leads) byStage[l.stage] = (byStage[l.stage] || 0) + 1;
  const converted = byStage.converted_to_sale || 0;

  const latestBySale = new Map();
  for (const f of followups) {
    if (f.usageStatus === 'not_reached') continue;
    const prev = latestBySale.get(f.saleId);
    if (!prev || f.conductedOn > prev.conductedOn) latestBySale.set(f.saleId, f);
  }
  const reached = [...latestBySale.values()];
  const inUse = reached.filter((f) => f.usageStatus === 'regular_use' || f.usageStatus === 'occasional_use').length;

  const districts = new Map();
  const row = (d) => {
    if (!districts.has(d)) districts.set(d, { district: d, leads: 0, salesSubmitted: 0, salesVerified: 0 });
    return districts.get(d);
  };
  for (const l of leads) row(l.district).leads += 1;
  for (const s of live) {
    row(s.district).salesSubmitted += Number(s.quantity) || 0;
    if (s.verificationStatus === 'verified') row(s.district).salesVerified += Number(s.quantity) || 0;
  }

  return {
    sales: {
      submittedQuantity: qty(live),
      verifiedQuantity: qty(verified),
      awaitingReview: live.filter((s) => s.verificationStatus === 'submitted' || s.verificationStatus === 'needs_review').length,
      records: live.length,
    },
    leads: {
      total: leads.length,
      byStage,
      converted,
      conversionRate: leads.length ? converted / leads.length : null,
    },
    adoption: {
      customersReached: reached.length,
      inUse,
      inUseRate: reached.length ? inUse / reached.length : null,
    },
    byDistrict: [...districts.values()].sort((a, b) => b.salesSubmitted - a.salesSubmitted || b.leads - a.leads),
  };
}

module.exports = {
  FieldValidationError,
  appendStageHistory,
  summarizeFieldActivity,
  validateFieldSale,
  validateFollowUp,
  validateLead,
  validateLeadUpdate,
};

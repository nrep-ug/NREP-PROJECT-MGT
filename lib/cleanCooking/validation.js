import { HttpError } from '@/lib/serverAuth';
import { cleanText, normalizeEmail, normalizeUgPhone, parseQuantity, parseSizeLitres } from './domain';

function phoneField(value) {
  const phone = normalizeUgPhone(value);
  if (phone === null) throw new HttpError(400, 'Phone number is not a valid Ugandan number.', 'VALIDATION_ERROR');
  return phone || null;
}

function emailField(value) {
  const email = normalizeEmail(value);
  if (email === null) throw new HttpError(400, 'Email address is not valid.', 'VALIDATION_ERROR');
  return email || null;
}

function enumField(value, allowed, label) {
  if (!allowed.includes(value)) throw new HttpError(400, `Invalid ${label}.`, 'VALIDATION_ERROR');
  return value;
}

/** Whitelist + validate company fields. Only keys present in body are returned. */
export function companyFields(body = {}) {
  const fields = {};
  if (body.name !== undefined) {
    fields.name = cleanText(body.name);
    if (!fields.name) throw new HttpError(400, 'Company name is required.', 'VALIDATION_ERROR');
  }
  if (body.contactName !== undefined) fields.contactName = cleanText(body.contactName, 160) || null;
  if (body.district !== undefined) fields.district = cleanText(body.district, 100) || null;
  if (body.phone !== undefined) fields.phone = phoneField(body.phone);
  if (body.email !== undefined) fields.email = emailField(body.email);
  if (body.status !== undefined) fields.status = enumField(body.status, ['active', 'inactive'], 'status');
  return fields;
}

/** Whitelist + validate champion fields. */
export function championFields(body = {}) {
  const fields = {};
  if (body.fullName !== undefined) {
    fields.fullName = cleanText(body.fullName);
    if (!fields.fullName) throw new HttpError(400, 'Full name is required.', 'VALIDATION_ERROR');
  }
  if (body.district !== undefined) {
    fields.district = cleanText(body.district, 100);
    if (!fields.district) throw new HttpError(400, 'District is required.', 'VALIDATION_ERROR');
  }
  if (body.phone !== undefined) fields.phone = phoneField(body.phone);
  if (body.email !== undefined) fields.email = emailField(body.email);
  if (body.gender !== undefined) fields.gender = enumField(body.gender, ['female', 'male', 'unspecified'], 'gender');
  if (body.isDistrictLead !== undefined) fields.isDistrictLead = Boolean(body.isDistrictLead);
  if (body.status !== undefined) fields.status = enumField(body.status, ['active', 'inactive'], 'status');
  if (body.notes !== undefined) fields.notes = cleanText(body.notes, 500) || null;
  return fields;
}

/** Whitelist + validate a single company-sales record (period dates are ISO strings). */
export function saleFields(body = {}, { partial = false } = {}) {
  const fields = {};
  const need = (key) => !partial || body[key] !== undefined;
  if (need('companyId')) {
    fields.companyId = cleanText(body.companyId, 64);
    if (!fields.companyId) throw new HttpError(400, 'Company is required.', 'VALIDATION_ERROR');
  }
  if (need('periodLabel')) {
    fields.periodLabel = cleanText(body.periodLabel, 64);
    if (!fields.periodLabel) throw new HttpError(400, 'Reporting period is required.', 'VALIDATION_ERROR');
  }
  for (const key of ['periodStart', 'periodEnd']) {
    if (!need(key)) continue;
    const date = new Date(body[key]);
    if (!body[key] || Number.isNaN(date.getTime())) {
      throw new HttpError(400, 'Reporting period start and end dates are required.', 'VALIDATION_ERROR');
    }
    fields[key] = date.toISOString();
  }
  if (fields.periodStart && fields.periodEnd && fields.periodEnd < fields.periodStart) {
    throw new HttpError(400, 'Period end must be after the start.', 'VALIDATION_ERROR');
  }
  if (need('brand')) {
    fields.brand = cleanText(body.brand, 100);
    if (!fields.brand) throw new HttpError(400, 'Brand is required.', 'VALIDATION_ERROR');
  }
  if (body.product !== undefined || !partial) fields.product = cleanText(body.product, 64) || 'EPC';
  if (body.sizeLitres !== undefined && body.sizeLitres !== '' && body.sizeLitres !== null) {
    const size = parseSizeLitres(body.sizeLitres);
    if (size === null) throw new HttpError(400, 'Size must be a number of litres, e.g. 6.', 'VALIDATION_ERROR');
    fields.sizeLitres = size;
  } else if (body.sizeLitres !== undefined) {
    fields.sizeLitres = null;
  }
  if (need('quantity')) {
    const quantity = parseQuantity(body.quantity);
    if (quantity === null) throw new HttpError(400, 'Quantity must be a whole number.', 'VALIDATION_ERROR');
    fields.quantity = quantity;
  }
  if (body.notes !== undefined) fields.notes = cleanText(body.notes, 500) || null;
  return fields;
}

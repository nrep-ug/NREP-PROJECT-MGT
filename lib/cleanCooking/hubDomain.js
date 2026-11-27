/**
 * Clean cooking hubs: places around the country linked to clean cooking
 * development (briquette making, solar milling, EPC demonstrations…).
 * Pure functions — unit tested in tests/cleanCookingHubDomain.test.cjs.
 *
 * Options are DRAFT until M&E approves; adding values later is safe,
 * renaming existing values is not (they are stored in the database).
 */

const { cleanText, normalizeEmail, normalizeUgPhone } = require('./domain');

const opt = (value, label, icon) => ({ value, label, icon });

const HUB_OPTIONS = {
  // DRAFT labels — confirm wording with M&E.
  context: [
    { value: 'humanitarian', label: 'Humanitarian (refugee settlement)', short: 'Humanitarian', icon: 'bi-shield-plus' },
    { value: 'development', label: 'Development (host/rural community)', short: 'Development', icon: 'bi-tree' },
  ],
  activity: [
    opt('briquette_making', 'Briquette making', 'bi-bricks'),
    opt('solar_lighting', 'Solar lights', 'bi-lightbulb'),
    opt('solar_milling', 'Solar milling', 'bi-gear-wide-connected'),
    opt('epc_demonstration', 'EPC demonstrations & sales', 'bi-fire'),
    opt('improved_cookstoves', 'Improved cookstoves', 'bi-cup-hot'),
    opt('biogas', 'Biogas', 'bi-droplet-half'),
    opt('solar_drying', 'Solar drying', 'bi-sun'),
    opt('solar_water_pumping', 'Solar water pumping', 'bi-water'),
    opt('cold_storage', 'Solar cold storage', 'bi-snow'),
    opt('phone_charging', 'Phone charging', 'bi-phone'),
    opt('training', 'Training & awareness', 'bi-mortarboard'),
    opt('repairs', 'Repairs & after-sales', 'bi-tools'),
    opt('other', 'Other', 'bi-three-dots'),
  ],
  status: [
    opt('planned', 'Planned'),
    opt('setting_up', 'Setting up'),
    opt('operational', 'Operational'),
    opt('inactive', 'Not active'),
  ],
  gender: [
    opt('female', 'Female'),
    opt('male', 'Male'),
    opt('unspecified', 'Not stated'),
  ],
};

const hubValues = (key) => HUB_OPTIONS[key].map((o) => o.value);
const hubLabel = (key, value) => HUB_OPTIONS[key]?.find((o) => o.value === value)?.label || value || '—';

class HubValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HubValidationError';
  }
}
const fail = (message) => { throw new HubValidationError(message); };

function count(value, label) {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isInteger(n) || n < 0 || n > 1000000) fail(`${label} must be a whole number.`);
  return n;
}

/**
 * Whitelist + validate hub fields. With partial=true only keys present in
 * the body are returned (for PATCH).
 */
function validateHub(body = {}, { partial = false } = {}) {
  const fields = {};
  const has = (key) => body[key] !== undefined;
  const need = (key) => !partial || has(key);

  if (need('name')) {
    fields.name = cleanText(body.name, 160);
    if (!fields.name) fail('Hub name is required.');
  }
  if (need('district')) {
    fields.district = cleanText(body.district, 100);
    if (!fields.district) fail('District is required.');
  }
  if (has('location')) fields.location = cleanText(body.location, 200) || null;

  if (need('context')) {
    if (!hubValues('context').includes(body.context)) fail('Choose whether the hub is humanitarian or development.');
    fields.context = body.context;
  }

  if (need('status')) {
    const status = body.status || 'operational';
    if (!hubValues('status').includes(status)) fail('Status is not a valid choice.');
    fields.status = status;
  }

  if (need('activities')) {
    const list = Array.isArray(body.activities) ? [...new Set(body.activities)] : [];
    if (list.length === 0) fail('Choose at least one activity done at the hub.');
    if (list.some((a) => !hubValues('activity').includes(a))) fail('One of the activities is not a valid choice.');
    fields.activities = list;
  }
  if (has('otherActivity')) fields.otherActivity = cleanText(body.otherActivity, 200) || null;
  if (fields.activities?.includes('other') && !fields.otherActivity && !partial) {
    fail('Describe the "Other" activity.');
  }

  if (need('managerName')) {
    fields.managerName = cleanText(body.managerName, 160);
    if (!fields.managerName) fail('Name of the person managing the hub is required.');
  }
  if (has('managerPhone')) {
    const phone = normalizeUgPhone(body.managerPhone);
    if (phone === null) fail('Manager phone is not a valid Ugandan number.');
    fields.managerPhone = phone || null;
  }
  if (has('managerEmail')) {
    const email = normalizeEmail(body.managerEmail);
    if (email === null) fail('Manager email is not valid.');
    fields.managerEmail = email || null;
  }
  if (has('managerGender')) {
    const gender = body.managerGender || 'unspecified';
    if (!hubValues('gender').includes(gender)) fail('Manager gender is not a valid choice.');
    fields.managerGender = gender;
  }

  for (const [key, label] of [
    ['peopleWorking', 'People working at the hub'],
    ['womenWorking', 'Women working at the hub'],
    ['youthWorking', 'Youth working at the hub'],
    ['householdsServed', 'Households served'],
  ]) {
    if (need(key)) fields[key] = count(body[key], label);
  }
  // Humanitarian hubs record the settlement and may split households into
  // refugee and host community; development hubs carry neither.
  if (fields.context === 'development') {
    fields.settlementName = null;
    fields.refugeeHouseholdsServed = 0;
    fields.hostHouseholdsServed = 0;
  } else if (fields.context === 'humanitarian') {
    fields.settlementName = cleanText(body.settlementName, 120) || null;
    if (!fields.settlementName) fail('Name the refugee settlement the hub serves.');
    fields.refugeeHouseholdsServed = count(body.refugeeHouseholdsServed, 'Refugee households served');
    fields.hostHouseholdsServed = count(body.hostHouseholdsServed, 'Host community households served');
    const split = fields.refugeeHouseholdsServed + fields.hostHouseholdsServed;
    if (split > 0 && fields.householdsServed !== undefined && split !== fields.householdsServed) {
      fail('Refugee and host community households must add up to the households served.');
    }
  }

  const people = fields.peopleWorking;
  if (people !== undefined) {
    if (fields.womenWorking > people) fail('Women working cannot be more than the total people working.');
    if (fields.youthWorking > people) fail('Youth working cannot be more than the total people working.');
  }

  if (has('establishedOn')) {
    const text = cleanText(body.establishedOn, 40);
    if (!text) {
      fields.establishedOn = null;
    } else {
      const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00.000Z` : text);
      if (Number.isNaN(date.getTime())) fail('Date established is not a valid date.');
      fields.establishedOn = date.toISOString();
    }
  }
  if (has('notes')) fields.notes = cleanText(body.notes, 500) || null;
  return fields;
}

/** Headline indicators for the hubs list. */
function summarizeHubs(hubs = []) {
  const live = hubs.filter((h) => h.status !== 'inactive');
  const byActivity = new Map();
  const districts = new Set();
  let people = 0;
  let women = 0;
  let youth = 0;
  let households = 0;
  let refugeeHouseholds = 0;
  let hostHouseholds = 0;
  const settlements = new Set();
  for (const hub of live) {
    if (hub.context === 'humanitarian') {
      if (hub.settlementName) settlements.add(hub.settlementName.trim().toLowerCase());
      refugeeHouseholds += hub.refugeeHouseholdsServed || 0;
      hostHouseholds += hub.hostHouseholdsServed || 0;
    }
    districts.add(hub.district);
    people += hub.peopleWorking || 0;
    women += hub.womenWorking || 0;
    youth += hub.youthWorking || 0;
    households += hub.householdsServed || 0;
    for (const a of hub.activities || []) byActivity.set(a, (byActivity.get(a) || 0) + 1);
  }
  return {
    total: hubs.length,
    operational: hubs.filter((h) => h.status === 'operational').length,
    districts: districts.size,
    peopleWorking: people,
    womenWorking: women,
    youthWorking: youth,
    householdsServed: households,
    womenLedHubs: live.filter((h) => h.managerGender === 'female').length,
    humanitarianHubs: hubs.filter((h) => h.context === 'humanitarian').length,
    developmentHubs: hubs.filter((h) => h.context === 'development').length,
    settlements: settlements.size,
    refugeeHouseholdsServed: refugeeHouseholds,
    hostHouseholdsServed: hostHouseholds,
    activities: [...byActivity.entries()]
      .map(([activity, hubCount]) => ({ activity, label: hubLabel('activity', activity), hubs: hubCount }))
      .sort((a, b) => b.hubs - a.hubs || a.label.localeCompare(b.label)),
  };
}

module.exports = { HUB_OPTIONS, HubValidationError, hubLabel, hubValues, summarizeHubs, validateHub };

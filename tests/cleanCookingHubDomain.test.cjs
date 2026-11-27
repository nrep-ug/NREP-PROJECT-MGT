const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeHubs, validateHub, HubValidationError } = require('../lib/cleanCooking/hubDomain');

const base = {
  name: '  Kabale Energy Hub ', district: 'Kabale', context: 'development', activities: ['briquette_making', 'solar_milling'],
  managerName: 'Jane A', managerPhone: '0700 123 456', peopleWorking: '12', womenWorking: '7', youthWorking: '5',
};

test('a valid hub is cleaned and normalised', () => {
  const hub = validateHub(base);
  assert.equal(hub.name, 'Kabale Energy Hub');
  assert.equal(hub.status, 'operational');
  assert.equal(hub.managerPhone, '+256700123456');
  assert.deepEqual(hub.activities, ['briquette_making', 'solar_milling']);
  assert.equal(hub.peopleWorking, 12);
  assert.equal(hub.householdsServed, 0);
});

test('hub needs a name, district, manager and at least one known activity', () => {
  assert.throws(() => validateHub({ ...base, name: '' }), HubValidationError);
  assert.throws(() => validateHub({ ...base, district: '' }), /District/);
  assert.throws(() => validateHub({ ...base, managerName: ' ' }), /managing/);
  assert.throws(() => validateHub({ ...base, activities: [] }), /at least one/);
  assert.throws(() => validateHub({ ...base, activities: ['juggling'] }), /not a valid/);
  assert.throws(() => validateHub({ ...base, activities: ['other'] }), /Other/);
  assert.equal(validateHub({ ...base, activities: ['other'], otherActivity: 'Tree nursery' }).otherActivity, 'Tree nursery');
});

test('women or youth cannot exceed people working, and counts must be whole numbers', () => {
  assert.throws(() => validateHub({ ...base, womenWorking: '13' }), /Women/);
  assert.throws(() => validateHub({ ...base, youthWorking: '20' }), /Youth/);
  assert.throws(() => validateHub({ ...base, peopleWorking: '2.5' }), /whole number/);
});

test('summary counts only active hubs for people and activities', () => {
  const s = summarizeHubs([
    { district: 'Kabale', status: 'operational', activities: ['briquette_making', 'solar_milling'], peopleWorking: 10, womenWorking: 6, youthWorking: 2, householdsServed: 100, managerGender: 'female' },
    { district: 'Mbale', status: 'setting_up', activities: ['briquette_making'], peopleWorking: 4, womenWorking: 1, youthWorking: 4, householdsServed: 0, managerGender: 'male' },
    { district: 'Gulu', status: 'inactive', activities: ['solar_lighting'], peopleWorking: 50, householdsServed: 999 },
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.operational, 1);
  assert.equal(s.districts, 2);
  assert.equal(s.peopleWorking, 14);
  assert.equal(s.householdsServed, 100);
  assert.equal(s.womenLedHubs, 1);
  assert.deepEqual(s.activities.map((a) => [a.activity, a.hubs]), [['briquette_making', 2], ['solar_milling', 1]]);
});

const camp = {
  ...base, name: 'Nakivale Hub', district: 'Isingiro', context: 'humanitarian', settlementName: ' Nakivale ',
  householdsServed: '300', refugeeHouseholdsServed: '220', hostHouseholdsServed: '80',
};

test('every hub must say whether it is humanitarian or development', () => {
  assert.throws(() => validateHub({ ...base, context: undefined }), /humanitarian or development/);
  assert.throws(() => validateHub({ ...base, context: 'emergency' }), /humanitarian or development/);
});

test('humanitarian hubs need a settlement and a split that adds up', () => {
  const hub = validateHub(camp);
  assert.equal(hub.context, 'humanitarian');
  assert.equal(hub.settlementName, 'Nakivale');
  assert.equal(hub.refugeeHouseholdsServed, 220);
  assert.equal(hub.hostHouseholdsServed, 80);
  assert.throws(() => validateHub({ ...camp, settlementName: '' }), /settlement/);
  assert.throws(() => validateHub({ ...camp, hostHouseholdsServed: '50' }), /add up/);
  const noSplit = validateHub({ ...camp, refugeeHouseholdsServed: '', hostHouseholdsServed: '' });
  assert.equal(noSplit.refugeeHouseholdsServed + noSplit.hostHouseholdsServed, 0);
});

test('development hubs drop any settlement or refugee split', () => {
  const hub = validateHub({ ...camp, context: 'development' });
  assert.equal(hub.settlementName, null);
  assert.equal(hub.refugeeHouseholdsServed, 0);
  assert.equal(hub.hostHouseholdsServed, 0);
});

test('summary splits hubs by type and counts settlements once', () => {
  const s = summarizeHubs([
    { district: 'Isingiro', status: 'operational', context: 'humanitarian', settlementName: 'Nakivale', householdsServed: 300, refugeeHouseholdsServed: 220, hostHouseholdsServed: 80 },
    { district: 'Isingiro', status: 'operational', context: 'humanitarian', settlementName: 'nakivale ', householdsServed: 10, refugeeHouseholdsServed: 10 },
    { district: 'Kabale', status: 'operational', context: 'development', householdsServed: 50 },
    { district: 'Yumbe', status: 'inactive', context: 'humanitarian', settlementName: 'Bidibidi', refugeeHouseholdsServed: 999 },
  ]);
  assert.equal(s.humanitarianHubs, 3);
  assert.equal(s.developmentHubs, 1);
  assert.equal(s.settlements, 1);
  assert.equal(s.refugeeHouseholdsServed, 230);
  assert.equal(s.hostHouseholdsServed, 80);
});

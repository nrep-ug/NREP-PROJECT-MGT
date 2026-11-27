const test = require('node:test');
const assert = require('node:assert/strict');
const { TRAINING_BY_LOCATION, summarizeTraining, trainingChartRows } = require('../lib/cleanCooking/trainingFigures');

test('tracker totals: NREP-trained and champion-trained are kept apart', () => {
  const s = summarizeTraining();
  assert.equal(s.locations, 11);
  assert.equal(s.trainedByNrep, 583);
  assert.equal(s.trainedByTots, 472);
  assert.equal(s.trainings, 18);
});

test('share of locations where ToTs train others matches the tracker (63.64%)', () => {
  const s = summarizeTraining();
  assert.equal(s.activeLocations, 7);
  assert.equal(Math.round(s.activeShare * 10000) / 100, 63.64);
});

test('chart rows treat "none reported" as zero and sort by total reach', () => {
  const rows = trainingChartRows([
    { location: 'A', trainedByNrep: 10, trainedByTots: null },
    { location: 'B', trainedByNrep: 5, trainedByTots: 20 },
  ]);
  assert.deepEqual(rows.map((r) => [r.location, r.trainedByTots, r.total]), [['B', 20, 25], ['A', 0, 10]]);
  assert.equal(trainingChartRows().length, TRAINING_BY_LOCATION.length);
});

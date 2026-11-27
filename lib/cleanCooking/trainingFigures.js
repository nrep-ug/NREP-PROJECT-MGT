/**
 * Clean cooking champion training, by location, from the BCCeC Master
 * Tracker (snapshot taken November 2026).
 *
 *   trainedByNrep   — "Directly Trained Champions (ToTs)": trained by NREP.
 *   trainedByTots   — "Community Trained (by ToTs)": trained by those
 *                     champions, NOT by NREP. null = none reported yet.
 *   trainings       — "Number of Trainings conducted so far".
 *
 * These are reported counts, not names, so they are kept here rather than as
 * champion records. Never add the two counts into one "trained by NREP"
 * figure.
 *
 * Open points for M&E:
 *   - "Seeta" is a town in Mukono district, not a district; it is listed
 *     separately because the tracker does.
 *   - Mukono's ToT figure (36) was partly hidden in the screenshot supplied.
 *
 * Pure data + helpers — unit tested in tests/cleanCookingTrainingFigures.test.cjs.
 */

const TRAINING_SOURCE = 'BCCeC Master Tracker, November 2026';

const row = (location, trainedByNrep, trainedByTots = null, trainings = null) => ({
  location, trainedByNrep, trainedByTots, trainings,
});

const TRAINING_BY_LOCATION = [
  row('Kabale', 39, 91, 2),
  row('Masaka', 51, 71, 2),
  row('Mbale', 42, 55, 2),
  row('Mbarara', 40, 88, 4),
  row('Ntungamo', 68, 10, 1),
  row('Jinja', 57),
  row('Hoima', 73, 44, 1),
  row('Seeta', 63),
  row('Gulu', 78),
  row('Soroti', 36),
  row('Mukono', 36, 113, 6),
];

/** Totals, plus the share of locations where ToTs have gone on to train others. */
function summarizeTraining(rows = TRAINING_BY_LOCATION) {
  const sum = (key) => rows.reduce((n, r) => n + (r[key] || 0), 0);
  const active = rows.filter((r) => (r.trainedByTots || 0) > 0).length;
  return {
    locations: rows.length,
    trainedByNrep: sum('trainedByNrep'),
    trainedByTots: sum('trainedByTots'),
    trainings: sum('trainings'),
    activeLocations: active,
    activeShare: rows.length ? active / rows.length : null,
  };
}

/** Rows for the stacked chart, largest reach first. */
function trainingChartRows(rows = TRAINING_BY_LOCATION) {
  return rows
    .map((r) => ({
      location: r.location,
      trainedByNrep: r.trainedByNrep,
      trainedByTots: r.trainedByTots || 0,
      total: r.trainedByNrep + (r.trainedByTots || 0),
    }))
    .sort((a, b) => b.total - a.total || a.location.localeCompare(b.location));
}

module.exports = { TRAINING_BY_LOCATION, TRAINING_SOURCE, summarizeTraining, trainingChartRows };

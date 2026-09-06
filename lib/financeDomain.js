const FINANCE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  RETURNED: 'returned',
  REJECTED: 'rejected',
});

const REVIEW_ACTIONS = Object.freeze(['approve', 'return', 'reject']);
const PROJECT_CURRENCIES = Object.freeze(['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS']);

const ORG_FINANCE_ROLES = Object.freeze({
  OFFICER: 'finance_officer',
  REVIEWER: 'finance_reviewer',
  BUDGET_APPROVER: 'finance_budget_approver',
  ADMIN: 'finance_admin',
});

const DEFAULT_FINANCE_SETTINGS = Object.freeze({
  monitorThresholdPercent: 75,
  nearLimitThresholdPercent: 90,
  overBudgetThresholdPercent: 100,
  varianceMaterialityPercent: 10,
  reviewSlaDays: 5,
  fiscalYearStartMonth: 1,
  allowOverBudget: false,
  requireEvidence: true,
});

const EXPENSE_CATEGORIES = Object.freeze([
  'personnel', 'travel', 'supplies', 'equipment', 'services', 'training',
  'communications', 'venue', 'other',
]);

const PAYMENT_METHODS = Object.freeze([
  'bank_transfer', 'mobile_money', 'cash', 'cheque', 'card', 'other',
]);

const MONEY_PRECISION = 100;
const FINANCE_SETTING_KEYS = Object.freeze(Object.keys(DEFAULT_FINANCE_SETTINGS));
const ACTIVE_COMMITMENT_STATUSES = new Set(['approved', 'partially_converted', 'converted']);

function domainError(message, code) {
  const error = new Error(message);
  if (code) error.code = code;
  return error;
}

function money(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * MONEY_PRECISION) / MONEY_PRECISION;
}

function positiveAmount(value, field = 'Amount') {
  const numeric = money(value);
  if (numeric <= 0) throw new Error(`${field} must be greater than zero.`);
  return numeric;
}

function assertCurrency(currency) {
  if (!PROJECT_CURRENCIES.includes(currency)) {
    throw new Error('Currency must match a supported project currency.');
  }
  return currency;
}

function normalizeRoleList(membershipRoles) {
  if (membershipRoles === undefined || membershipRoles === null) return [];
  if (!Array.isArray(membershipRoles)) {
    throw domainError('Finance roles must be provided as an array.', 'FINANCE_ROLES_INVALID');
  }
  return [...new Set(membershipRoles.map((role) => String(role || '').trim()).filter(Boolean))];
}

/**
 * Validate organization Finance role combinations without granting capabilities.
 * finance_admin is governance/read-only by itself; operational authority must
 * always be assigned explicitly.
 */
function validateOrganizationFinanceRoles(membershipRoles = []) {
  const membership = normalizeRoleList(membershipRoles);
  const known = new Set(Object.values(ORG_FINANCE_ROLES));
  const roles = membership.filter((role) => known.has(role));
  const conflicts = [];
  if (roles.includes(ORG_FINANCE_ROLES.OFFICER) && roles.includes(ORG_FINANCE_ROLES.REVIEWER)) {
    conflicts.push([ORG_FINANCE_ROLES.OFFICER, ORG_FINANCE_ROLES.REVIEWER]);
  }
  if (roles.includes(ORG_FINANCE_ROLES.OFFICER) && roles.includes(ORG_FINANCE_ROLES.BUDGET_APPROVER)) {
    conflicts.push([ORG_FINANCE_ROLES.OFFICER, ORG_FINANCE_ROLES.BUDGET_APPROVER]);
  }
  return { valid: conflicts.length === 0, membershipRoles: membership, roles, conflicts };
}

function assertValidOrganizationFinanceRoles(membershipRoles = []) {
  const validation = validateOrganizationFinanceRoles(membershipRoles);
  if (!validation.valid) {
    const combinations = validation.conflicts.map((roles) => roles.join(' + ')).join(', ');
    throw domainError(`Conflicting organization Finance roles: ${combinations}.`, 'FINANCE_ROLE_CONFLICT');
  }
  return validation;
}

function deriveOrganizationFinanceAccess(membershipRoles = []) {
  const validation = assertValidOrganizationFinanceRoles(membershipRoles);
  const has = (role) => validation.roles.includes(role);
  const isOfficer = has(ORG_FINANCE_ROLES.OFFICER);
  const isReviewer = has(ORG_FINANCE_ROLES.REVIEWER);
  const isBudgetApprover = has(ORG_FINANCE_ROLES.BUDGET_APPROVER);
  const isFinanceAdmin = has(ORG_FINANCE_ROLES.ADMIN);
  return {
    ...validation,
    isOfficer,
    isReviewer,
    isBudgetApprover,
    isFinanceAdmin,
    canViewOrganizationFinance: validation.roles.length > 0,
    canPrepareFinanceRecords: isOfficer,
    canReviewExpenses: isReviewer,
    canApproveBudgets: isBudgetApprover,
    canAdministerFinance: isFinanceAdmin,
    // Backward-compatible single-role hint for the current UI.
    financeRole: isOfficer ? 'officer' : isReviewer ? 'reviewer' : null,
  };
}

function settingValue(source, key, fallback) {
  return source && Object.prototype.hasOwnProperty.call(source, key) ? source[key] : fallback;
}

function numericSetting(source, key, fallback, { integer = false, min = 0, max = 10000 } = {}) {
  const raw = settingValue(source, key, fallback);
  if (raw === '' || raw === null || raw === undefined) {
    throw domainError(`${key} is required.`, 'FINANCE_SETTINGS_INVALID');
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value)) || value < min || value > max) {
    throw domainError(`${key} is invalid.`, 'FINANCE_SETTINGS_INVALID');
  }
  return value;
}

function booleanSetting(source, key, fallback) {
  const value = settingValue(source, key, fallback);
  if (typeof value !== 'boolean') {
    throw domainError(`${key} must be true or false.`, 'FINANCE_SETTINGS_INVALID');
  }
  return value;
}

function selectFinanceSettings(source = {}, fallback = DEFAULT_FINANCE_SETTINGS) {
  return FINANCE_SETTING_KEYS.reduce((settings, key) => {
    settings[key] = settingValue(source, key, fallback[key]);
    return settings;
  }, {});
}

function validateFinanceSettings(input = {}, current = DEFAULT_FINANCE_SETTINGS) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw domainError('Finance settings must be an object.', 'FINANCE_SETTINGS_INVALID');
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    throw domainError('Current Finance settings must be an object.', 'FINANCE_SETTINGS_INVALID');
  }
  const base = selectFinanceSettings(current, DEFAULT_FINANCE_SETTINGS);
  const candidate = selectFinanceSettings(input, base);
  const settings = {
    monitorThresholdPercent: numericSetting(candidate, 'monitorThresholdPercent', 75),
    nearLimitThresholdPercent: numericSetting(candidate, 'nearLimitThresholdPercent', 90),
    overBudgetThresholdPercent: numericSetting(candidate, 'overBudgetThresholdPercent', 100),
    varianceMaterialityPercent: numericSetting(candidate, 'varianceMaterialityPercent', 10),
    reviewSlaDays: numericSetting(candidate, 'reviewSlaDays', 5, { integer: true, min: 1, max: 3650 }),
    fiscalYearStartMonth: numericSetting(candidate, 'fiscalYearStartMonth', 1, { integer: true, min: 1, max: 12 }),
    allowOverBudget: booleanSetting(candidate, 'allowOverBudget', false),
    requireEvidence: booleanSetting(candidate, 'requireEvidence', true),
  };
  if (!(settings.monitorThresholdPercent < settings.nearLimitThresholdPercent)) {
    throw domainError('monitorThresholdPercent must be lower than nearLimitThresholdPercent.', 'FINANCE_SETTINGS_INVALID');
  }
  if (!(settings.nearLimitThresholdPercent < settings.overBudgetThresholdPercent)) {
    throw domainError('nearLimitThresholdPercent must be lower than overBudgetThresholdPercent.', 'FINANCE_SETTINGS_INVALID');
  }
  return settings;
}

function utilisationBand(percent, settings = DEFAULT_FINANCE_SETTINGS) {
  const value = Number(percent);
  if (!Number.isFinite(value)) throw domainError('Utilisation percent must be numeric.', 'UTILISATION_INVALID');
  const policy = validateFinanceSettings(settings);
  if (value >= policy.overBudgetThresholdPercent) {
    return { key: 'at_or_over_budget', status: 'at_or_over_budget', label: 'At / over budget', text: 'At or over budget', percent: value, minimumPercent: policy.overBudgetThresholdPercent };
  }
  if (value >= policy.nearLimitThresholdPercent) {
    return { key: 'near_limit', status: 'near_limit', label: 'Near limit', text: 'Near budget limit', percent: value, minimumPercent: policy.nearLimitThresholdPercent };
  }
  if (value >= policy.monitorThresholdPercent) {
    return { key: 'monitor', status: 'monitor', label: 'Monitor', text: 'Monitor budget utilisation', percent: value, minimumPercent: policy.monitorThresholdPercent };
  }
  return { key: 'normal', status: 'normal', label: 'Normal', text: 'Normal budget utilisation', percent: value, minimumPercent: 0 };
}

function parseHistory(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendHistory(value, event) {
  return JSON.stringify([...parseHistory(value), event]);
}

function canEditFinanceRecord(record, actorId) {
  return Boolean(record && record.createdBy === actorId &&
    [FINANCE_STATUSES.DRAFT, FINANCE_STATUSES.RETURNED].includes(record.status));
}

function assertReviewAction(action, comment = '') {
  if (!REVIEW_ACTIONS.includes(action)) throw new Error('Review action must be approve, return, or reject.');
  if ((action === 'return' || action === 'reject') && !String(comment || '').trim()) {
    throw new Error('A reviewer comment is required when returning or rejecting a record.');
  }
}

function nextReviewStatus(action) {
  assertReviewAction(action, action === 'approve' ? '' : 'provided');
  if (action === 'approve') return FINANCE_STATUSES.APPROVED;
  if (action === 'return') return FINANCE_STATUSES.RETURNED;
  return FINANCE_STATUSES.REJECTED;
}

function approvedAdjustmentValue(adjustment) {
  if (adjustment.status !== FINANCE_STATUSES.APPROVED) return 0;
  const amount = money(adjustment.amount);
  return adjustment.adjustmentType === 'increase' ? amount : -amount;
}

function recordId(record) {
  return record?.$id || record?.id || null;
}

function commitmentOutstandingAmount(commitment, expenditures = [], adjustments = []) {
  if (!commitment || !ACTIVE_COMMITMENT_STATUSES.has(commitment.status)) return 0;
  const commitmentId = recordId(commitment);
  if (!commitmentId) return 0;
  const linkedExpenses = expenditures.filter((expense) => (
    expense.status === FINANCE_STATUSES.APPROVED && expense.commitmentId === commitmentId &&
    (!commitment.projectId || expense.projectId === commitment.projectId) &&
    (!commitment.budgetLineId || expense.budgetLineId === commitment.budgetLineId) &&
    (!commitment.currency || expense.currency === commitment.currency)
  ));
  const linkedIds = new Set(linkedExpenses.map(recordId).filter(Boolean));
  const linkedActual = money(
    linkedExpenses.reduce((sum, expense) => sum + money(expense.amount), 0) +
    adjustments.filter((adjustment) => adjustment.status === FINANCE_STATUSES.APPROVED &&
      linkedIds.has(adjustment.originalExpenseId) &&
      (!commitment.currency || adjustment.currency === commitment.currency))
      .reduce((sum, adjustment) => sum + approvedAdjustmentValue(adjustment), 0)
  );
  return money(Math.max(money(commitment.amount) - Math.max(linkedActual, 0), 0));
}

/** Derive immutable-source budget, actual spend, commitment and balance figures. */
function calculateBudgetPerformance(
  budgetLines = [], expenditures = [], reallocations = [], adjustments = [], commitments = []
) {
  const approvedLines = budgetLines.filter((line) => line.status === FINANCE_STATUSES.APPROVED);
  const approvedExpenses = expenditures.filter((expense) => expense.status === FINANCE_STATUSES.APPROVED);
  const approvedTransfers = reallocations.filter((transfer) => transfer.status === FINANCE_STATUSES.APPROVED);

  return approvedLines.map((line) => {
    const originalBudget = money(line.originalAmount);
    const transfersIn = money(approvedTransfers.filter((transfer) => transfer.toBudgetLineId === line.$id)
      .reduce((sum, transfer) => sum + money(transfer.amount), 0));
    const transfersOut = money(approvedTransfers.filter((transfer) => transfer.fromBudgetLineId === line.$id)
      .reduce((sum, transfer) => sum + money(transfer.amount), 0));
    const baseSpend = money(approvedExpenses.filter((expense) => expense.budgetLineId === line.$id)
      .reduce((sum, expense) => sum + money(expense.amount), 0));
    const adjustmentTotal = money(adjustments.filter((adjustment) => adjustment.budgetLineId === line.$id)
      .reduce((sum, adjustment) => sum + approvedAdjustmentValue(adjustment), 0));
    const revisedBudget = money(originalBudget + transfersIn - transfersOut);
    const approvedSpend = money(baseSpend + adjustmentTotal);
    const committedAmount = money(commitments.filter((commitment) => commitment.budgetLineId === line.$id &&
      (!commitment.currency || commitment.currency === line.currency))
      .reduce((sum, commitment) => sum + commitmentOutstandingAmount(commitment, expenditures, adjustments), 0));
    const consumption = money(approvedSpend + committedAmount);
    const actualAvailableBalance = money(revisedBudget - approvedSpend);
    const availableBalance = money(revisedBudget - consumption);
    const utilisation = revisedBudget > 0 ? Math.round((consumption / revisedBudget) * 10000) / 100 : 0;
    const actualUtilisation = revisedBudget > 0 ? Math.round((approvedSpend / revisedBudget) * 10000) / 100 : 0;
    return {
      ...line,
      originalBudget, transfersIn, transfersOut, revisedBudget,
      approvedSpend, actualSpend: approvedSpend, committedAmount, consumption,
      actualAvailableBalance, availableBalance, uncommittedBalance: availableBalance,
      variance: availableBalance, utilisation, actualUtilisation,
      isOverBudget: availableBalance < 0,
      isActuallyOverBudget: actualAvailableBalance < 0,
    };
  });
}

function summarizePerformanceByCurrency(performance = [], pendingReview = []) {
  const grouped = {};
  for (const line of performance) {
    const currency = line.currency;
    if (!grouped[currency]) {
      grouped[currency] = {
        currency, originalBudget: 0, revisedBudget: 0, approvedSpend: 0,
        actualSpend: 0, committedAmount: 0, consumption: 0,
        availableBalance: 0, uncommittedBalance: 0, pendingReview: 0,
      };
    }
    const actualSpend = money(line.actualSpend ?? line.approvedSpend);
    const committedAmount = money(line.committedAmount);
    const consumption = money(line.consumption ?? (actualSpend + committedAmount));
    grouped[currency].originalBudget = money(grouped[currency].originalBudget + line.originalBudget);
    grouped[currency].revisedBudget = money(grouped[currency].revisedBudget + line.revisedBudget);
    grouped[currency].approvedSpend = money(grouped[currency].approvedSpend + actualSpend);
    grouped[currency].actualSpend = money(grouped[currency].actualSpend + actualSpend);
    grouped[currency].committedAmount = money(grouped[currency].committedAmount + committedAmount);
    grouped[currency].consumption = money(grouped[currency].consumption + consumption);
    grouped[currency].availableBalance = money(grouped[currency].availableBalance + line.availableBalance);
    grouped[currency].uncommittedBalance = grouped[currency].availableBalance;
  }
  for (const record of pendingReview) {
    if (grouped[record.currency]) grouped[record.currency].pendingReview += 1;
  }
  return Object.values(grouped).map((totals) => ({
    ...totals,
    utilisation: totals.revisedBudget > 0 ? Math.round((totals.consumption / totals.revisedBudget) * 10000) / 100 : 0,
    actualUtilisation: totals.revisedBudget > 0 ? Math.round((totals.actualSpend / totals.revisedBudget) * 10000) / 100 : 0,
  }));
}

function assertIntegerInRange(value, field, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < minimum || numeric > maximum) {
    throw domainError(`${field} must be between ${minimum} and ${maximum}.`, 'REPORTING_PERIOD_INVALID');
  }
  return numeric;
}

function normalizePeriodType(periodType) {
  const normalized = String(periodType || '').toLowerCase().replaceAll('-', '_');
  if (['year', 'financial_year', 'fiscal_year'].includes(normalized)) return 'financial_year';
  if (normalized === 'quarter') return 'quarter';
  if (normalized === 'month') return 'month';
  throw domainError('periodType must be financial_year, quarter, or month.', 'REPORTING_PERIOD_INVALID');
}

/** UTC, end-exclusive bounds; year is the year in which the financial year starts. */
function reportingPeriodBounds({ periodType, year, quarter = null, month = null, fiscalYearStartMonth = 1 } = {}) {
  const type = normalizePeriodType(periodType);
  const financialYear = assertIntegerInRange(year, 'year', 1900, 9999);
  const startMonth = assertIntegerInRange(fiscalYearStartMonth, 'fiscalYearStartMonth', 1, 12);
  let monthOffset = 0;
  let monthCount = 12;
  let selectedQuarter = null;
  let selectedMonth = null;
  if (type === 'quarter') {
    selectedQuarter = assertIntegerInRange(quarter, 'quarter', 1, 4);
    monthOffset = (selectedQuarter - 1) * 3;
    monthCount = 3;
  } else if (type === 'month') {
    selectedMonth = assertIntegerInRange(month, 'month', 1, 12);
    monthOffset = selectedMonth - 1;
    monthCount = 1;
  }
  const start = new Date(Date.UTC(financialYear, (startMonth - 1) + monthOffset, 1));
  const end = new Date(Date.UTC(financialYear, (startMonth - 1) + monthOffset + monthCount, 1));
  return {
    periodType: type, financialYear, quarter: selectedQuarter, month: selectedMonth,
    fiscalYearStartMonth: startMonth, start, end,
    startIso: start.toISOString(), endIso: end.toISOString(),
  };
}

function financialPeriodForDate(value, fiscalYearStartMonth = 1) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw domainError('Date must be valid.', 'REPORTING_DATE_INVALID');
  const startMonth = assertIntegerInRange(fiscalYearStartMonth, 'fiscalYearStartMonth', 1, 12);
  const calendarYear = date.getUTCFullYear();
  const calendarMonth = date.getUTCMonth() + 1;
  const financialYear = calendarMonth >= startMonth ? calendarYear : calendarYear - 1;
  const fiscalMonth = ((calendarMonth - startMonth + 12) % 12) + 1;
  const quarter = Math.floor((fiscalMonth - 1) / 3) + 1;
  const endYearShort = String((financialYear + 1) % 100).padStart(2, '0');
  return {
    date: date.toISOString(), calendarYear, calendarMonth, financialYear,
    financialYearEnd: financialYear + 1,
    financialYearLabel: startMonth === 1 ? `FY ${financialYear}` : `FY ${financialYear}/${endYearShort}`,
    fiscalYearStartMonth: startMonth, fiscalMonth, quarter, month: calendarMonth,
  };
}

function quarterBounds(year, quarter, fiscalYearStartMonth = 1) {
  const bounds = reportingPeriodBounds({ periodType: 'quarter', year, quarter, fiscalYearStartMonth });
  return { start: bounds.start, end: bounds.end };
}

function isWithinQuarter(dateValue, year, quarter, fiscalYearStartMonth = 1) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const { start, end } = quarterBounds(year, quarter, fiscalYearStartMonth);
  return date >= start && date < end;
}

function isWithinReportingPeriod(dateValue, period) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const bounds = reportingPeriodBounds(period);
  return date >= bounds.start && date < bounds.end;
}

function signedAdjustmentAmount(adjustment) {
  return approvedAdjustmentValue(adjustment);
}

function availableTransferBalance(performanceLine, pendingReserved = 0) {
  const balance = typeof performanceLine === 'number' ? performanceLine : performanceLine?.availableBalance;
  return money(money(balance) - money(pendingReserved));
}

function assertReallocationWithinAvailableBudget(amount, performanceLine, pendingReserved = 0) {
  const requested = positiveAmount(amount, 'Reallocation amount');
  const available = availableTransferBalance(performanceLine, pendingReserved);
  if (requested > available) {
    throw domainError(`Reallocation amount exceeds the available transferable budget of ${available}.`, 'INSUFFICIENT_AVAILABLE_BUDGET');
  }
  return requested;
}

function assertDemoCleanupTarget(record, demoSeedId) {
  const expected = String(demoSeedId || '').trim();
  if (!expected) throw domainError('A demoSeedId is required for cleanup.', 'DEMO_SEED_ID_REQUIRED');
  if (!record || record.demoSeedId !== expected) {
    throw domainError('Refusing to clean a record that was not created by this demo seed.', 'DEMO_CLEANUP_SCOPE_MISMATCH');
  }
  return record;
}

function valuesByCurrency(records, valueForRecord) {
  const grouped = {};
  for (const record of records) {
    const currency = record.currency;
    if (!currency) continue;
    grouped[currency] = money((grouped[currency] || 0) + money(valueForRecord(record)));
  }
  return grouped;
}

function currencyKeys(...groups) {
  return [...new Set(groups.flatMap((group) => Object.keys(group || {})))].sort();
}

function compareCurrencyGroups(expected, actual) {
  const byCurrency = {};
  let ok = true;
  for (const currency of currencyKeys(expected, actual)) {
    const expectedValue = money(expected[currency]);
    const actualValue = money(actual[currency]);
    const difference = money(actualValue - expectedValue);
    byCurrency[currency] = { expected: expectedValue, actual: actualValue, difference };
    if (difference !== 0) ok = false;
  }
  return { ok, byCurrency };
}

/** Reconcile a project without ever emitting a mixed-currency grand total. */
function reconcileFinanceProject({
  project = null, budgetLines = [], expenditures = [], reallocations = [],
  adjustments = [], commitments = [], year = null, quarter = null,
  fiscalYearStartMonth = DEFAULT_FINANCE_SETTINGS.fiscalYearStartMonth,
} = {}) {
  const performance = calculateBudgetPerformance(budgetLines, expenditures, reallocations, adjustments, commitments);
  const totalsByCurrency = summarizePerformanceByCurrency(performance);
  const approvedLines = budgetLines.filter((line) => line.status === FINANCE_STATUSES.APPROVED);
  const approvedTransfers = reallocations.filter((record) => record.status === FINANCE_STATUSES.APPROVED);
  const approvedExpenses = expenditures.filter((record) => record.status === FINANCE_STATUSES.APPROVED);
  const approvedAdjustments = adjustments.filter((record) => record.status === FINANCE_STATUSES.APPROVED);
  const originalByCurrency = valuesByCurrency(approvedLines, (line) => line.originalAmount);
  const revisedByCurrency = valuesByCurrency(performance, (line) => line.revisedBudget);
  const actualByCurrency = valuesByCurrency(performance, (line) => line.actualSpend);
  const committedByCurrency = valuesByCurrency(performance, (line) => line.committedAmount);
  const availableByCurrency = valuesByCurrency(performance, (line) => line.availableBalance);
  const transferInByCurrency = valuesByCurrency(approvedTransfers, (record) => record.amount);
  const transferOutByCurrency = valuesByCurrency(approvedTransfers, (record) => record.amount);
  const expectedActualByCurrency = valuesByCurrency(
    [...approvedExpenses, ...approvedAdjustments],
    (record) => record.originalExpenseId ? signedAdjustmentAmount(record) : record.amount
  );
  const expectedCommitmentByCurrency = valuesByCurrency(
    commitments.filter((record) => ACTIVE_COMMITMENT_STATUSES.has(record.status)),
    (record) => commitmentOutstandingAmount(record, expenditures, adjustments)
  );

  const lineById = new Map(approvedLines.map((line) => [recordId(line), line]));
  const expenseById = new Map(expenditures.map((expense) => [recordId(expense), expense]));
  const relationshipIssues = [];
  for (const transfer of approvedTransfers) {
    const from = lineById.get(transfer.fromBudgetLineId);
    const to = lineById.get(transfer.toBudgetLineId);
    if (!from || !to || from.currency !== transfer.currency || to.currency !== transfer.currency) {
      relationshipIssues.push({ kind: 'reallocation_currency_or_line_mismatch', id: recordId(transfer) });
    }
  }
  for (const expense of approvedExpenses) {
    const line = lineById.get(expense.budgetLineId);
    if (!line || line.currency !== expense.currency) relationshipIssues.push({ kind: 'expense_currency_or_line_mismatch', id: recordId(expense) });
  }
  for (const adjustment of approvedAdjustments) {
    const line = lineById.get(adjustment.budgetLineId);
    const expense = expenseById.get(adjustment.originalExpenseId);
    if (!line || !expense || line.currency !== adjustment.currency || expense.currency !== adjustment.currency) {
      relationshipIssues.push({ kind: 'adjustment_currency_or_link_mismatch', id: recordId(adjustment) });
    }
  }
  for (const commitment of commitments.filter((record) => ACTIVE_COMMITMENT_STATUSES.has(record.status))) {
    const line = lineById.get(commitment.budgetLineId);
    if (!line || line.currency !== commitment.currency) relationshipIssues.push({ kind: 'commitment_currency_or_line_mismatch', id: recordId(commitment) });
  }

  const projectCurrency = project?.budgetCurrency || null;
  const projectBudgetApplicable = Boolean(project && project.budgetAmount !== undefined && project.budgetAmount !== null && projectCurrency);
  const projectBudgetActual = projectCurrency ? money(originalByCurrency[projectCurrency]) : 0;
  const unexpectedProjectCurrencies = Object.keys(originalByCurrency).filter((currency) => currency !== projectCurrency);
  const originalVsProjectBudget = {
    applicable: projectBudgetApplicable,
    ok: !projectBudgetApplicable || (projectBudgetActual === money(project.budgetAmount) && unexpectedProjectCurrencies.length === 0),
    currency: projectCurrency,
    projectBudget: projectBudgetApplicable ? money(project.budgetAmount) : null,
    activityOriginalBudget: projectBudgetApplicable ? projectBudgetActual : null,
    difference: projectBudgetApplicable ? money(projectBudgetActual - money(project.budgetAmount)) : null,
    unexpectedCurrencies: unexpectedProjectCurrencies,
  };

  const transferComparisons = compareCurrencyGroups(transferOutByCurrency, transferInByCurrency);
  const transfersNetZeroByCurrency = {
    ...transferComparisons,
    ok: transferComparisons.ok && !relationshipIssues.some((issue) => issue.kind.startsWith('reallocation_')),
  };
  const expectedRevisedByCurrency = {};
  for (const currency of currencyKeys(originalByCurrency, transferInByCurrency, transferOutByCurrency)) {
    expectedRevisedByCurrency[currency] = money(money(originalByCurrency[currency]) + money(transferInByCurrency[currency]) - money(transferOutByCurrency[currency]));
  }
  const revisedBudgetReconciles = compareCurrencyGroups(expectedRevisedByCurrency, revisedByCurrency);
  const approvedActualOnly = compareCurrencyGroups(expectedActualByCurrency, actualByCurrency);
  const duplicateApprovedExpenseIds = [...approvedExpenses.reduce((counts, expense) => {
    const id = recordId(expense);
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
    return counts;
  }, new Map()).entries()].filter(([, count]) => count > 1).map(([id]) => id);
  approvedActualOnly.duplicateApprovedExpenseIds = duplicateApprovedExpenseIds;
  approvedActualOnly.ok = approvedActualOnly.ok && duplicateApprovedExpenseIds.length === 0;

  const commitmentsNotDoubleCounted = compareCurrencyGroups(expectedCommitmentByCurrency, committedByCurrency);
  commitmentsNotDoubleCounted.ok = commitmentsNotDoubleCounted.ok && !relationshipIssues.some((issue) => issue.kind.startsWith('commitment_'));
  const expectedAvailableByCurrency = {};
  for (const currency of currencyKeys(revisedByCurrency, actualByCurrency, committedByCurrency)) {
    expectedAvailableByCurrency[currency] = money(money(revisedByCurrency[currency]) - money(actualByCurrency[currency]) - money(committedByCurrency[currency]));
  }
  const balancesReconcile = compareCurrencyGroups(expectedAvailableByCurrency, availableByCurrency);

  const quarterApplicable = year !== null && year !== undefined && quarter !== null && quarter !== undefined;
  const invalidTransactionDates = [];
  const quarterSourceRecords = [];
  if (quarterApplicable) {
    for (const expense of approvedExpenses) {
      if (Number.isNaN(new Date(expense.expenseDate).getTime())) invalidTransactionDates.push({ kind: 'expenditure', id: recordId(expense) });
      else if (isWithinQuarter(expense.expenseDate, year, quarter, fiscalYearStartMonth)) quarterSourceRecords.push(expense);
    }
    for (const adjustment of approvedAdjustments) {
      if (Number.isNaN(new Date(adjustment.effectiveDate).getTime())) invalidTransactionDates.push({ kind: 'adjustment', id: recordId(adjustment) });
      else if (isWithinQuarter(adjustment.effectiveDate, year, quarter, fiscalYearStartMonth)) quarterSourceRecords.push(adjustment);
    }
  }
  const quarterByCurrency = valuesByCurrency(quarterSourceRecords, (record) => record.originalExpenseId ? signedAdjustmentAmount(record) : record.amount);
  const quarterDerivedFromTransactionDates = {
    applicable: quarterApplicable,
    ok: !quarterApplicable || invalidTransactionDates.length === 0,
    financialYear: quarterApplicable ? Number(year) : null,
    quarter: quarterApplicable ? Number(quarter) : null,
    fiscalYearStartMonth: Number(fiscalYearStartMonth),
    byCurrency: quarterByCurrency,
    sourceRecordIds: quarterSourceRecords.map(recordId).filter(Boolean),
    invalidTransactionDates,
  };
  const currencies = currencyKeys(originalByCurrency, revisedByCurrency, actualByCurrency, committedByCurrency, availableByCurrency);
  const currenciesSeparated = {
    ok: relationshipIssues.length === 0,
    currencies,
    mixedCurrenciesPresent: currencies.length > 1,
    relationshipIssues,
  };
  const checks = {
    originalVsProjectBudget,
    transfersNetZeroByCurrency,
    revisedBudgetReconciles,
    approvedActualOnly,
    commitmentsNotDoubleCounted,
    balancesReconcile,
    quarterDerivedFromTransactionDates,
    currenciesSeparated,
  };
  const failedChecks = Object.entries(checks)
    .filter(([, check]) => check.applicable !== false && !check.ok)
    .map(([name]) => name);
  return { ok: failedChecks.length === 0, projectId: project?.$id || project?.id || null, performance, totalsByCurrency, checks, failedChecks };
}

module.exports = {
  FINANCE_STATUSES,
  REVIEW_ACTIONS,
  PROJECT_CURRENCIES,
  ORG_FINANCE_ROLES,
  DEFAULT_FINANCE_SETTINGS,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  money,
  positiveAmount,
  assertCurrency,
  validateOrganizationFinanceRoles,
  assertValidOrganizationFinanceRoles,
  deriveOrganizationFinanceAccess,
  validateFinanceSettings,
  utilisationBand,
  parseHistory,
  appendHistory,
  canEditFinanceRecord,
  assertReviewAction,
  nextReviewStatus,
  commitmentOutstandingAmount,
  calculateBudgetPerformance,
  summarizePerformanceByCurrency,
  financialPeriodForDate,
  normalizePeriodType,
  reportingPeriodBounds,
  quarterBounds,
  isWithinQuarter,
  isWithinReportingPeriod,
  signedAdjustmentAmount,
  availableTransferBalance,
  assertReallocationWithinAvailableBudget,
  assertDemoCleanupTarget,
  reconcileFinanceProject,
};

/**
 * Finance-specific Appwrite schema shared by the application definition and
 * the additive deployment utility. Keep this module CommonJS so it can be
 * consumed by both Next.js and plain Node scripts.
 */

const collectionId = (envName, fallback) => process.env[envName] || fallback;

const CORE_FINANCE_COLLECTION_IDS = Object.freeze({
  USERS: collectionId('NEXT_PUBLIC_APPWRITE_COL_USERS', 'pms_users'),
  PROJECTS: collectionId('NEXT_PUBLIC_APPWRITE_COL_PROJECTS', 'pms_projects'),
  MILESTONES: collectionId('NEXT_PUBLIC_APPWRITE_COL_MILESTONES', 'pms_milestones'),
  PROJECT_ROLES: collectionId('NEXT_PUBLIC_APPWRITE_COL_PROJECT_ROLES', 'pms_project_roles'),
});

const FINANCE_COLLECTION_IDS = Object.freeze({
  BUDGET_LINES: collectionId('NEXT_PUBLIC_APPWRITE_COL_BUDGET_LINES', 'pms_budget_lines'),
  EXPENDITURES: collectionId('NEXT_PUBLIC_APPWRITE_COL_EXPENDITURES', 'pms_expenditures'),
  BUDGET_REALLOCATIONS: collectionId(
    'NEXT_PUBLIC_APPWRITE_COL_BUDGET_REALLOCATIONS',
    'pms_budget_reallocations'
  ),
  FINANCE_ADJUSTMENTS: collectionId(
    'NEXT_PUBLIC_APPWRITE_COL_FINANCE_ADJUSTMENTS',
    'pms_finance_adjustments'
  ),
  COMMITMENTS: collectionId(
    'NEXT_PUBLIC_APPWRITE_COL_FINANCE_COMMITMENTS',
    'pms_finance_commitments'
  ),
  FINANCE_SETTINGS: collectionId(
    'NEXT_PUBLIC_APPWRITE_COL_FINANCE_SETTINGS',
    'pms_finance_settings'
  ),
  FINANCIAL_PERIODS: collectionId(
    'NEXT_PUBLIC_APPWRITE_COL_FINANCIAL_PERIODS',
    'pms_financial_periods'
  ),
  VARIANCE_EXPLANATIONS: collectionId(
    'NEXT_PUBLIC_APPWRITE_COL_VARIANCE_EXPLANATIONS',
    'pms_variance_explanations'
  ),
  DEMO_MANIFESTS: collectionId(
    'NEXT_PUBLIC_APPWRITE_COL_FINANCE_DEMO_MANIFESTS',
    'pms_finance_demo_manifests'
  ),
});

const USER_FINANCE_ATTRIBUTES = Object.freeze([
  { key: 'financeRoles', type: 'string', size: 64, array: true },
]);

const PROJECT_FINANCE_ATTRIBUTES = Object.freeze([
  { key: 'demoSeedId', type: 'string', size: 64 },
]);

const PROJECT_ROLE_FINANCE_ATTRIBUTES = Object.freeze([
  { key: 'demoSeedId', type: 'string', size: 64 },
]);

const ACTIVITY_FINANCE_ATTRIBUTES = Object.freeze([
  { key: 'activityCode', type: 'string', size: 64 },
  { key: 'parentActivityId', type: 'string', size: 64 },
  { key: 'sortOrder', type: 'integer' },
  { key: 'demoSeedId', type: 'string', size: 64 },
]);

const ACTIVITY_FINANCE_INDEXES = Object.freeze([
  { key: 'idx_project_code', type: 'key', attrs: ['projectId', 'activityCode'] },
  { key: 'idx_parent_activity', type: 'key', attrs: ['parentActivityId'] },
  { key: 'idx_demo_seed', type: 'key', attrs: ['demoSeedId'] },
]);

const CORE_FINANCE_ATTRIBUTE_TARGETS = Object.freeze([
  {
    id: CORE_FINANCE_COLLECTION_IDS.USERS,
    name: 'User Profiles',
    mustAlreadyExist: true,
    attrs: USER_FINANCE_ATTRIBUTES,
    indexes: [],
  },
  {
    id: CORE_FINANCE_COLLECTION_IDS.PROJECTS,
    name: 'Projects',
    mustAlreadyExist: true,
    attrs: PROJECT_FINANCE_ATTRIBUTES,
    indexes: [{ key: 'idx_demo_seed', type: 'key', attrs: ['demoSeedId'] }],
  },
  {
    id: CORE_FINANCE_COLLECTION_IDS.MILESTONES,
    name: 'Activity Schedules',
    mustAlreadyExist: true,
    attrs: ACTIVITY_FINANCE_ATTRIBUTES,
    indexes: ACTIVITY_FINANCE_INDEXES,
  },
  {
    id: CORE_FINANCE_COLLECTION_IDS.PROJECT_ROLES,
    name: 'Project Roles',
    mustAlreadyExist: true,
    attrs: PROJECT_ROLE_FINANCE_ATTRIBUTES,
    indexes: [{ key: 'idx_demo_seed', type: 'key', attrs: ['demoSeedId'] }],
  },
]);

const workflowAttributes = Object.freeze([
  { key: 'status', type: 'enum', elements: ['draft', 'submitted', 'approved', 'returned', 'rejected'], default: 'draft' },
  { key: 'createdBy', type: 'string', size: 64, required: true },
  { key: 'createdByName', type: 'string', size: 160 },
  { key: 'submittedAt', type: 'datetime' },
  { key: 'reviewedBy', type: 'string', size: 64 },
  { key: 'reviewedByName', type: 'string', size: 160 },
  { key: 'reviewedAt', type: 'datetime' },
  { key: 'reviewerComment', type: 'string', size: 2000 },
]);

const commonIndexes = Object.freeze([
  { key: 'idx_org', type: 'key', attrs: ['organizationId'] },
  { key: 'idx_project', type: 'key', attrs: ['projectId'] },
]);

const FINANCE_COLLECTION_DEFINITIONS = Object.freeze([
  {
    id: FINANCE_COLLECTION_IDS.BUDGET_LINES,
    name: 'Finance Activity Budgets',
    attrs: [
      { key: 'organizationId', type: 'string', size: 64, required: true },
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'activityId', type: 'string', size: 64 },
      { key: 'activityCode', type: 'string', size: 64 },
      { key: 'activityName', type: 'string', size: 190, required: true },
      { key: 'originalAmount', type: 'float', required: true },
      { key: 'currency', type: 'enum', elements: ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS'], required: true },
      { key: 'notes', type: 'string', size: 1000 },
      { key: 'proposalJustification', type: 'string', size: 2000 },
      { key: 'validationStatus', type: 'enum', elements: ['pending', 'validated'], default: 'pending' },
      { key: 'validatedBy', type: 'string', size: 64 },
      { key: 'validatedByName', type: 'string', size: 160 },
      { key: 'validatedAt', type: 'datetime' },
      { key: 'validationComment', type: 'string', size: 2000 },
      { key: 'demoSeedId', type: 'string', size: 64 },
      ...workflowAttributes,
      { key: 'lastEditedBy', type: 'string', size: 64 },
      { key: 'workflowHistory', type: 'json', size: 6000 },
    ],
    indexes: [
      ...commonIndexes,
      { key: 'idx_activity', type: 'key', attrs: ['activityId'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] },
      { key: 'idx_currency', type: 'key', attrs: ['currency'] },
      { key: 'idx_validation', type: 'key', attrs: ['validationStatus'] },
      { key: 'idx_demo_seed', type: 'key', attrs: ['demoSeedId'] },
    ],
  },
  {
    id: FINANCE_COLLECTION_IDS.EXPENDITURES,
    name: 'Expenditures',
    attrs: [
      { key: 'organizationId', type: 'string', size: 64, required: true },
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'budgetLineId', type: 'string', size: 64, required: true },
      { key: 'activityId', type: 'string', size: 64 },
      { key: 'activityCode', type: 'string', size: 64 },
      { key: 'activityName', type: 'string', size: 190, required: true },
      { key: 'amount', type: 'float', required: true },
      { key: 'currency', type: 'enum', elements: ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS'], required: true },
      { key: 'expenseDate', type: 'datetime', required: true },
      { key: 'category', type: 'enum', elements: ['personnel', 'travel', 'supplies', 'equipment', 'services', 'training', 'communications', 'venue', 'other'], default: 'other' },
      { key: 'description', type: 'string', size: 2000, required: true },
      { key: 'payee', type: 'string', size: 190, required: true },
      { key: 'responsibleStaffId', type: 'string', size: 64, required: true },
      { key: 'responsibleStaffName', type: 'string', size: 190, required: true },
      { key: 'paymentMethod', type: 'enum', elements: ['bank_transfer', 'mobile_money', 'cash', 'cheque', 'card', 'other'], required: true },
      { key: 'referenceNumber', type: 'string', size: 120 },
      { key: 'commitmentId', type: 'string', size: 64 },
      { key: 'evidenceFileIds', type: 'string', size: 64, array: true },
      { key: 'evidenceMetadata', type: 'json', size: 3000 },
      // Kept short: pms_expenditures is near Appwrite/MariaDB's per-document
      // row-size ceiling (see scripts/deploy-finance-schema.js), so this must
      // stay a short one-line reason rather than a long free-text field.
      { key: 'evidenceMissingReason', type: 'string', size: 120 },
      { key: 'demoSeedId', type: 'string', size: 64 },
      ...workflowAttributes,
      { key: 'lastEditedBy', type: 'string', size: 64 },
      { key: 'workflowHistory', type: 'json', size: 6000 },
    ],
    indexes: [
      ...commonIndexes,
      { key: 'idx_budget_line', type: 'key', attrs: ['budgetLineId'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] },
      { key: 'idx_expense_date', type: 'key', attrs: ['expenseDate'] },
      { key: 'idx_currency', type: 'key', attrs: ['currency'] },
      { key: 'idx_commitment', type: 'key', attrs: ['commitmentId'] },
      { key: 'idx_demo_seed', type: 'key', attrs: ['demoSeedId'] },
    ],
  },
  {
    id: FINANCE_COLLECTION_IDS.BUDGET_REALLOCATIONS,
    name: 'Budget Reallocations',
    attrs: [
      { key: 'organizationId', type: 'string', size: 64, required: true },
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'fromBudgetLineId', type: 'string', size: 64, required: true },
      { key: 'toBudgetLineId', type: 'string', size: 64, required: true },
      { key: 'fromActivityId', type: 'string', size: 64 },
      { key: 'toActivityId', type: 'string', size: 64 },
      { key: 'fromActivityCode', type: 'string', size: 64 },
      { key: 'toActivityCode', type: 'string', size: 64 },
      { key: 'fromActivityName', type: 'string', size: 190, required: true },
      { key: 'toActivityName', type: 'string', size: 190, required: true },
      { key: 'amount', type: 'float', required: true },
      { key: 'currency', type: 'enum', elements: ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS'], required: true },
      { key: 'reason', type: 'string', size: 2000, required: true },
      { key: 'demoSeedId', type: 'string', size: 64 },
      ...workflowAttributes,
      { key: 'lastEditedBy', type: 'string', size: 64 },
      { key: 'workflowHistory', type: 'json', size: 6000 },
    ],
    indexes: [
      ...commonIndexes,
      { key: 'idx_from_line', type: 'key', attrs: ['fromBudgetLineId'] },
      { key: 'idx_to_line', type: 'key', attrs: ['toBudgetLineId'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] },
      { key: 'idx_currency', type: 'key', attrs: ['currency'] },
      { key: 'idx_demo_seed', type: 'key', attrs: ['demoSeedId'] },
    ],
  },
  {
    id: FINANCE_COLLECTION_IDS.FINANCE_ADJUSTMENTS,
    name: 'Finance Expense Adjustments',
    attrs: [
      { key: 'organizationId', type: 'string', size: 64, required: true },
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'originalExpenseId', type: 'string', size: 64, required: true },
      { key: 'budgetLineId', type: 'string', size: 64, required: true },
      { key: 'activityId', type: 'string', size: 64 },
      { key: 'activityName', type: 'string', size: 190, required: true },
      { key: 'adjustmentType', type: 'enum', elements: ['increase', 'decrease', 'reversal'], required: true },
      { key: 'amount', type: 'float', required: true },
      { key: 'currency', type: 'enum', elements: ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS'], required: true },
      { key: 'effectiveDate', type: 'datetime', required: true },
      { key: 'reason', type: 'string', size: 2000, required: true },
      { key: 'demoSeedId', type: 'string', size: 64 },
      ...workflowAttributes,
      { key: 'workflowHistory', type: 'json', size: 6000 },
    ],
    indexes: [
      ...commonIndexes,
      { key: 'idx_original_expense', type: 'key', attrs: ['originalExpenseId'] },
      { key: 'idx_budget_line', type: 'key', attrs: ['budgetLineId'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] },
      { key: 'idx_demo_seed', type: 'key', attrs: ['demoSeedId'] },
    ],
  },
  {
    id: FINANCE_COLLECTION_IDS.COMMITMENTS,
    name: 'Finance Commitments',
    attrs: [
      { key: 'organizationId', type: 'string', size: 64, required: true },
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'budgetLineId', type: 'string', size: 64, required: true },
      { key: 'activityId', type: 'string', size: 64 },
      { key: 'activityCode', type: 'string', size: 64 },
      { key: 'activityName', type: 'string', size: 190, required: true },
      { key: 'amount', type: 'float', required: true },
      { key: 'currency', type: 'enum', elements: ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS'], required: true },
      { key: 'commitmentDate', type: 'datetime', required: true },
      { key: 'expectedDate', type: 'datetime' },
      { key: 'vendor', type: 'string', size: 190, required: true },
      { key: 'referenceNumber', type: 'string', size: 120 },
      { key: 'description', type: 'string', size: 2000, required: true },
      { key: 'status', type: 'enum', elements: ['draft', 'submitted', 'approved', 'returned', 'rejected', 'partially_converted', 'converted', 'cancelled'], default: 'draft' },
      { key: 'createdBy', type: 'string', size: 64, required: true },
      { key: 'createdByName', type: 'string', size: 160 },
      { key: 'submittedAt', type: 'datetime' },
      { key: 'reviewedBy', type: 'string', size: 64 },
      { key: 'reviewedByName', type: 'string', size: 160 },
      { key: 'reviewedAt', type: 'datetime' },
      { key: 'reviewerComment', type: 'string', size: 2000 },
      { key: 'convertedAt', type: 'datetime' },
      { key: 'cancelledBy', type: 'string', size: 64 },
      { key: 'cancelledByName', type: 'string', size: 160 },
      { key: 'cancelledAt', type: 'datetime' },
      { key: 'cancellationReason', type: 'string', size: 2000 },
      { key: 'lastEditedBy', type: 'string', size: 64 },
      { key: 'workflowHistory', type: 'json', size: 6000 },
      { key: 'demoSeedId', type: 'string', size: 64 },
    ],
    indexes: [
      ...commonIndexes,
      { key: 'idx_budget_line', type: 'key', attrs: ['budgetLineId'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] },
      { key: 'idx_commitment_date', type: 'key', attrs: ['commitmentDate'] },
      { key: 'idx_expected_date', type: 'key', attrs: ['expectedDate'] },
      { key: 'idx_currency', type: 'key', attrs: ['currency'] },
      { key: 'idx_demo_seed', type: 'key', attrs: ['demoSeedId'] },
    ],
  },
  {
    id: FINANCE_COLLECTION_IDS.FINANCE_SETTINGS,
    name: 'Finance Settings',
    attrs: [
      { key: 'organizationId', type: 'string', size: 64, required: true },
      { key: 'projectId', type: 'string', size: 64 },
      { key: 'monitorThresholdPercent', type: 'float', default: 75 },
      { key: 'nearLimitThresholdPercent', type: 'float', default: 90 },
      { key: 'overBudgetThresholdPercent', type: 'float', default: 100 },
      { key: 'varianceMaterialityPercent', type: 'float', default: 10 },
      { key: 'reviewSlaDays', type: 'integer', min: 1, max: 3650, default: 5 },
      { key: 'fiscalYearStartMonth', type: 'integer', min: 1, max: 12, default: 1 },
      { key: 'allowOverBudget', type: 'boolean', default: false },
      { key: 'requireEvidence', type: 'boolean', default: true },
      { key: 'createdBy', type: 'string', size: 64, required: true },
      { key: 'createdByName', type: 'string', size: 160 },
      { key: 'updatedBy', type: 'string', size: 64 },
      { key: 'updatedByName', type: 'string', size: 160 },
      { key: 'updatedAt', type: 'datetime' },
      { key: 'workflowHistory', type: 'json', size: 6000 },
      { key: 'demoSeedId', type: 'string', size: 64 },
    ],
    indexes: [
      ...commonIndexes,
      { key: 'idx_org_project', type: 'key', attrs: ['organizationId', 'projectId'] },
      { key: 'idx_demo_seed', type: 'key', attrs: ['demoSeedId'] },
    ],
  },
  {
    id: FINANCE_COLLECTION_IDS.FINANCIAL_PERIODS,
    name: 'Financial Periods',
    attrs: [
      { key: 'organizationId', type: 'string', size: 64, required: true },
      { key: 'projectId', type: 'string', size: 64 },
      { key: 'periodType', type: 'enum', elements: ['financial_year', 'quarter', 'month'], required: true },
      { key: 'periodKey', type: 'string', size: 64, required: true },
      { key: 'financialYear', type: 'integer', required: true },
      { key: 'quarter', type: 'integer', min: 1, max: 4 },
      { key: 'month', type: 'integer', min: 1, max: 12 },
      { key: 'startDate', type: 'datetime', required: true },
      { key: 'endDate', type: 'datetime', required: true },
      { key: 'status', type: 'enum', elements: ['open', 'closed'], default: 'open' },
      { key: 'createdBy', type: 'string', size: 64, required: true },
      { key: 'createdByName', type: 'string', size: 160 },
      { key: 'closedBy', type: 'string', size: 64 },
      { key: 'closedByName', type: 'string', size: 160 },
      { key: 'closedAt', type: 'datetime' },
      { key: 'closeReason', type: 'string', size: 2000 },
      { key: 'reopenedBy', type: 'string', size: 64 },
      { key: 'reopenedByName', type: 'string', size: 160 },
      { key: 'reopenedAt', type: 'datetime' },
      { key: 'reopenReason', type: 'string', size: 2000 },
      { key: 'workflowHistory', type: 'json', size: 6000 },
      { key: 'demoSeedId', type: 'string', size: 64 },
    ],
    indexes: [
      ...commonIndexes,
      { key: 'idx_period_key', type: 'key', attrs: ['periodKey'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] },
      { key: 'idx_period_start', type: 'key', attrs: ['startDate'] },
      { key: 'idx_demo_seed', type: 'key', attrs: ['demoSeedId'] },
    ],
  },
  {
    id: FINANCE_COLLECTION_IDS.VARIANCE_EXPLANATIONS,
    name: 'Finance Variance Explanations',
    attrs: [
      { key: 'organizationId', type: 'string', size: 64, required: true },
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'budgetLineId', type: 'string', size: 64 },
      { key: 'activityId', type: 'string', size: 64 },
      { key: 'activityCode', type: 'string', size: 64 },
      { key: 'activityName', type: 'string', size: 190 },
      { key: 'periodType', type: 'enum', elements: ['financial_year', 'quarter', 'month'], required: true },
      { key: 'periodKey', type: 'string', size: 64, required: true },
      { key: 'currency', type: 'enum', elements: ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS'], required: true },
      { key: 'varianceAmount', type: 'float', required: true },
      { key: 'variancePercent', type: 'float', required: true },
      { key: 'materialityThresholdPercent', type: 'float', required: true },
      { key: 'explanation', type: 'string', size: 4000, required: true },
      ...workflowAttributes,
      { key: 'lastEditedBy', type: 'string', size: 64 },
      { key: 'workflowHistory', type: 'json', size: 6000 },
      { key: 'demoSeedId', type: 'string', size: 64 },
    ],
    indexes: [
      ...commonIndexes,
      { key: 'idx_budget_line', type: 'key', attrs: ['budgetLineId'] },
      { key: 'idx_activity', type: 'key', attrs: ['activityId'] },
      { key: 'idx_period_key', type: 'key', attrs: ['periodKey'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] },
      { key: 'idx_demo_seed', type: 'key', attrs: ['demoSeedId'] },
    ],
  },
  {
    id: FINANCE_COLLECTION_IDS.DEMO_MANIFESTS,
    name: 'Finance Demo Manifests',
    attrs: [
      { key: 'organizationId', type: 'string', size: 64, required: true },
      { key: 'demoSeedId', type: 'string', size: 64, required: true },
      { key: 'name', type: 'string', size: 190, required: true },
      { key: 'status', type: 'enum', elements: ['seeding', 'active', 'cleaning', 'cleaned', 'failed'], default: 'seeding' },
      { key: 'projectId', type: 'string', size: 64 },
      { key: 'officerAccountId', type: 'string', size: 64 },
      { key: 'reviewerAccountId', type: 'string', size: 64 },
      // Kept modest (not the 16000 originally specified): Appwrite/MariaDB
      // enforces a per-document row-size ceiling across all declared
      // attribute sizes (see scripts/deploy-finance-schema.js), and a demo
      // manifest only ever needs to hold a couple of role labels and a
      // few dozen short record ids, never a large free-form payload.
      { key: 'roleSnapshot', type: 'json', size: 300 },
      { key: 'recordManifest', type: 'json', size: 6000 },
      { key: 'createdBy', type: 'string', size: 64, required: true },
      { key: 'createdByName', type: 'string', size: 160 },
      { key: 'createdAt', type: 'datetime', required: true },
      { key: 'cleanedBy', type: 'string', size: 64 },
      { key: 'cleanedByName', type: 'string', size: 160 },
      { key: 'cleanedAt', type: 'datetime' },
      { key: 'failureReason', type: 'string', size: 500 },
      { key: 'workflowHistory', type: 'json', size: 2000 },
    ],
    indexes: [
      { key: 'idx_org', type: 'key', attrs: ['organizationId'] },
      { key: 'uq_demo_seed', type: 'unique', attrs: ['demoSeedId'] },
      { key: 'idx_project', type: 'key', attrs: ['projectId'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] },
    ],
  },
]);

module.exports = {
  ACTIVITY_FINANCE_ATTRIBUTES,
  ACTIVITY_FINANCE_INDEXES,
  CORE_FINANCE_ATTRIBUTE_TARGETS,
  CORE_FINANCE_COLLECTION_IDS,
  FINANCE_COLLECTION_DEFINITIONS,
  FINANCE_COLLECTION_IDS,
  PROJECT_FINANCE_ATTRIBUTES,
  PROJECT_ROLE_FINANCE_ATTRIBUTES,
  USER_FINANCE_ATTRIBUTES,
};

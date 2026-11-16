/**
 * Clean Cooking (BCCeC) collection definitions.
 *
 * Additive-only: deployed with
 *   node scripts/deploy-finance-schema.js --schema=clean-cooking          (read-only plan)
 *   node scripts/deploy-finance-schema.js --schema=clean-cooking --apply  (create missing)
 *
 * All collections are private (no collection-level permissions, document
 * security on, no document permissions). They are read and written only by
 * the server API routes under /api/clean-cooking, which enforce access.
 * Champion phone numbers and emails are personal data — never expose these
 * collections to the browser SDK.
 */

function collectionId(envKey, fallback) {
  return process.env[envKey] || fallback;
}

const CLEAN_COOKING_COLLECTION_IDS = Object.freeze({
  PROJECT_MODULES: collectionId('NEXT_PUBLIC_APPWRITE_COL_PROJECT_MODULES', 'pms_project_modules'),
  DISTRICTS: collectionId('NEXT_PUBLIC_APPWRITE_COL_CC_DISTRICTS', 'cc_districts'),
  COMPANIES: collectionId('NEXT_PUBLIC_APPWRITE_COL_CC_COMPANIES', 'cc_companies'),
  COMPANY_SALES: collectionId('NEXT_PUBLIC_APPWRITE_COL_CC_COMPANY_SALES', 'cc_company_sales'),
  CHAMPIONS: collectionId('NEXT_PUBLIC_APPWRITE_COL_CC_CHAMPIONS', 'cc_champions'),
  LEADS: collectionId('NEXT_PUBLIC_APPWRITE_COL_CC_LEADS', 'cc_leads'),
  FIELD_SALES: collectionId('NEXT_PUBLIC_APPWRITE_COL_CC_FIELD_SALES', 'cc_field_sales'),
  FOLLOWUPS: collectionId('NEXT_PUBLIC_APPWRITE_COL_CC_FOLLOWUPS', 'cc_followups'),
  HUBS: collectionId('NEXT_PUBLIC_APPWRITE_COL_CC_HUBS', 'cc_hubs'),
});

const { values: optionValues } = require('./fieldOptions');
const { hubValues } = require('./hubDomain');

/** Customer fields shared by leads and champion sales (review comments 2 and 5). */
const CUSTOMER_ATTRIBUTES = [
  { key: 'customerType', type: 'enum', elements: optionValues('customerType'), required: true },
  // Identity is stored only when consentShareIdentity = true; otherwise anonymised.
  { key: 'customerName', type: 'string', size: 160 },
  { key: 'customerPhone', type: 'string', size: 32 },
  { key: 'consentShareIdentity', type: 'boolean', default: false },
  { key: 'consentFollowUp', type: 'boolean', default: false },
  { key: 'gender', type: 'enum', elements: optionValues('gender') },
  { key: 'ageBand', type: 'enum', elements: optionValues('ageBand') },
  { key: 'institutionType', type: 'enum', elements: optionValues('institutionType') },
  { key: 'contactPersonRole', type: 'string', size: 100 },
];

/** Who submitted and from which device submission (idempotency + audit). */
const SUBMISSION_ATTRIBUTES = [
  { key: 'projectId', type: 'string', size: 64, required: true },
  { key: 'championId', type: 'string', size: 64, required: true },
  { key: 'district', type: 'string', size: 100, required: true },
  { key: 'clientSubmissionId', type: 'string', size: 64, required: true },
  { key: 'submittedBy', type: 'string', size: 64, required: true },
];

const SUBMISSION_INDEXES = [
  { key: 'uq_client_submission', type: 'unique', attrs: ['clientSubmissionId'] },
  { key: 'idx_project', type: 'key', attrs: ['projectId'] },
  { key: 'idx_champion', type: 'key', attrs: ['championId'] },
];

const CLEAN_COOKING_COLLECTION_DEFINITIONS = Object.freeze([
  {
    id: CLEAN_COOKING_COLLECTION_IDS.PROJECT_MODULES,
    name: 'Project Modules',
    attrs: [
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'moduleKey', type: 'string', size: 64, required: true },
      { key: 'enabled', type: 'boolean', default: true },
      { key: 'enabledBy', type: 'string', size: 64 },
    ],
    indexes: [
      { key: 'uq_project_module', type: 'unique', attrs: ['projectId', 'moduleKey'] },
    ],
  },
  {
    id: CLEAN_COOKING_COLLECTION_IDS.DISTRICTS,
    name: 'Clean Cooking Districts',
    attrs: [
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'name', type: 'string', size: 100, required: true },
      { key: 'createdBy', type: 'string', size: 64 },
    ],
    indexes: [
      { key: 'uq_project_name', type: 'unique', attrs: ['projectId', 'name'] },
    ],
  },
  {
    id: CLEAN_COOKING_COLLECTION_IDS.COMPANIES,
    name: 'Clean Cooking Companies',
    attrs: [
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'name', type: 'string', size: 190, required: true },
      { key: 'contactName', type: 'string', size: 160 },
      { key: 'phone', type: 'string', size: 32 },
      { key: 'email', type: 'string', size: 190 },
      { key: 'district', type: 'string', size: 100 },
      { key: 'status', type: 'enum', elements: ['active', 'inactive'], default: 'active' },
      { key: 'createdBy', type: 'string', size: 64 },
    ],
    indexes: [
      { key: 'uq_project_name', type: 'unique', attrs: ['projectId', 'name'] },
    ],
  },
  {
    id: CLEAN_COOKING_COLLECTION_IDS.COMPANY_SALES,
    name: 'Clean Cooking Company Sales',
    attrs: [
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'companyId', type: 'string', size: 64, required: true },
      { key: 'periodLabel', type: 'string', size: 64, required: true },
      { key: 'periodStart', type: 'datetime', required: true },
      { key: 'periodEnd', type: 'datetime', required: true },
      { key: 'brand', type: 'string', size: 100, required: true },
      { key: 'product', type: 'string', size: 64 },
      { key: 'sizeLitres', type: 'float', min: 0, max: 1000 },
      { key: 'quantity', type: 'integer', required: true, min: 0, max: 10000000 },
      { key: 'source', type: 'enum', elements: ['manual', 'import'], default: 'manual' },
      { key: 'notes', type: 'string', size: 500 },
      { key: 'createdBy', type: 'string', size: 64 },
    ],
    indexes: [
      { key: 'idx_project', type: 'key', attrs: ['projectId'] },
      { key: 'idx_company', type: 'key', attrs: ['companyId'] },
      { key: 'idx_period', type: 'key', attrs: ['projectId', 'periodStart'] },
    ],
  },
  {
    id: CLEAN_COOKING_COLLECTION_IDS.CHAMPIONS,
    name: 'Clean Cooking Champions',
    attrs: [
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'fullName', type: 'string', size: 190, required: true },
      { key: 'district', type: 'string', size: 100, required: true },
      { key: 'phone', type: 'string', size: 32 },
      { key: 'email', type: 'string', size: 190 },
      { key: 'gender', type: 'enum', elements: ['female', 'male', 'unspecified'], default: 'unspecified' },
      { key: 'isDistrictLead', type: 'boolean', default: false },
      { key: 'status', type: 'enum', elements: ['active', 'inactive'], default: 'active' },
      { key: 'accountId', type: 'string', size: 64 },
      { key: 'notes', type: 'string', size: 500 },
      { key: 'createdBy', type: 'string', size: 64 },
    ],
    indexes: [
      { key: 'idx_project', type: 'key', attrs: ['projectId'] },
      { key: 'idx_project_district', type: 'key', attrs: ['projectId', 'district'] },
      { key: 'idx_phone', type: 'key', attrs: ['phone'] },
    ],
  },
  {
    id: CLEAN_COOKING_COLLECTION_IDS.LEADS,
    name: 'Clean Cooking Leads',
    attrs: [
      ...SUBMISSION_ATTRIBUTES,
      ...CUSTOMER_ATTRIBUTES,
      { key: 'source', type: 'enum', elements: optionValues('leadSource'), required: true },
      { key: 'sourceDetail', type: 'string', size: 300 },
      { key: 'generatedOn', type: 'datetime', required: true },
      { key: 'location', type: 'string', size: 160 },
      { key: 'stage', type: 'enum', elements: optionValues('leadStage'), required: true },
      { key: 'mainBarrier', type: 'enum', elements: optionValues('mainBarrier') },
      { key: 'nextAction', type: 'string', size: 300 },
      { key: 'followUpDate', type: 'datetime' },
      { key: 'saleId', type: 'string', size: 64 },
      { key: 'notes', type: 'string', size: 500 },
      { key: 'stageHistory', type: 'json', size: 6000 },
    ],
    indexes: [
      ...SUBMISSION_INDEXES,
      { key: 'idx_stage', type: 'key', attrs: ['projectId', 'stage'] },
    ],
  },
  {
    id: CLEAN_COOKING_COLLECTION_IDS.FIELD_SALES,
    name: 'Clean Cooking Champion Sales',
    attrs: [
      ...SUBMISSION_ATTRIBUTES,
      ...CUSTOMER_ATTRIBUTES,
      { key: 'leadId', type: 'string', size: 64 },
      { key: 'saleDate', type: 'datetime', required: true },
      { key: 'location', type: 'string', size: 160 },
      { key: 'brand', type: 'string', size: 100, required: true },
      { key: 'model', type: 'string', size: 100 },
      { key: 'sizeLitres', type: 'float', min: 0, max: 1000 },
      { key: 'quantity', type: 'integer', required: true, min: 1, max: 10000 },
      { key: 'unitPriceUgx', type: 'integer', min: 0, max: 100000000 },
      { key: 'supplierCompanyId', type: 'string', size: 64 },
      { key: 'paymentChannel', type: 'enum', elements: optionValues('paymentChannel'), required: true },
      { key: 'financing', type: 'enum', elements: optionValues('financing'), required: true },
      { key: 'notes', type: 'string', size: 500 },
      { key: 'verificationStatus', type: 'enum', elements: optionValues('verificationStatus'), default: 'submitted' },
      { key: 'verifiedBy', type: 'string', size: 64 },
      { key: 'verifiedAt', type: 'datetime' },
      { key: 'verificationNote', type: 'string', size: 500 },
    ],
    indexes: [
      ...SUBMISSION_INDEXES,
      { key: 'idx_lead', type: 'key', attrs: ['leadId'] },
      { key: 'idx_verification', type: 'key', attrs: ['projectId', 'verificationStatus'] },
    ],
  },
  {
    id: CLEAN_COOKING_COLLECTION_IDS.FOLLOWUPS,
    name: 'Clean Cooking Adoption Follow-ups',
    attrs: [
      ...SUBMISSION_ATTRIBUTES,
      { key: 'saleId', type: 'string', size: 64, required: true },
      { key: 'conductedOn', type: 'datetime', required: true },
      { key: 'method', type: 'enum', elements: optionValues('followUpMethod'), required: true },
      { key: 'usageStatus', type: 'enum', elements: optionValues('usageStatus'), required: true },
      { key: 'usageFrequency', type: 'enum', elements: optionValues('usageFrequency') },
      { key: 'barriers', type: 'string', size: 40, array: true },
      { key: 'notes', type: 'string', size: 500 },
    ],
    indexes: [
      ...SUBMISSION_INDEXES,
      { key: 'idx_sale', type: 'key', attrs: ['saleId'] },
    ],
  },
  {
    id: CLEAN_COOKING_COLLECTION_IDS.HUBS,
    name: 'Clean Cooking Hubs',
    attrs: [
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'name', type: 'string', size: 160, required: true },
      { key: 'district', type: 'string', size: 100, required: true },
      { key: 'location', type: 'string', size: 200 },
      { key: 'status', type: 'enum', elements: hubValues('status'), default: 'operational' },
      { key: 'activities', type: 'string', size: 40, array: true },
      { key: 'otherActivity', type: 'string', size: 200 },
      { key: 'managerName', type: 'string', size: 160, required: true },
      { key: 'managerPhone', type: 'string', size: 32 },
      { key: 'managerEmail', type: 'string', size: 190 },
      { key: 'managerGender', type: 'enum', elements: hubValues('gender'), default: 'unspecified' },
      { key: 'peopleWorking', type: 'integer', min: 0, max: 1000000, default: 0 },
      { key: 'womenWorking', type: 'integer', min: 0, max: 1000000, default: 0 },
      { key: 'youthWorking', type: 'integer', min: 0, max: 1000000, default: 0 },
      { key: 'householdsServed', type: 'integer', min: 0, max: 1000000, default: 0 },
      { key: 'establishedOn', type: 'datetime' },
      { key: 'notes', type: 'string', size: 500 },
      { key: 'createdBy', type: 'string', size: 64 },
    ],
    indexes: [
      { key: 'uq_project_name', type: 'unique', attrs: ['projectId', 'name'] },
      { key: 'idx_project_district', type: 'key', attrs: ['projectId', 'district'] },
    ],
  },
]);

const CLEAN_COOKING_MODULE_KEY = 'clean_cooking';

module.exports = {
  CLEAN_COOKING_COLLECTION_DEFINITIONS,
  CLEAN_COOKING_COLLECTION_IDS,
  CLEAN_COOKING_MODULE_KEY,
};

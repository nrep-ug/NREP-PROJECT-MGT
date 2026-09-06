import {
  adminDatabases,
  adminStorage,
  adminTeams,
  BUCKET_DOCS,
  COLLECTIONS,
  DB_ID,
  ID,
  Query,
} from './appwriteAdmin';
import { InputFile } from 'node-appwrite/file';
import {
  EXPENSE_CATEGORIES,
  DEFAULT_FINANCE_SETTINGS,
  FINANCE_STATUSES,
  PAYMENT_METHODS,
  appendHistory,
  assertCurrency,
  assertReviewAction,
  calculateBudgetPerformance,
  canEditFinanceRecord,
  commitmentOutstandingAmount,
  financialPeriodForDate,
  isWithinReportingPeriod,
  isWithinQuarter,
  money,
  nextReviewStatus,
  normalizePeriodType,
  positiveAmount,
  signedAdjustmentAmount,
  summarizePerformanceByCurrency,
  reportingPeriodBounds,
  utilisationBand,
  validateFinanceSettings,
} from './financeDomain';
import {
  HttpError,
  requireBudgetApprover,
  requireFinanceAdministrator,
  requireFinanceOfficer,
  requireFinanceReviewer,
} from './serverAuth';

const LIST_PAGE_SIZE = 100;
const LIST_HARD_LIMIT = 50000;
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const MAX_EVIDENCE_FILES = 4;
const EVIDENCE_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const COLLECTION_KIND = Object.freeze({
  budgetLine: COLLECTIONS.BUDGET_LINES,
  expenditure: COLLECTIONS.EXPENDITURES,
  reallocation: COLLECTIONS.BUDGET_REALLOCATIONS,
  adjustment: COLLECTIONS.FINANCE_ADJUSTMENTS,
  commitment: COLLECTIONS.COMMITMENTS,
  varianceExplanation: COLLECTIONS.VARIANCE_EXPLANATIONS,
});

function cleanText(value, maxLength, { required = false, label = 'Value' } = {}) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new HttpError(400, `${label} is required.`, 'VALIDATION_ERROR');
  if (text.length > maxLength) throw new HttpError(400, `${label} is too long.`, 'VALIDATION_ERROR');
  return text || null;
}

function validDate(value, label) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${label} must be a valid date.`, 'VALIDATION_ERROR');
  }
  return date.toISOString();
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function unpackFinanceDocument(document) {
  if (!document) return document;
  return {
    ...document,
    workflowHistory: parseJsonArray(document.workflowHistory),
    ...(document.evidenceMetadata !== undefined
      ? { evidenceMetadata: parseJsonArray(document.evidenceMetadata) }
      : {}),
  };
}

function workflowEvent(context, action, comment = null, extra = {}) {
  return {
    action,
    actorId: context.accountId,
    actorName: context.displayName,
    at: new Date().toISOString(),
    ...(comment ? { comment } : {}),
    ...extra,
  };
}

function appendEvent(record, context, action, comment = null, extra = {}) {
  return appendHistory(record?.workflowHistory, workflowEvent(context, action, comment, extra));
}

export async function listAllDocuments(collectionId, queries = []) {
  const documents = [];
  let cursor = null;
  do {
    const pageQueries = [...queries, Query.limit(LIST_PAGE_SIZE)];
    if (cursor) pageQueries.push(Query.cursorAfter(cursor));
    const page = await adminDatabases.listDocuments(DB_ID, collectionId, pageQueries);
    documents.push(...page.documents);
    cursor = page.documents.length === LIST_PAGE_SIZE
      ? page.documents[page.documents.length - 1].$id
      : null;
  } while (cursor && documents.length < LIST_HARD_LIMIT);
  if (cursor) {
    throw new HttpError(
      503,
      'The Finance dataset exceeds the safe reporting limit; narrow the requested scope.',
      'FINANCE_REPORT_LIMIT'
    );
  }
  return documents;
}

async function getProjectMembershipRoles(context, project) {
  if (!project.projectTeamId) return [];
  try {
    const memberships = await adminTeams.listMemberships(project.projectTeamId, [
      Query.equal('userId', context.accountId),
      Query.limit(2),
    ]);
    return memberships.memberships.find((membership) => membership.userId === context.accountId)?.roles || [];
  } catch {
    return [];
  }
}

export async function getProjectFinanceCapabilities(context, project) {
  context._financeProjectCapabilities ||= new Map();
  if (context._financeProjectCapabilities.has(project.$id)) {
    return context._financeProjectCapabilities.get(project.$id);
  }
  const membershipRoles = await getProjectMembershipRoles(context, project);
  const isProjectHead = membershipRoles.some((role) => ['owner', 'manager'].includes(role));
  let rolePermissions = [];
  if (membershipRoles.length) {
    try {
      const roleDocs = await listAllDocuments(COLLECTIONS.PROJECT_ROLES, [
        Query.equal('projectId', project.$id),
      ]);
      rolePermissions = roleDocs
        .filter((role) => membershipRoles.includes(role.slug))
        .flatMap((role) => role.permissions || []);
    } catch {
      // owner/manager remains the reliable legacy Project Head relationship.
    }
  }
  const permissionSet = new Set(rolePermissions);
  const canProposeBudget = isProjectHead || permissionSet.has('finance.budget.propose');
  const canRequestReallocation = isProjectHead || permissionSet.has('finance.reallocation.request');
  const canView = context.canViewOrganizationFinance || isProjectHead || permissionSet.has('finance.view') || canProposeBudget || canRequestReallocation;
  const capabilities = {
    canView,
    isProjectHead,
    membershipRoles,
    canProposeBudget,
    canRequestReallocation,
    canConfigureActivities: context.isAdmin || isProjectHead,
  };
  context._financeProjectCapabilities.set(project.$id, capabilities);
  return capabilities;
}

export async function getProjectForContext(
  context,
  projectId,
  { write = false, permission = write ? 'expense' : 'view' } = {}
) {
  if (!projectId) throw new HttpError(400, 'projectId is required.', 'VALIDATION_ERROR');
  const project = await adminDatabases.getDocument(DB_ID, COLLECTIONS.PROJECTS, projectId);
  if (project.organizationId !== context.organizationId) {
    throw new HttpError(404, 'Project not found.', 'PROJECT_NOT_FOUND');
  }

  const capabilities = await getProjectFinanceCapabilities(context, project);
  if (permission === 'expense') {
    requireFinanceOfficer(context);
  } else if (permission === 'budgetProposal') {
    if (context.financeRole !== 'officer' && !capabilities.canProposeBudget) {
      throw new HttpError(403, 'You may only propose budgets for a project you lead.', 'BUDGET_PROPOSAL_FORBIDDEN');
    }
  } else if (permission === 'reallocation') {
    if (context.financeRole !== 'officer' && !capabilities.canRequestReallocation) {
      throw new HttpError(403, 'You may only request reallocations for a project you lead.', 'REALLOCATION_FORBIDDEN');
    }
  } else if (!capabilities.canView) {
    throw new HttpError(403, 'You do not have Finance access for this project.', 'PROJECT_FINANCE_FORBIDDEN');
  }
  return project;
}

export function requireOrganizationFinanceRead(context) {
  if (!context.canViewOrganizationFinance) {
    throw new HttpError(403, 'Organization Finance access is required.', 'FINANCE_READ_REQUIRED');
  }
}

async function getActivity(projectId, activityId) {
  if (!activityId) {
    return { $id: null, name: 'General / Contingency', activityCode: null };
  }
  const activity = await adminDatabases.getDocument(DB_ID, COLLECTIONS.MILESTONES, activityId);
  if (activity.projectId !== projectId) {
    throw new HttpError(400, 'The selected activity does not belong to this project.', 'ACTIVITY_PROJECT_MISMATCH');
  }
  return activity;
}

async function getOrganizationStaff(context, accountId) {
  const users = await adminDatabases.listDocuments(DB_ID, COLLECTIONS.USERS, [
    Query.equal('accountId', accountId),
    Query.equal('organizationId', context.organizationId),
    Query.limit(1),
  ]);
  const profile = users.documents[0];
  if (!profile || profile.userType === 'client' || profile.status !== 'active') {
    throw new HttpError(400, 'Responsible staff must be an active staff member in this organization.', 'INVALID_RESPONSIBLE_STAFF');
  }
  return profile;
}

function profileName(profile) {
  return `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.username;
}

async function getLineInProject(lineId, project) {
  const line = await adminDatabases.getDocument(DB_ID, COLLECTIONS.BUDGET_LINES, lineId);
  if (line.projectId !== project.$id || line.organizationId !== project.organizationId) {
    throw new HttpError(400, 'Budget line does not belong to this project.', 'BUDGET_PROJECT_MISMATCH');
  }
  return line;
}

async function assertUniqueBudgetActivity(projectId, activityId, excludingId = null) {
  const lines = await listAllDocuments(COLLECTIONS.BUDGET_LINES, [
    Query.equal('projectId', projectId),
  ]);
  const duplicate = lines.find((line) => (
    line.$id !== excludingId &&
    (line.activityId || null) === (activityId || null) &&
    line.status !== FINANCE_STATUSES.REJECTED
  ));
  if (duplicate) {
    throw new HttpError(
      409,
      'This activity already has an active budget proposal or approved original budget.',
      'DUPLICATE_ACTIVITY_BUDGET'
    );
  }
}

function projectCurrency(project) {
  try {
    return assertCurrency(project.budgetCurrency);
  } catch (error) {
    throw new HttpError(409, `Project ${project.code || project.name} has no supported budget currency.`, 'PROJECT_CURRENCY_REQUIRED');
  }
}

function financeDomainHttpError(error, fallbackCode = 'VALIDATION_ERROR') {
  if (error instanceof HttpError) return error;
  return new HttpError(400, error?.message || 'Finance validation failed.', error?.code || fallbackCode);
}

async function financeSettingsDocuments(organizationId) {
  return listAllDocuments(COLLECTIONS.FINANCE_SETTINGS, [
    Query.equal('organizationId', organizationId),
    Query.orderDesc('$updatedAt'),
  ]);
}

async function resolveFinanceSettings(context, projectId = null) {
  const documents = await financeSettingsDocuments(context.organizationId);
  const organizationSettings = documents.find((item) => !item.projectId);
  const projectSettings = projectId
    ? documents.find((item) => item.projectId === projectId)
    : null;
  try {
    const globalValues = validateFinanceSettings(organizationSettings || {}, DEFAULT_FINANCE_SETTINGS);
    return projectSettings
      ? validateFinanceSettings(projectSettings, globalValues)
      : globalValues;
  } catch (error) {
    throw new HttpError(409, `Stored Finance settings are invalid: ${error.message}`, error.code || 'FINANCE_SETTINGS_INVALID');
  }
}

export async function getFinanceSettings(context, { projectId = null } = {}) {
  if (projectId) await getProjectForContext(context, projectId);
  else requireOrganizationFinanceRead(context);
  const documents = await financeSettingsDocuments(context.organizationId);
  const source = documents.find((item) => (item.projectId || null) === (projectId || null)) || null;
  return {
    ...await resolveFinanceSettings(context, projectId),
    scope: projectId ? 'project' : 'organization',
    projectId: projectId || null,
    documentId: source?.$id || null,
    workflowHistory: parseJsonArray(source?.workflowHistory),
  };
}

export async function updateFinanceSettings(context, input) {
  requireFinanceAdministrator(context);
  const projectId = cleanText(input.projectId, 64);
  if (projectId) await getProjectForContext(context, projectId);
  const documents = await financeSettingsDocuments(context.organizationId);
  const existing = documents.find((item) => (item.projectId || null) === (projectId || null)) || null;
  let settings;
  try {
    settings = validateFinanceSettings(input, existing || DEFAULT_FINANCE_SETTINGS);
  } catch (error) {
    throw financeDomainHttpError(error, 'FINANCE_SETTINGS_INVALID');
  }
  const now = new Date().toISOString();
  const payload = {
    organizationId: context.organizationId,
    projectId: projectId || null,
    ...settings,
    updatedBy: context.accountId,
    updatedByName: context.displayName,
    updatedAt: now,
    workflowHistory: appendEvent(existing, context, existing ? 'settings_updated' : 'settings_created'),
  };
  const saved = existing
    ? await adminDatabases.updateDocument(DB_ID, COLLECTIONS.FINANCE_SETTINGS, existing.$id, payload)
    : await adminDatabases.createDocument(DB_ID, COLLECTIONS.FINANCE_SETTINGS, ID.unique(), {
        ...payload,
        createdBy: context.accountId,
        createdByName: context.displayName,
      }, []);
  return { ...unpackFinanceDocument(saved), settings };
}

function financialPeriodKey(bounds) {
  if (bounds.periodType === 'financial_year') return `FY${bounds.financialYear}`;
  if (bounds.periodType === 'quarter') return `FY${bounds.financialYear}-Q${bounds.quarter}`;
  return `FY${bounds.financialYear}-M${String(bounds.month).padStart(2, '0')}`;
}

export async function listFinancialPeriods(context, { projectId = null, status = null } = {}) {
  if (projectId) await getProjectForContext(context, projectId);
  else requireOrganizationFinanceRead(context);
  const records = await listAllDocuments(COLLECTIONS.FINANCIAL_PERIODS, [
    Query.equal('organizationId', context.organizationId),
    Query.orderDesc('startDate'),
  ]);
  return records
    .filter((item) => (!projectId || item.projectId === projectId) && (!status || item.status === status))
    .map(unpackFinanceDocument);
}

export async function createFinancialPeriod(context, input) {
  requireFinanceAdministrator(context);
  const projectId = cleanText(input.projectId, 64);
  if (projectId) await getProjectForContext(context, projectId);
  const settings = await resolveFinanceSettings(context, projectId);
  let bounds;
  try {
    bounds = reportingPeriodBounds({
      periodType: input.periodType,
      year: input.financialYear ?? input.year,
      quarter: input.quarter,
      month: input.month,
      fiscalYearStartMonth: settings.fiscalYearStartMonth,
    });
  } catch (error) {
    throw financeDomainHttpError(error, 'REPORTING_PERIOD_INVALID');
  }
  const periodKey = financialPeriodKey(bounds);
  const existing = await listAllDocuments(COLLECTIONS.FINANCIAL_PERIODS, [
    Query.equal('organizationId', context.organizationId),
    Query.equal('periodKey', periodKey),
  ]);
  if (existing.some((item) => (item.projectId || null) === (projectId || null))) {
    throw new HttpError(409, 'That financial period already exists for this scope.', 'FINANCIAL_PERIOD_EXISTS');
  }
  const closeNow = input.status === 'closed';
  const reason = closeNow
    ? cleanText(input.reason ?? input.closeReason, 2000, { required: true, label: 'Close reason' })
    : null;
  let history = appendEvent(null, context, 'period_created');
  if (closeNow) history = appendHistory(history, workflowEvent(context, 'period_closed', reason));
  return unpackFinanceDocument(await adminDatabases.createDocument(
    DB_ID,
    COLLECTIONS.FINANCIAL_PERIODS,
    ID.unique(),
    {
      organizationId: context.organizationId,
      projectId: projectId || null,
      periodType: bounds.periodType,
      periodKey,
      financialYear: bounds.financialYear,
      quarter: bounds.quarter,
      month: bounds.month,
      startDate: bounds.startIso,
      endDate: bounds.endIso,
      status: closeNow ? 'closed' : 'open',
      createdBy: context.accountId,
      createdByName: context.displayName,
      closedBy: closeNow ? context.accountId : null,
      closedByName: closeNow ? context.displayName : null,
      closedAt: closeNow ? new Date().toISOString() : null,
      closeReason: reason,
      workflowHistory: history,
    },
    []
  ));
}

export async function setFinancialPeriodStatus(context, id, input) {
  requireFinanceAdministrator(context);
  const action = String(input.action || '').trim().toLowerCase();
  if (!['close', 'reopen'].includes(action)) {
    throw new HttpError(400, 'Period action must be close or reopen.', 'VALIDATION_ERROR');
  }
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.FINANCIAL_PERIODS, id);
  if (record.organizationId !== context.organizationId) {
    throw new HttpError(404, 'Financial period not found.', 'FINANCIAL_PERIOD_NOT_FOUND');
  }
  const targetStatus = action === 'close' ? 'closed' : 'open';
  if (record.status === targetStatus) {
    throw new HttpError(409, `This period is already ${targetStatus}.`, 'FINANCIAL_PERIOD_STATUS_UNCHANGED');
  }
  const reason = cleanText(
    input.reason ?? (action === 'close' ? input.closeReason : input.reopenReason),
    2000,
    { required: true, label: `${action === 'close' ? 'Close' : 'Reopen'} reason` }
  );
  const now = new Date().toISOString();
  return unpackFinanceDocument(await adminDatabases.updateDocument(
    DB_ID,
    COLLECTIONS.FINANCIAL_PERIODS,
    id,
    action === 'close' ? {
      status: 'closed',
      closedBy: context.accountId,
      closedByName: context.displayName,
      closedAt: now,
      closeReason: reason,
      workflowHistory: appendEvent(record, context, 'period_closed', reason),
    } : {
      status: 'open',
      reopenedBy: context.accountId,
      reopenedByName: context.displayName,
      reopenedAt: now,
      reopenReason: reason,
      workflowHistory: appendEvent(record, context, 'period_reopened', reason),
    }
  ));
}

async function assertFinancialDateOpen(context, projectId, value, label = 'Transaction date') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${label} must be a valid date.`, 'VALIDATION_ERROR');
  }
  const periods = await listAllDocuments(COLLECTIONS.FINANCIAL_PERIODS, [
    Query.equal('organizationId', context.organizationId),
    Query.equal('status', 'closed'),
  ]);
  const blockingPeriod = periods.find((period) => (
    (!period.projectId || period.projectId === projectId) &&
    date >= new Date(period.startDate) && date < new Date(period.endDate)
  ));
  if (blockingPeriod) {
    throw new HttpError(
      409,
      `${label} falls in closed period ${blockingPeriod.periodKey}. Use an authorized current-period adjustment instead.`,
      'FINANCIAL_PERIOD_CLOSED'
    );
  }
  return date.toISOString();
}

export async function getFinanceAccessPayload(context) {
  const [allProjects, staff] = await Promise.all([
    listAllDocuments(COLLECTIONS.PROJECTS, [
      Query.equal('organizationId', context.organizationId),
      Query.orderAsc('name'),
    ]),
    listAllDocuments(COLLECTIONS.USERS, [
      Query.equal('organizationId', context.organizationId),
      Query.equal('userType', 'staff'),
      Query.orderAsc('firstName'),
    ]),
  ]);

  const projectPayloads = (await Promise.all(allProjects.map(async (project) => {
    const capabilities = await getProjectFinanceCapabilities(context, project);
    if (!capabilities.canView) return null;
    return {
      $id: project.$id,
      code: project.code,
      name: project.name,
      status: project.status,
      projectTeamId: project.projectTeamId,
      budgetAmount: money(project.budgetAmount),
      budgetCurrency: project.budgetCurrency,
      ...capabilities,
    };
  }))).filter(Boolean);

  if (!context.canViewOrganizationFinance && projectPayloads.length === 0) {
    throw new HttpError(403, 'You do not have Finance access.', 'FINANCE_READ_REQUIRED');
  }

  return {
    actor: {
      accountId: context.accountId,
      displayName: context.displayName,
      financeRole: context.financeRole,
      isManager: context.isManager,
      isAdmin: context.isAdmin,
      canEdit: context.financeRole === 'officer',
      canReview: context.financeRole === 'reviewer',
      canEditExpenses: context.financeRole === 'officer',
      canValidateBudgets: context.financeRole === 'officer',
      canApproveBudgets: context.canApproveBudgets,
      canAdministerFinance: context.canAdministerFinance,
      canManageCommitments: context.canEditFinance,
      canReviewCommitments: context.canReviewFinance,
    },
    projects: projectPayloads,
    staff: (context.canEditFinance ? staff : [])
      .filter((person) => person.status === 'active')
      .map((person) => ({
        accountId: person.accountId,
        name: profileName(person),
        title: person.title || null,
      })),
  };
}

export async function listProjectActivities(context, projectId) {
  await getProjectForContext(context, projectId);
  const activities = await listAllDocuments(COLLECTIONS.MILESTONES, [
    Query.equal('projectId', projectId),
  ]);
  return activities
    .sort((a, b) => {
      const orderA = Number.isFinite(a.sortOrder) ? a.sortOrder : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isFinite(b.sortOrder) ? b.sortOrder : Number.MAX_SAFE_INTEGER;
      return orderA - orderB || String(a.activityCode || '').localeCompare(String(b.activityCode || '')) || a.name.localeCompare(b.name);
    })
    .map((activity) => ({
      $id: activity.$id,
      name: activity.name,
      activityCode: activity.activityCode || null,
      parentActivityId: activity.parentActivityId || null,
      sortOrder: activity.sortOrder ?? null,
      status: activity.status,
    }));
}

async function canConfigureProjectActivities(context, project) {
  return (await getProjectFinanceCapabilities(context, project)).canConfigureActivities;
}

export async function updateActivityFinancialStructure(context, activityId, input) {
  const activity = await adminDatabases.getDocument(DB_ID, COLLECTIONS.MILESTONES, activityId);
  const project = await getProjectForContext(context, activity.projectId);
  if (!(await canConfigureProjectActivities(context, project))) {
    throw new HttpError(403, 'Project manager or administrator access is required to configure activity codes.', 'ACTIVITY_CONFIGURATION_FORBIDDEN');
  }

  const activityCode = cleanText(input.activityCode, 64);
  if (activityCode && !/^[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*$/.test(activityCode)) {
    throw new HttpError(400, 'Activity codes may contain letters or numbers separated by dots or hyphens.', 'INVALID_ACTIVITY_CODE');
  }
  if (activityCode) {
    const matches = await listAllDocuments(COLLECTIONS.MILESTONES, [
      Query.equal('projectId', project.$id),
      Query.equal('activityCode', activityCode),
    ]);
    if (matches.some((match) => match.$id !== activity.$id)) {
      throw new HttpError(409, 'That activity code is already used in this project.', 'DUPLICATE_ACTIVITY_CODE');
    }
  }

  let parentActivityId = cleanText(input.parentActivityId, 64);
  if (parentActivityId === activity.$id) {
    throw new HttpError(400, 'An activity cannot be its own parent.', 'INVALID_ACTIVITY_PARENT');
  }
  if (parentActivityId) {
    let cursor = await adminDatabases.getDocument(DB_ID, COLLECTIONS.MILESTONES, parentActivityId);
    if (cursor.projectId !== project.$id) {
      throw new HttpError(400, 'Parent activity must belong to the same project.', 'INVALID_ACTIVITY_PARENT');
    }
    const visited = new Set([activity.$id]);
    while (cursor) {
      if (visited.has(cursor.$id)) {
        throw new HttpError(400, 'Activity hierarchy cannot contain a cycle.', 'ACTIVITY_HIERARCHY_CYCLE');
      }
      if (cursor.projectId !== project.$id) {
        throw new HttpError(400, 'Every parent activity must belong to the same project.', 'INVALID_ACTIVITY_PARENT');
      }
      visited.add(cursor.$id);
      cursor = cursor.parentActivityId
        ? await adminDatabases.getDocument(DB_ID, COLLECTIONS.MILESTONES, cursor.parentActivityId)
        : null;
    }
  }

  const sortOrder = input.sortOrder === '' || input.sortOrder === null || input.sortOrder === undefined
    ? null
    : Number(input.sortOrder);
  if (sortOrder !== null && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
    throw new HttpError(400, 'Sort order must be a non-negative whole number.', 'INVALID_SORT_ORDER');
  }

  const updated = await adminDatabases.updateDocument(DB_ID, COLLECTIONS.MILESTONES, activity.$id, {
    activityCode,
    parentActivityId,
    sortOrder,
    updatedBy: context.accountId,
  });
  return {
    $id: updated.$id,
    name: updated.name,
    activityCode: updated.activityCode || null,
    parentActivityId: updated.parentActivityId || null,
    sortOrder: updated.sortOrder ?? null,
    status: updated.status,
  };
}

export async function listBudgetLines(context, { projectId = null, status = null } = {}) {
  if (projectId) await getProjectForContext(context, projectId);
  else requireOrganizationFinanceRead(context);
  const queries = [Query.equal('organizationId', context.organizationId), Query.orderDesc('$createdAt')];
  if (projectId) queries.push(Query.equal('projectId', projectId));
  if (status) queries.push(Query.equal('status', status));
  return (await listAllDocuments(COLLECTIONS.BUDGET_LINES, queries)).map(unpackFinanceDocument);
}

export async function createBudgetLine(context, input) {
  const project = await getProjectForContext(context, input.projectId, { permission: 'budgetProposal' });
  const activity = await getActivity(project.$id, input.activityId || null);
  await assertUniqueBudgetActivity(project.$id, activity.$id || null);
  const originalAmount = positiveAmount(input.originalAmount, 'Original approved budget');
  const now = new Date().toISOString();
  const submit = input.submit === true;
  const created = { workflowHistory: '' };
  let history = appendEvent(created, context, 'created');
  if (submit) history = appendHistory(history, workflowEvent(context, 'submitted'));

  return unpackFinanceDocument(await adminDatabases.createDocument(
    DB_ID,
    COLLECTIONS.BUDGET_LINES,
    ID.unique(),
    {
      organizationId: context.organizationId,
      projectId: project.$id,
      activityId: activity.$id || null,
      activityCode: activity.activityCode || null,
      activityName: activity.name,
      originalAmount,
      currency: projectCurrency(project),
      notes: cleanText(input.notes, 1000),
      proposalJustification: cleanText(
        input.proposalJustification ?? input.notes,
        2000,
        { required: true, label: 'Budget justification' }
      ),
      validationStatus: 'pending',
      status: submit ? FINANCE_STATUSES.SUBMITTED : FINANCE_STATUSES.DRAFT,
      createdBy: context.accountId,
      createdByName: context.displayName,
      submittedAt: submit ? now : null,
      lastEditedBy: context.accountId,
      workflowHistory: history,
    },
    []
  ));
}

export async function updateBudgetLine(context, id, input) {
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.BUDGET_LINES, id);
  await getProjectForContext(context, record.projectId, { permission: 'budgetProposal' });
  if (!canEditFinanceRecord(record, context.accountId)) {
    throw new HttpError(409, 'Only your draft or returned budget can be edited. Approved budgets are immutable.', 'FINANCE_RECORD_LOCKED');
  }
  const activity = await getActivity(record.projectId, input.activityId ?? record.activityId);
  await assertUniqueBudgetActivity(record.projectId, activity.$id || null, record.$id);
  const submit = input.submit === true;
  const now = new Date().toISOString();
  let history = appendEvent(record, context, 'edited');
  if (submit) {
    history = appendHistory(
      history,
      workflowEvent(context, record.status === FINANCE_STATUSES.RETURNED ? 'resubmitted' : 'submitted')
    );
  }
  return unpackFinanceDocument(await adminDatabases.updateDocument(DB_ID, COLLECTIONS.BUDGET_LINES, id, {
    activityId: activity.$id || null,
    activityCode: activity.activityCode || null,
    activityName: activity.name,
    originalAmount: input.originalAmount === undefined
      ? record.originalAmount
      : positiveAmount(input.originalAmount, 'Original approved budget'),
    notes: input.notes === undefined ? record.notes : cleanText(input.notes, 1000),
    proposalJustification: input.proposalJustification === undefined && input.notes === undefined
      ? record.proposalJustification
      : cleanText(
          input.proposalJustification ?? input.notes,
          2000,
          { required: true, label: 'Budget justification' }
        ),
    status: submit ? FINANCE_STATUSES.SUBMITTED : record.status,
    submittedAt: submit ? now : record.submittedAt,
    reviewerComment: submit ? null : record.reviewerComment,
    validationStatus: submit ? 'pending' : (record.validationStatus || 'pending'),
    validatedBy: submit ? null : record.validatedBy,
    validatedByName: submit ? null : record.validatedByName,
    validatedAt: submit ? null : record.validatedAt,
    validationComment: submit ? null : record.validationComment,
    lastEditedBy: context.accountId,
    workflowHistory: history,
  }));
}

/**
 * Finance-native activity detail (Section 3) — everything about ONE activity's
 * money, assembled from the same records and the same calculateBudgetPerformance
 * engine as the rest of Finance. No calculation is re-derived in the client.
 */
export async function getActivityFinanceDetail(context, activityId, { year = null, quarter = null } = {}) {
  if (!activityId) throw new HttpError(400, 'activityId is required.', 'VALIDATION_ERROR');
  const activity = await adminDatabases.getDocument(DB_ID, COLLECTIONS.MILESTONES, activityId);
  const project = await getProjectForContext(context, activity.projectId);

  const records = await projectFinanceRecords(project.$id);
  const performance = calculateBudgetPerformance(
    records.budgetLines, records.expenditures, records.reallocations, records.adjustments, records.commitments
  );
  const performanceLine = performance.find((item) => item.activityId === activityId) || null;
  const budgetLine = performanceLine ? unpackFinanceDocument(performanceLine) : null;
  const rawLine = records.budgetLines.find((line) => line.activityId === activityId) || null;

  const expenditures = records.expenditures.filter((item) => item.activityId === activityId).map(unpackFinanceDocument);
  const commitments = records.commitments.filter((item) => item.activityId === activityId).map(unpackFinanceDocument);
  const reallocations = records.reallocations
    .filter((item) => item.fromActivityId === activityId || item.toActivityId === activityId)
    .map(unpackFinanceDocument);
  const adjustments = budgetLine
    ? records.adjustments.filter((item) => item.budgetLineId === budgetLine.$id).map(unpackFinanceDocument)
    : [];
  const varianceExplanations = (await listAllDocuments(COLLECTIONS.VARIANCE_EXPLANATIONS, [
    Query.equal('organizationId', context.organizationId),
    Query.equal('projectId', project.$id),
    Query.equal('activityId', activityId),
  ])).map(unpackFinanceDocument);

  const selectedYear = Number(year) || new Date().getUTCFullYear();
  const periodApplicable = Number.isInteger(Number(quarter)) && Number(quarter) >= 1 && Number(quarter) <= 4;
  const periodExpenditures = periodApplicable
    ? expenditures.filter((item) => item.status === FINANCE_STATUSES.APPROVED && isWithinQuarter(item.expenseDate, selectedYear, quarter))
    : [];

  return {
    project: { $id: project.$id, code: project.code, name: project.name, budgetCurrency: project.budgetCurrency },
    activity: {
      $id: activity.$id,
      name: activity.name,
      activityCode: activity.activityCode || null,
      parentActivityId: activity.parentActivityId || null,
    },
    budgetLine,
    proposedBudgetLine: !budgetLine && rawLine ? unpackFinanceDocument(rawLine) : null,
    expenditures,
    commitments,
    reallocations,
    adjustments,
    varianceExplanations,
    period: {
      applicable: periodApplicable,
      year: selectedYear,
      quarter: periodApplicable ? Number(quarter) : null,
      spend: money(periodExpenditures.reduce((sum, item) => sum + money(item.amount), 0)),
      transactions: periodExpenditures,
    },
  };
}

export async function listExpenditures(context, filters = {}) {
  if (filters.projectId) await getProjectForContext(context, filters.projectId);
  else requireOrganizationFinanceRead(context);
  const queries = [Query.equal('organizationId', context.organizationId), Query.orderDesc('expenseDate')];
  if (filters.projectId) queries.push(Query.equal('projectId', filters.projectId));
  if (filters.budgetLineId) queries.push(Query.equal('budgetLineId', filters.budgetLineId));
  if (filters.activityId) queries.push(Query.equal('activityId', filters.activityId));
  if (filters.status) queries.push(Query.equal('status', filters.status));
  if (filters.category) queries.push(Query.equal('category', filters.category));
  if (filters.responsibleStaffId) queries.push(Query.equal('responsibleStaffId', filters.responsibleStaffId));
  if (filters.from) queries.push(Query.greaterThanEqual('expenseDate', validDate(filters.from, 'From date')));
  if (filters.to) queries.push(Query.lessThan('expenseDate', validDate(filters.to, 'To date')));
  const documents = await listAllDocuments(COLLECTIONS.EXPENDITURES, queries);
  return documents.map(unpackFinanceDocument);
}

async function expensePayload(context, input, existing = null) {
  const projectId = input.projectId || existing?.projectId;
  const project = await getProjectForContext(context, projectId, { write: true });
  const line = await getLineInProject(input.budgetLineId || existing?.budgetLineId, project);
  if (line.status !== FINANCE_STATUSES.APPROVED) {
    throw new HttpError(409, 'Expenses can only be recorded against an approved activity budget.', 'BUDGET_NOT_APPROVED');
  }
  const responsibleStaffId = input.responsibleStaffId || existing?.responsibleStaffId;
  const responsible = await getOrganizationStaff(context, responsibleStaffId);
  const category = input.category || existing?.category || 'other';
  const paymentMethod = input.paymentMethod || existing?.paymentMethod;
  if (!EXPENSE_CATEGORIES.includes(category)) throw new HttpError(400, 'Invalid expense category.', 'VALIDATION_ERROR');
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new HttpError(400, 'Invalid payment method.', 'VALIDATION_ERROR');
  const currency = projectCurrency(project);
  if (line.currency !== currency) throw new HttpError(409, 'Budget line and project currencies do not match.', 'CURRENCY_MISMATCH');
  const expenseDate = await assertFinancialDateOpen(
    context,
    project.$id,
    validDate(input.expenseDate || existing?.expenseDate, 'Expense date'),
    'Expense date'
  );
  const commitmentId = cleanText(
    input.commitmentId === undefined ? existing?.commitmentId : input.commitmentId,
    64
  );
  if (commitmentId) {
    const commitment = await adminDatabases.getDocument(DB_ID, COLLECTIONS.COMMITMENTS, commitmentId);
    if (
      commitment.organizationId !== context.organizationId ||
      commitment.projectId !== project.$id ||
      commitment.budgetLineId !== line.$id ||
      commitment.currency !== currency ||
      !['approved', 'partially_converted'].includes(commitment.status)
    ) {
      throw new HttpError(409, 'The linked commitment is not approved for this activity budget.', 'COMMITMENT_CONTEXT_INVALID');
    }
  }

  return {
    organizationId: context.organizationId,
    projectId: project.$id,
    budgetLineId: line.$id,
    activityId: line.activityId || null,
    activityCode: line.activityCode || null,
    activityName: line.activityName,
    amount: positiveAmount(input.amount ?? existing?.amount, 'Expense amount'),
    currency,
    expenseDate,
    category,
    description: cleanText(input.description ?? existing?.description, 2000, { required: true, label: 'Description' }),
    payee: cleanText(input.payee ?? existing?.payee, 190, { required: true, label: 'Payee or recipient' }),
    responsibleStaffId: responsible.accountId,
    responsibleStaffName: profileName(responsible),
    paymentMethod,
    referenceNumber: cleanText(input.referenceNumber ?? existing?.referenceNumber, 120),
    commitmentId,
  };
}

export async function createExpenditure(context, input) {
  requireFinanceOfficer(context);
  const payload = await expensePayload(context, input);
  const history = appendEvent(null, context, 'created');
  return unpackFinanceDocument(await adminDatabases.createDocument(
    DB_ID,
    COLLECTIONS.EXPENDITURES,
    ID.unique(),
    {
      ...payload,
      evidenceFileIds: [],
      evidenceMetadata: JSON.stringify([]),
      status: FINANCE_STATUSES.DRAFT,
      createdBy: context.accountId,
      createdByName: context.displayName,
      lastEditedBy: context.accountId,
      workflowHistory: history,
    },
    []
  ));
}

export async function getExpenditure(context, id) {
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.EXPENDITURES, id);
  await getProjectForContext(context, record.projectId);
  return unpackFinanceDocument(record);
}

export async function updateExpenditure(context, id, input) {
  requireFinanceOfficer(context);
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.EXPENDITURES, id);
  if (!canEditFinanceRecord(record, context.accountId)) {
    throw new HttpError(409, 'Only your draft or returned expense can be edited. Approved expenses require an adjustment.', 'FINANCE_RECORD_LOCKED');
  }
  const payload = await expensePayload(context, input, record);
  return unpackFinanceDocument(await adminDatabases.updateDocument(DB_ID, COLLECTIONS.EXPENDITURES, id, {
    ...payload,
    lastEditedBy: context.accountId,
    workflowHistory: appendEvent(record, context, 'edited'),
  }));
}

export async function submitExpenditure(context, id, evidenceMissingReason = null) {
  requireFinanceOfficer(context);
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.EXPENDITURES, id);
  await getProjectForContext(context, record.projectId, { write: true });
  if (!canEditFinanceRecord(record, context.accountId)) {
    throw new HttpError(409, 'Only your draft or returned expense can be submitted.', 'FINANCE_RECORD_LOCKED');
  }
  await assertFinancialDateOpen(context, record.projectId, record.expenseDate, 'Expense date');
  const evidence = parseJsonArray(record.evidenceMetadata);
  const missingReason = cleanText(evidenceMissingReason, 120);
  const settings = await resolveFinanceSettings(context, record.projectId);
  if (settings.requireEvidence && evidence.length === 0 && !missingReason) {
    throw new HttpError(400, 'Upload supporting evidence or explain why evidence is unavailable.', 'EVIDENCE_REQUIRED');
  }
  const comment = evidence.length === 0 ? `Evidence unavailable: ${missingReason}` : null;
  return unpackFinanceDocument(await adminDatabases.updateDocument(DB_ID, COLLECTIONS.EXPENDITURES, id, {
    status: FINANCE_STATUSES.SUBMITTED,
    submittedAt: new Date().toISOString(),
    reviewerComment: null,
    evidenceMissingReason: evidence.length === 0 ? missingReason : null,
    workflowHistory: appendEvent(
      record,
      context,
      record.status === FINANCE_STATUSES.RETURNED ? 'resubmitted' : 'submitted',
      comment
    ),
  }));
}

export async function addExpenditureEvidence(context, id, file) {
  requireFinanceOfficer(context);
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.EXPENDITURES, id);
  await getProjectForContext(context, record.projectId, { write: true });
  if (!canEditFinanceRecord(record, context.accountId)) {
    throw new HttpError(409, 'Evidence can only be added to your draft or returned expense.', 'FINANCE_RECORD_LOCKED');
  }
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new HttpError(400, 'Choose a supporting document to upload.', 'EVIDENCE_REQUIRED');
  }
  const metadata = parseJsonArray(record.evidenceMetadata);
  if (metadata.length >= MAX_EVIDENCE_FILES) {
    throw new HttpError(
      409,
      `An expense can have up to ${MAX_EVIDENCE_FILES} supporting files.`,
      'EVIDENCE_LIMIT_REACHED'
    );
  }
  if (file.size <= 0 || file.size > MAX_EVIDENCE_BYTES) {
    throw new HttpError(400, 'Evidence files must be between 1 byte and 10 MB.', 'EVIDENCE_SIZE_INVALID');
  }
  if (!EVIDENCE_MIME_TYPES.has(file.type)) {
    throw new HttpError(400, 'Evidence must be a PDF, image, Word document, or spreadsheet.', 'EVIDENCE_TYPE_INVALID');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileId = ID.unique();
  const safeName = String(file.name || 'evidence').replace(/[\r\n]/g, '').slice(0, 190);
  const uploaded = await adminStorage.createFile(
    BUCKET_DOCS,
    fileId,
    InputFile.fromBuffer(buffer, safeName),
    []
  );
  const nextMetadata = [
    ...metadata,
    {
      fileId: uploaded.$id,
      name: safeName,
      mimeType: file.type,
      size: file.size,
      uploadedBy: context.accountId,
      uploadedByName: context.displayName,
      uploadedAt: new Date().toISOString(),
    },
  ];

  try {
    return unpackFinanceDocument(await adminDatabases.updateDocument(DB_ID, COLLECTIONS.EXPENDITURES, id, {
      evidenceFileIds: nextMetadata.map((item) => item.fileId),
      evidenceMetadata: JSON.stringify(nextMetadata),
      evidenceMissingReason: null,
      workflowHistory: appendEvent(record, context, 'evidence_added', safeName),
    }));
  } catch (error) {
    // This file was created by this request and is not referenced anywhere if
    // metadata persistence fails, so removing it is safe orphan cleanup.
    try { await adminStorage.deleteFile(BUCKET_DOCS, uploaded.$id); } catch {}
    throw error;
  }
}

export async function getExpenditureEvidence(context, expenseId, fileId) {
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.EXPENDITURES, expenseId);
  await getProjectForContext(context, record.projectId);
  const metadata = parseJsonArray(record.evidenceMetadata);
  const item = metadata.find((entry) => entry.fileId === fileId);
  if (!item) throw new HttpError(404, 'Evidence file not found.', 'EVIDENCE_NOT_FOUND');
  const data = await adminStorage.getFileDownload(BUCKET_DOCS, fileId);
  return { data, metadata: item };
}

function commitmentSettlement(commitment, expenditures, adjustments) {
  const outstandingAmount = commitmentOutstandingAmount(commitment, expenditures, adjustments);
  const active = ['approved', 'partially_converted', 'converted'].includes(commitment.status);
  const settledAmount = active ? money(Math.max(money(commitment.amount) - outstandingAmount, 0)) : 0;
  const settlementStatus = !active
    ? commitment.status
    : outstandingAmount <= 0
      ? 'converted'
      : settledAmount > 0
        ? 'partially_converted'
        : 'approved';
  return { outstandingAmount, settledAmount, settlementStatus };
}

export async function listCommitments(context, filters = {}) {
  if (filters.projectId) await getProjectForContext(context, filters.projectId);
  else requireOrganizationFinanceRead(context);
  const queries = [Query.equal('organizationId', context.organizationId), Query.orderDesc('commitmentDate')];
  if (filters.projectId) queries.push(Query.equal('projectId', filters.projectId));
  if (filters.budgetLineId) queries.push(Query.equal('budgetLineId', filters.budgetLineId));
  if (filters.activityId) queries.push(Query.equal('activityId', filters.activityId));
  if (filters.status) queries.push(Query.equal('status', filters.status));
  const commitments = await listAllDocuments(COLLECTIONS.COMMITMENTS, queries);
  const expenseQueries = [Query.equal('organizationId', context.organizationId)];
  const adjustmentQueries = [Query.equal('organizationId', context.organizationId)];
  if (filters.projectId) {
    expenseQueries.push(Query.equal('projectId', filters.projectId));
    adjustmentQueries.push(Query.equal('projectId', filters.projectId));
  }
  const [expenditures, adjustments] = await Promise.all([
    listAllDocuments(COLLECTIONS.EXPENDITURES, expenseQueries),
    listAllDocuments(COLLECTIONS.FINANCE_ADJUSTMENTS, adjustmentQueries),
  ]);
  return commitments.map((record) => ({
    ...unpackFinanceDocument(record),
    ...commitmentSettlement(record, expenditures, adjustments),
  }));
}

async function commitmentPayload(context, input, existing = null) {
  requireFinanceOfficer(context);
  const project = await getProjectForContext(
    context,
    input.projectId || existing?.projectId,
    { write: true }
  );
  const line = await getLineInProject(input.budgetLineId || existing?.budgetLineId, project);
  if (line.status !== FINANCE_STATUSES.APPROVED) {
    throw new HttpError(409, 'Commitments require an approved activity budget.', 'BUDGET_NOT_APPROVED');
  }
  const currency = projectCurrency(project);
  if (line.currency !== currency) {
    throw new HttpError(409, 'Commitment, budget line, and project currencies must match.', 'CURRENCY_MISMATCH');
  }
  const commitmentDate = await assertFinancialDateOpen(
    context,
    project.$id,
    validDate(input.commitmentDate || existing?.commitmentDate, 'Commitment date'),
    'Commitment date'
  );
  const rawExpectedDate = input.expectedDate === undefined ? existing?.expectedDate : input.expectedDate;
  const expectedDate = rawExpectedDate ? validDate(rawExpectedDate, 'Expected settlement date') : null;
  if (expectedDate && new Date(expectedDate) < new Date(commitmentDate)) {
    throw new HttpError(400, 'Expected settlement date cannot be before the commitment date.', 'VALIDATION_ERROR');
  }
  return {
    organizationId: context.organizationId,
    projectId: project.$id,
    budgetLineId: line.$id,
    activityId: line.activityId || null,
    activityCode: line.activityCode || null,
    activityName: line.activityName,
    amount: positiveAmount(input.amount ?? existing?.amount, 'Commitment amount'),
    currency,
    commitmentDate,
    expectedDate,
    vendor: cleanText(input.vendor ?? existing?.vendor, 190, { required: true, label: 'Vendor or counterparty' }),
    referenceNumber: cleanText(input.referenceNumber ?? existing?.referenceNumber, 120),
    description: cleanText(input.description ?? existing?.description, 2000, { required: true, label: 'Commitment description' }),
  };
}

export async function createCommitment(context, input) {
  const payload = await commitmentPayload(context, input);
  const submit = input.submit === true;
  let history = appendEvent(null, context, 'created');
  if (submit) history = appendHistory(history, workflowEvent(context, 'submitted'));
  return unpackFinanceDocument(await adminDatabases.createDocument(
    DB_ID,
    COLLECTIONS.COMMITMENTS,
    ID.unique(),
    {
      ...payload,
      status: submit ? FINANCE_STATUSES.SUBMITTED : FINANCE_STATUSES.DRAFT,
      createdBy: context.accountId,
      createdByName: context.displayName,
      submittedAt: submit ? new Date().toISOString() : null,
      lastEditedBy: context.accountId,
      workflowHistory: history,
    },
    []
  ));
}

export async function getCommitment(context, id) {
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.COMMITMENTS, id);
  await getProjectForContext(context, record.projectId);
  const [expenditures, adjustments] = await Promise.all([
    listAllDocuments(COLLECTIONS.EXPENDITURES, [Query.equal('commitmentId', id)]),
    listAllDocuments(COLLECTIONS.FINANCE_ADJUSTMENTS, [Query.equal('projectId', record.projectId)]),
  ]);
  return { ...unpackFinanceDocument(record), ...commitmentSettlement(record, expenditures, adjustments) };
}

export async function updateCommitment(context, id, input) {
  requireFinanceOfficer(context);
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.COMMITMENTS, id);
  if (!canEditFinanceRecord(record, context.accountId)) {
    throw new HttpError(409, 'Only your draft or returned commitment can be edited.', 'FINANCE_RECORD_LOCKED');
  }
  const payload = await commitmentPayload(context, input, record);
  const submit = input.submit === true;
  let history = appendEvent(record, context, 'edited');
  if (submit) {
    history = appendHistory(
      history,
      workflowEvent(context, record.status === FINANCE_STATUSES.RETURNED ? 'resubmitted' : 'submitted')
    );
  }
  return unpackFinanceDocument(await adminDatabases.updateDocument(DB_ID, COLLECTIONS.COMMITMENTS, id, {
    ...payload,
    status: submit ? FINANCE_STATUSES.SUBMITTED : record.status,
    submittedAt: submit ? new Date().toISOString() : record.submittedAt,
    reviewerComment: submit ? null : record.reviewerComment,
    lastEditedBy: context.accountId,
    workflowHistory: history,
  }));
}

export async function cancelCommitment(context, id, reason) {
  requireFinanceReviewer(context);
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.COMMITMENTS, id);
  await getProjectForContext(context, record.projectId);
  if (!['approved', 'partially_converted'].includes(record.status)) {
    throw new HttpError(409, 'Only an approved commitment with an outstanding balance can be cancelled.', 'COMMITMENT_NOT_CANCELLABLE');
  }
  if (record.createdBy === context.accountId) {
    throw new HttpError(403, 'You cannot cancel your own commitment.', 'SELF_APPROVAL_FORBIDDEN');
  }
  const cancellationReason = cleanText(reason, 2000, { required: true, label: 'Cancellation reason' });
  const now = new Date().toISOString();
  return unpackFinanceDocument(await adminDatabases.updateDocument(DB_ID, COLLECTIONS.COMMITMENTS, id, {
    status: 'cancelled',
    cancelledBy: context.accountId,
    cancelledByName: context.displayName,
    cancelledAt: now,
    cancellationReason,
    workflowHistory: appendEvent(record, context, 'cancelled', cancellationReason),
  }));
}

export async function listReallocations(context, filters = {}) {
  if (filters.projectId) await getProjectForContext(context, filters.projectId);
  else requireOrganizationFinanceRead(context);
  const queries = [Query.equal('organizationId', context.organizationId), Query.orderDesc('$createdAt')];
  if (filters.projectId) queries.push(Query.equal('projectId', filters.projectId));
  if (filters.status) queries.push(Query.equal('status', filters.status));
  const documents = (await listAllDocuments(COLLECTIONS.BUDGET_REALLOCATIONS, queries)).map(unpackFinanceDocument);
  // A reallocation touches two activities; Appwrite's simple query list can't
  // express "either side matches" as a single equality filter, so this one
  // narrows in the service layer over the already project-scoped (small) set
  // rather than shipping the unfiltered list to the client.
  return filters.activityId
    ? documents.filter((record) => record.fromActivityId === filters.activityId || record.toActivityId === filters.activityId)
    : documents;
}

async function projectFinanceRecords(projectId) {
  const [budgetLines, expenditures, reallocations, adjustments, commitments] = await Promise.all([
    listAllDocuments(COLLECTIONS.BUDGET_LINES, [Query.equal('projectId', projectId)]),
    listAllDocuments(COLLECTIONS.EXPENDITURES, [Query.equal('projectId', projectId)]),
    listAllDocuments(COLLECTIONS.BUDGET_REALLOCATIONS, [Query.equal('projectId', projectId)]),
    listAllDocuments(COLLECTIONS.FINANCE_ADJUSTMENTS, [Query.equal('projectId', projectId)]),
    listAllDocuments(COLLECTIONS.COMMITMENTS, [Query.equal('projectId', projectId)]),
  ]);
  return { budgetLines, expenditures, reallocations, adjustments, commitments };
}

async function availableForTransfer(
  projectId,
  sourceLineId,
  excludingId = null,
  { reserveSubmitted = true } = {}
) {
  const records = await projectFinanceRecords(projectId);
  // Commitments included: an approved obligation against this line is already
  // earmarked and must reduce what can be transferred away from it (this is
  // what the "available after existing commitments" message below promises).
  const source = calculateBudgetPerformance(
    records.budgetLines,
    records.expenditures,
    records.reallocations,
    records.adjustments,
    records.commitments
  ).find((line) => line.$id === sourceLineId);
  if (!source) throw new HttpError(409, 'Source budget is not approved.', 'SOURCE_BUDGET_NOT_APPROVED');
  const pendingReserved = reserveSubmitted ? records.reallocations
    .filter((item) => (
      item.$id !== excludingId &&
      item.fromBudgetLineId === sourceLineId &&
      item.status === FINANCE_STATUSES.SUBMITTED
    ))
    .reduce((sum, item) => sum + money(item.amount), 0) : 0;
  return money(source.availableBalance - pendingReserved);
}

async function reallocationPayload(context, input, existing = null) {
  const project = await getProjectForContext(
    context,
    input.projectId || existing?.projectId,
    { permission: 'reallocation' }
  );
  const fromLineId = input.fromBudgetLineId || existing?.fromBudgetLineId;
  const toLineId = input.toBudgetLineId || existing?.toBudgetLineId;
  if (!fromLineId || !toLineId || fromLineId === toLineId) {
    throw new HttpError(400, 'Choose two different source and destination activity budgets.', 'INVALID_REALLOCATION_LINES');
  }
  const [fromLine, toLine] = await Promise.all([
    getLineInProject(fromLineId, project),
    getLineInProject(toLineId, project),
  ]);
  if (fromLine.status !== FINANCE_STATUSES.APPROVED || toLine.status !== FINANCE_STATUSES.APPROVED) {
    throw new HttpError(409, 'Both activity budgets must be approved.', 'BUDGET_NOT_APPROVED');
  }
  const currency = projectCurrency(project);
  if (fromLine.currency !== currency || toLine.currency !== currency) {
    throw new HttpError(409, 'Source, destination, and project currencies must match.', 'CURRENCY_MISMATCH');
  }
  const amount = positiveAmount(input.amount ?? existing?.amount, 'Reallocation amount');
  const available = await availableForTransfer(project.$id, fromLine.$id, existing?.$id);
  if (amount > available) {
    throw new HttpError(409, `The source activity has only ${currency} ${available.toLocaleString()} available after existing commitments.`, 'INSUFFICIENT_AVAILABLE_BUDGET');
  }
  return {
    organizationId: context.organizationId,
    projectId: project.$id,
    fromBudgetLineId: fromLine.$id,
    toBudgetLineId: toLine.$id,
    fromActivityId: fromLine.activityId || null,
    toActivityId: toLine.activityId || null,
    fromActivityCode: fromLine.activityCode || null,
    toActivityCode: toLine.activityCode || null,
    fromActivityName: fromLine.activityName,
    toActivityName: toLine.activityName,
    amount,
    currency,
    reason: cleanText(input.reason ?? existing?.reason, 2000, { required: true, label: 'Reallocation reason' }),
  };
}

export async function createReallocation(context, input) {
  const payload = await reallocationPayload(context, input);
  const submit = input.submit === true;
  let history = appendEvent(null, context, 'created');
  if (submit) history = appendHistory(history, workflowEvent(context, 'submitted'));
  return unpackFinanceDocument(await adminDatabases.createDocument(
    DB_ID,
    COLLECTIONS.BUDGET_REALLOCATIONS,
    ID.unique(),
    {
      ...payload,
      status: submit ? FINANCE_STATUSES.SUBMITTED : FINANCE_STATUSES.DRAFT,
      createdBy: context.accountId,
      createdByName: context.displayName,
      submittedAt: submit ? new Date().toISOString() : null,
      lastEditedBy: context.accountId,
      workflowHistory: history,
    },
    []
  ));
}

export async function updateReallocation(context, id, input) {
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.BUDGET_REALLOCATIONS, id);
  if (!canEditFinanceRecord(record, context.accountId)) {
    throw new HttpError(409, 'Only your draft or returned reallocation can be edited.', 'FINANCE_RECORD_LOCKED');
  }
  const payload = await reallocationPayload(context, input, record);
  const submit = input.submit === true;
  let history = appendEvent(record, context, 'edited');
  if (submit) {
    history = appendHistory(
      history,
      workflowEvent(context, record.status === FINANCE_STATUSES.RETURNED ? 'resubmitted' : 'submitted')
    );
  }
  return unpackFinanceDocument(await adminDatabases.updateDocument(DB_ID, COLLECTIONS.BUDGET_REALLOCATIONS, id, {
    ...payload,
    status: submit ? FINANCE_STATUSES.SUBMITTED : record.status,
    submittedAt: submit ? new Date().toISOString() : record.submittedAt,
    reviewerComment: submit ? null : record.reviewerComment,
    lastEditedBy: context.accountId,
    workflowHistory: history,
  }));
}

export async function listAdjustments(context, filters = {}) {
  if (filters.projectId) await getProjectForContext(context, filters.projectId);
  else requireOrganizationFinanceRead(context);
  const queries = [Query.equal('organizationId', context.organizationId), Query.orderDesc('$createdAt')];
  if (filters.projectId) queries.push(Query.equal('projectId', filters.projectId));
  if (filters.originalExpenseId) queries.push(Query.equal('originalExpenseId', filters.originalExpenseId));
  if (filters.status) queries.push(Query.equal('status', filters.status));
  return (await listAllDocuments(COLLECTIONS.FINANCE_ADJUSTMENTS, queries)).map(unpackFinanceDocument);
}

async function remainingReversibleAmount(expense) {
  const adjustments = await listAllDocuments(COLLECTIONS.FINANCE_ADJUSTMENTS, [
    Query.equal('originalExpenseId', expense.$id),
    Query.equal('status', FINANCE_STATUSES.APPROVED),
  ]);
  return money(expense.amount + adjustments.reduce(
    (sum, adjustment) => sum + signedAdjustmentAmount(adjustment),
    0
  ));
}

export async function createAdjustment(context, input) {
  requireFinanceOfficer(context);
  const expense = await adminDatabases.getDocument(DB_ID, COLLECTIONS.EXPENDITURES, input.originalExpenseId);
  await getProjectForContext(context, expense.projectId, { write: true });
  if (expense.status !== FINANCE_STATUSES.APPROVED) {
    throw new HttpError(409, 'Only approved expenses can be adjusted or reversed.', 'EXPENSE_NOT_APPROVED');
  }
  if (!['increase', 'decrease', 'reversal'].includes(input.adjustmentType)) {
    throw new HttpError(400, 'Invalid adjustment type.', 'VALIDATION_ERROR');
  }
  const reversible = await remainingReversibleAmount(expense);
  if (input.adjustmentType === 'reversal' && reversible <= 0) {
    throw new HttpError(409, 'This expense has no remaining amount to reverse.', 'EXPENSE_ALREADY_REVERSED');
  }
  const amount = input.adjustmentType === 'reversal'
    ? reversible
    : positiveAmount(input.amount, 'Adjustment amount');
  if (['decrease', 'reversal'].includes(input.adjustmentType) && amount > reversible) {
    throw new HttpError(409, `The remaining reversible amount is ${expense.currency} ${reversible.toLocaleString()}.`, 'ADJUSTMENT_EXCEEDS_EXPENSE');
  }
  if (input.submit !== true) {
    throw new HttpError(400, 'Adjustments must be submitted for review when created.', 'ADJUSTMENT_SUBMISSION_REQUIRED');
  }
  let history = appendEvent(null, context, 'created');
  history = appendHistory(history, workflowEvent(context, 'submitted'));
  return unpackFinanceDocument(await adminDatabases.createDocument(
    DB_ID,
    COLLECTIONS.FINANCE_ADJUSTMENTS,
    ID.unique(),
    {
      organizationId: context.organizationId,
      projectId: expense.projectId,
      originalExpenseId: expense.$id,
      budgetLineId: expense.budgetLineId,
      activityId: expense.activityId || null,
      activityName: expense.activityName,
      adjustmentType: input.adjustmentType,
      amount,
      currency: expense.currency,
      effectiveDate: validDate(input.effectiveDate || new Date(), 'Effective date'),
      reason: cleanText(input.reason, 2000, { required: true, label: 'Adjustment reason' }),
      status: FINANCE_STATUSES.SUBMITTED,
      createdBy: context.accountId,
      createdByName: context.displayName,
      submittedAt: new Date().toISOString(),
      workflowHistory: history,
    },
    []
  ));
}

export async function validateBudgetProposal(context, id, action, comment = '') {
  requireFinanceOfficer(context);
  if (!['validate', 'return', 'reject'].includes(action)) {
    throw new HttpError(400, 'Budget validation action must be validate, return, or reject.', 'VALIDATION_ERROR');
  }
  if (['return', 'reject'].includes(action) && !String(comment || '').trim()) {
    throw new HttpError(400, 'A Finance validation comment is required.', 'VALIDATION_ERROR');
  }
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.BUDGET_LINES, id);
  await getProjectForContext(context, record.projectId);
  if (record.status !== FINANCE_STATUSES.SUBMITTED || record.validationStatus === 'validated') {
    throw new HttpError(409, 'Only a submitted, unvalidated proposal can be financially validated.', 'BUDGET_NOT_PENDING_VALIDATION');
  }
  if (record.createdBy === context.accountId) {
    throw new HttpError(403, 'You cannot financially validate your own budget proposal.', 'SELF_VALIDATION_FORBIDDEN');
  }
  await validateSubmittedRecord(context, 'budgetLine', record);
  const now = new Date().toISOString();
  const validationComment = cleanText(comment, 1000);
  if (action === 'validate') {
    return unpackFinanceDocument(await adminDatabases.updateDocument(
      DB_ID,
      COLLECTIONS.BUDGET_LINES,
      id,
      {
        validationStatus: 'validated',
        validatedBy: context.accountId,
        validatedByName: context.displayName,
        validatedAt: now,
        validationComment,
        reviewerComment: null,
        workflowHistory: appendEvent(record, context, 'validated', validationComment),
      }
    ));
  }
  const nextStatus = action === 'return' ? FINANCE_STATUSES.RETURNED : FINANCE_STATUSES.REJECTED;
  return unpackFinanceDocument(await adminDatabases.updateDocument(
    DB_ID,
    COLLECTIONS.BUDGET_LINES,
    id,
    {
      status: nextStatus,
      validationStatus: 'pending',
      validatedBy: context.accountId,
      validatedByName: context.displayName,
      validatedAt: now,
      validationComment,
      reviewerComment: validationComment,
      workflowHistory: appendEvent(
        record,
        context,
        action === 'return' ? 'validation_returned' : 'validation_rejected',
        validationComment
      ),
    }
  ));
}

export async function reviewBudgetProposal(context, id, action, comment = '') {
  requireBudgetApprover(context);
  try {
    assertReviewAction(action, comment);
  } catch (error) {
    throw new HttpError(400, error.message, 'VALIDATION_ERROR');
  }
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.BUDGET_LINES, id);
  if (record.status !== FINANCE_STATUSES.SUBMITTED || record.validationStatus !== 'validated') {
    throw new HttpError(409, 'Only a financially validated proposal can be approved.', 'BUDGET_NOT_VALIDATED');
  }
  if (record.createdBy === context.accountId) {
    throw new HttpError(403, 'You cannot approve your own budget proposal.', 'SELF_APPROVAL_FORBIDDEN');
  }
  if (record.validatedBy === context.accountId) {
    throw new HttpError(403, 'The financial validator cannot also approve this budget.', 'VALIDATOR_APPROVER_CONFLICT');
  }
  const project = await getProjectForContext(context, record.projectId);
  await validateSubmittedRecord(context, 'budgetLine', record);
  if (action === 'approve') {
    const approvedLines = await listAllDocuments(COLLECTIONS.BUDGET_LINES, [
      Query.equal('projectId', project.$id),
      Query.equal('status', FINANCE_STATUSES.APPROVED),
    ]);
    const proposedTotal = money(approvedLines.reduce(
      (sum, line) => sum + (line.$id === record.$id ? 0 : money(line.originalAmount)),
      money(record.originalAmount)
    ));
    const ceiling = money(project.budgetAmount);
    if (ceiling > 0 && proposedTotal > ceiling) {
      throw new HttpError(
        409,
        `Approval would exceed the project approved budget ceiling of ${record.currency} ${ceiling.toLocaleString()}.`,
        'PROJECT_BUDGET_EXCEEDED'
      );
    }
  }
  const nextStatus = nextReviewStatus(action);
  const reviewerComment = cleanText(comment, 1000);
  const now = new Date().toISOString();
  return unpackFinanceDocument(await adminDatabases.updateDocument(
    DB_ID,
    COLLECTIONS.BUDGET_LINES,
    id,
    {
      status: nextStatus,
      reviewedBy: context.accountId,
      reviewedByName: context.displayName,
      reviewedAt: now,
      reviewerComment,
      validationStatus: action === 'approve' ? 'validated' : 'pending',
      workflowHistory: appendEvent(
        record,
        context,
        action === 'return' ? 'approval_returned' : action === 'approve' ? 'approved' : 'rejected',
        reviewerComment
      ),
    }
  ));
}

async function validateSubmittedRecord(context, kind, record) {
  const project = await getProjectForContext(context, record.projectId);
  const currency = projectCurrency(project);
  if (record.organizationId !== context.organizationId || record.currency !== currency) {
    throw new HttpError(409, 'The record no longer matches its project organization or currency.', 'FINANCE_CONTEXT_MISMATCH');
  }

  if (kind === 'budgetLine') {
    await getActivity(project.$id, record.activityId || null);
  }

  if (kind === 'expenditure') {
    const line = await getLineInProject(record.budgetLineId, project);
    if (line.status !== FINANCE_STATUSES.APPROVED || line.currency !== currency) {
      throw new HttpError(409, 'The linked activity budget is no longer approved or currency-compatible.', 'BUDGET_NOT_APPROVED');
    }
    const evidence = parseJsonArray(record.evidenceMetadata);
    const evidenceException = parseJsonArray(record.workflowHistory).find(
      (event) => event.action === 'submitted' && event.comment?.startsWith('Evidence unavailable:')
    );
    if (evidence.length === 0 && !evidenceException) {
      throw new HttpError(409, 'This expense has no evidence or documented evidence exception.', 'EVIDENCE_REQUIRED');
    }
    // Section 8 (Budget alerts): near-limit utilisation is surfaced for
    // monitoring, but crossing 100% of the revised budget is a hard approval
    // gate unless an administrator has explicitly opted the org/project into
    // allowOverBudget. This mirrors the ceiling check already enforced for
    // budget-line approval and reallocations.
    const expenseSettings = await resolveFinanceSettings(context, project.$id);
    if (!expenseSettings.allowOverBudget) {
      const records = await projectFinanceRecords(project.$id);
      const performance = calculateBudgetPerformance(
        records.budgetLines, records.expenditures, records.reallocations, records.adjustments
      ).find((item) => item.$id === line.$id);
      const projectedBalance = money((performance?.actualAvailableBalance ?? 0) - money(record.amount));
      if (performance && projectedBalance < 0) {
        throw new HttpError(
          409,
          `Approving this expense would exceed the approved budget for ${line.activityName} by ${currency} ${Math.abs(projectedBalance).toLocaleString()}. Enable "allow over budget" in Finance settings or reduce the amount.`,
          'BUDGET_CEILING_EXCEEDED'
        );
      }
    }
  }

  if (kind === 'reallocation') {
    const [fromLine, toLine] = await Promise.all([
      getLineInProject(record.fromBudgetLineId, project),
      getLineInProject(record.toBudgetLineId, project),
    ]);
    if (
      fromLine.status !== FINANCE_STATUSES.APPROVED ||
      toLine.status !== FINANCE_STATUSES.APPROVED ||
      fromLine.currency !== currency ||
      toLine.currency !== currency
    ) {
      throw new HttpError(409, 'Both activity budgets must remain approved and currency-compatible.', 'REALLOCATION_CONTEXT_INVALID');
    }
    const available = await availableForTransfer(
      project.$id,
      fromLine.$id,
      record.$id,
      { reserveSubmitted: false }
    );
    if (money(record.amount) > available) {
      throw new HttpError(409, `The source activity now has only ${currency} ${available.toLocaleString()} available.`, 'INSUFFICIENT_AVAILABLE_BUDGET');
    }
  }

  if (kind === 'adjustment') {
    const expense = await adminDatabases.getDocument(DB_ID, COLLECTIONS.EXPENDITURES, record.originalExpenseId);
    if (expense.status !== FINANCE_STATUSES.APPROVED || expense.projectId !== project.$id || expense.currency !== currency) {
      throw new HttpError(409, 'The original expense is no longer valid for this adjustment.', 'ADJUSTMENT_CONTEXT_INVALID');
    }
    if (['decrease', 'reversal'].includes(record.adjustmentType)) {
      const reversible = await remainingReversibleAmount(expense);
      if (money(record.amount) > reversible) {
        throw new HttpError(409, `Only ${currency} ${reversible.toLocaleString()} remains reversible.`, 'ADJUSTMENT_EXCEEDS_EXPENSE');
      }
    }
  }
}

export async function reviewFinanceRecord(context, kind, id, action, comment = '') {
  requireFinanceReviewer(context);
  if (kind === 'budgetLine') {
    throw new HttpError(400, 'Budget proposals use separate validation and approval decisions.', 'BUDGET_WORKFLOW_REQUIRED');
  }
  const collectionId = COLLECTION_KIND[kind];
  if (!collectionId) throw new HttpError(400, 'Unknown Finance record type.', 'VALIDATION_ERROR');
  try {
    assertReviewAction(action, comment);
  } catch (error) {
    throw new HttpError(400, error.message, 'VALIDATION_ERROR');
  }
  const record = await adminDatabases.getDocument(DB_ID, collectionId, id);
  if (record.status !== FINANCE_STATUSES.SUBMITTED) {
    throw new HttpError(409, 'Only submitted records can be reviewed.', 'FINANCE_RECORD_NOT_SUBMITTED');
  }
  if (record.createdBy === context.accountId) {
    throw new HttpError(403, 'You cannot review your own Finance record.', 'SELF_APPROVAL_FORBIDDEN');
  }
  await validateSubmittedRecord(context, kind, record);
  const now = new Date().toISOString();
  const nextStatus = nextReviewStatus(action);
  const reviewerComment = cleanText(comment, 1000);
  const updated = await adminDatabases.updateDocument(DB_ID, collectionId, id, {
    status: nextStatus,
    reviewedBy: context.accountId,
    reviewedByName: context.displayName,
    reviewedAt: now,
    reviewerComment,
    workflowHistory: appendEvent(
      record,
      context,
      action === 'return' ? 'returned' : action === 'approve' ? 'approved' : 'rejected',
      reviewerComment
    ),
  });

  if (kind === 'reallocation' && nextStatus === FINANCE_STATUSES.APPROVED) {
    // Recheck after the atomic status flip. If two server instances approved
    // competing transfers concurrently, each derives from source records and
    // any newly negative result is rolled back to RETURNED rather than changing
    // an original budget or leaving an invalid transfer in force.
    const records = await projectFinanceRecords(record.projectId);
    const source = calculateBudgetPerformance(
      records.budgetLines,
      records.expenditures,
      records.reallocations,
      records.adjustments,
      records.commitments
    ).find((line) => line.$id === record.fromBudgetLineId);
    if (!source || source.availableBalance < 0) {
      const rollbackComment = 'Approval conflict: another transaction consumed the available source allocation.';
      await adminDatabases.updateDocument(DB_ID, collectionId, id, {
        status: FINANCE_STATUSES.RETURNED,
        reviewerComment: rollbackComment,
        workflowHistory: appendHistory(
          updated.workflowHistory,
          workflowEvent(context, 'approval_conflict_returned', rollbackComment)
        ),
      });
      throw new HttpError(409, rollbackComment, 'REALLOCATION_APPROVAL_CONFLICT');
    }
  }

  if (
    kind === 'adjustment' &&
    nextStatus === FINANCE_STATUSES.APPROVED &&
    ['decrease', 'reversal'].includes(record.adjustmentType)
  ) {
    const expense = await adminDatabases.getDocument(
      DB_ID,
      COLLECTIONS.EXPENDITURES,
      record.originalExpenseId
    );
    const remaining = await remainingReversibleAmount(expense);
    if (remaining < 0) {
      const rollbackComment = 'Approval conflict: another adjustment consumed the remaining reversible amount.';
      await adminDatabases.updateDocument(DB_ID, collectionId, id, {
        status: FINANCE_STATUSES.RETURNED,
        reviewerComment: rollbackComment,
        workflowHistory: appendHistory(
          updated.workflowHistory,
          workflowEvent(context, 'approval_conflict_returned', rollbackComment)
        ),
      });
      throw new HttpError(409, rollbackComment, 'ADJUSTMENT_APPROVAL_CONFLICT');
    }
  }

  return unpackFinanceDocument(updated);
}

export async function getReviewQueue(context) {
  requireFinanceReviewer(context);
  const [budgetLines, expenditures, reallocations, adjustments] = await Promise.all([
    listAllDocuments(COLLECTIONS.BUDGET_LINES, [Query.equal('organizationId', context.organizationId), Query.orderDesc('$updatedAt')]),
    listAllDocuments(COLLECTIONS.EXPENDITURES, [Query.equal('organizationId', context.organizationId), Query.orderDesc('$updatedAt')]),
    listAllDocuments(COLLECTIONS.BUDGET_REALLOCATIONS, [Query.equal('organizationId', context.organizationId), Query.orderDesc('$updatedAt')]),
    listAllDocuments(COLLECTIONS.FINANCE_ADJUSTMENTS, [Query.equal('organizationId', context.organizationId), Query.orderDesc('$updatedAt')]),
  ]);
  const tagged = [
    ...budgetLines.map((record) => ({ ...unpackFinanceDocument(record), kind: 'budgetLine' })),
    ...expenditures.map((record) => ({ ...unpackFinanceDocument(record), kind: 'expenditure' })),
    ...reallocations.map((record) => ({ ...unpackFinanceDocument(record), kind: 'reallocation' })),
    ...adjustments.map((record) => ({ ...unpackFinanceDocument(record), kind: 'adjustment' })),
  ];
  const recentCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  return {
    needsReview: tagged.filter((record) => record.status === FINANCE_STATUSES.SUBMITTED),
    returned: tagged.filter((record) => record.status === FINANCE_STATUSES.RETURNED),
    recentlyApproved: tagged.filter((record) => (
      record.status === FINANCE_STATUSES.APPROVED && new Date(record.reviewedAt || 0).getTime() >= recentCutoff
    )),
    rejected: tagged.filter((record) => record.status === FINANCE_STATUSES.REJECTED),
  };
}

/**
 * Section U — the Budget Approver's own queue. Deliberately separate from
 * getReviewQueue (which is the Finance Reviewer's expense/reallocation/
 * adjustment queue and requires a different role): a budget-line approver
 * may hold finance_budget_approver without also being a Finance Reviewer,
 * and only financially-validated proposals belong here — a proposal still
 * awaiting the Officer's validation is not this actor's decision yet.
 */
export async function getBudgetApprovalQueue(context) {
  requireBudgetApprover(context);
  const budgetLines = await listAllDocuments(COLLECTIONS.BUDGET_LINES, [
    Query.equal('organizationId', context.organizationId),
    Query.equal('status', FINANCE_STATUSES.SUBMITTED),
    Query.equal('validationStatus', 'validated'),
    Query.orderDesc('validatedAt'),
  ]);
  return { awaitingApproval: budgetLines.map(unpackFinanceDocument) };
}

function pendingRecords(records) {
  return [
    ...records.budgetLines.map((record) => ({ ...record, kind: 'budgetLine' })),
    ...records.expenditures.map((record) => ({ ...record, kind: 'expenditure' })),
    ...records.reallocations.map((record) => ({ ...record, kind: 'reallocation' })),
    ...records.adjustments.map((record) => ({ ...record, kind: 'adjustment' })),
  ].filter((record) => record.status === FINANCE_STATUSES.SUBMITTED);
}

function spendByCategory(expenditures, adjustments) {
  const expenseById = new Map(expenditures.map((expense) => [expense.$id, expense]));
  const grouped = {};
  for (const expense of expenditures) {
    if (expense.status !== FINANCE_STATUSES.APPROVED) continue;
    grouped[expense.category] = money((grouped[expense.category] || 0) + expense.amount);
  }
  for (const adjustment of adjustments) {
    if (adjustment.status !== FINANCE_STATUSES.APPROVED) continue;
    const category = expenseById.get(adjustment.originalExpenseId)?.category || 'other';
    grouped[category] = money((grouped[category] || 0) + signedAdjustmentAmount(adjustment));
  }
  return Object.entries(grouped)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function quarterlySpend(expenditures, adjustments, year) {
  return [1, 2, 3, 4].map((quarter) => {
    const expenseTotal = expenditures
      .filter((expense) => expense.status === FINANCE_STATUSES.APPROVED && isWithinQuarter(expense.expenseDate, year, quarter))
      .reduce((sum, expense) => sum + money(expense.amount), 0);
    const adjustmentTotal = adjustments
      .filter((adjustment) => adjustment.status === FINANCE_STATUSES.APPROVED && isWithinQuarter(adjustment.effectiveDate, year, quarter))
      .reduce((sum, adjustment) => sum + signedAdjustmentAmount(adjustment), 0);
    return { quarter: `Q${quarter}`, amount: money(expenseTotal + adjustmentTotal) };
  });
}

/**
 * Section 7 (Quarter interaction): `quarter`, when given alongside `year`,
 * adds a `period` block scoped to that quarter — it never changes the
 * budget figures (originalBudget/revisedBudget) or the cumulative
 * actualSpend/committedAmount/availableBalance totals, which always reflect
 * the project's full approved history. Selected-period spend is reported
 * separately so the UI can never mislabel it as total Actual Spend.
 */
function buildProjectAnalytics(project, records, { year = new Date().getUTCFullYear(), quarter = null } = {}) {
  const performance = calculateBudgetPerformance(
    records.budgetLines,
    records.expenditures,
    records.reallocations,
    records.adjustments,
    records.commitments || []
  );
  const pending = pendingRecords(records);
  const currencyTotals = summarizePerformanceByCurrency(performance, pending);
  const totals = currencyTotals[0] || {
    currency: project.budgetCurrency,
    originalBudget: 0,
    revisedBudget: 0,
    approvedSpend: 0,
    actualSpend: 0,
    committedAmount: 0,
    consumption: 0,
    availableBalance: 0,
    uncommittedBalance: 0,
    utilisation: 0,
    pendingReview: pending.length,
  };
  const approvedExpenses = records.expenditures.filter((expense) => expense.status === FINANCE_STATUSES.APPROVED);
  const approvedAdjustments = records.adjustments.filter((adjustment) => adjustment.status === FINANCE_STATUSES.APPROVED);
  const recentTransactions = [...approvedExpenses]
    .sort((a, b) => new Date(b.expenseDate) - new Date(a.expenseDate))
    .slice(0, 8)
    .map(unpackFinanceDocument);
  const recentReallocations = records.reallocations
    .filter((record) => record.status === FINANCE_STATUSES.APPROVED)
    .sort((a, b) => new Date(b.reviewedAt || b.$updatedAt) - new Date(a.reviewedAt || a.$updatedAt))
    .slice(0, 8)
    .map(unpackFinanceDocument);

  const periodApplicable = Number.isInteger(Number(quarter)) && Number(quarter) >= 1 && Number(quarter) <= 4;
  const periodExpenses = periodApplicable
    ? approvedExpenses.filter((expense) => isWithinQuarter(expense.expenseDate, year, quarter))
    : [];
  const periodAdjustments = periodApplicable
    ? approvedAdjustments.filter((adjustment) => isWithinQuarter(adjustment.effectiveDate, year, quarter))
    : [];
  const periodByLine = new Map();
  for (const expense of periodExpenses) periodByLine.set(expense.budgetLineId, money((periodByLine.get(expense.budgetLineId) || 0) + money(expense.amount)));
  for (const adjustment of periodAdjustments) periodByLine.set(adjustment.budgetLineId, money((periodByLine.get(adjustment.budgetLineId) || 0) + signedAdjustmentAmount(adjustment)));
  const periodSpend = money([...periodByLine.values()].reduce((sum, value) => sum + value, 0));

  return {
    project: {
      $id: project.$id,
      code: project.code,
      name: project.name,
      budgetAmount: money(project.budgetAmount),
      budgetCurrency: project.budgetCurrency,
      status: project.status,
    },
    totals,
    activities: performance.map((line) => {
      const unpacked = unpackFinanceDocument(line);
      return periodApplicable ? { ...unpacked, periodSpend: money(periodByLine.get(line.$id) || 0) } : unpacked;
    }),
    pendingReview: pending.map(unpackFinanceDocument),
    spendByCategory: spendByCategory(records.expenditures, records.adjustments),
    quarterlySpend: quarterlySpend(records.expenditures, records.adjustments, year),
    recentTransactions,
    recentReallocations,
    exceptions: performance.filter((line) => line.isOverBudget || line.utilisation >= 90),
    // Selected-period figures — explicitly separate from the cumulative
    // totals above so period spend is never confused with total Actual Spend.
    period: {
      applicable: periodApplicable,
      year: Number(year),
      quarter: periodApplicable ? Number(quarter) : null,
      currency: totals.currency,
      spend: periodSpend,
      transactions: [...periodExpenses]
        .sort((a, b) => new Date(b.expenseDate) - new Date(a.expenseDate))
        .map(unpackFinanceDocument),
      byCategory: periodApplicable ? spendByCategory(periodExpenses, periodAdjustments) : [],
    },
  };
}

export async function getFinanceSummary(context, { projectId = null, year = null, quarter = null } = {}) {
  const selectedYear = Number(year) || new Date().getUTCFullYear();
  const selectedQuarter = quarter !== null && quarter !== undefined && quarter !== '' ? Number(quarter) : null;
  if (projectId) {
    const project = await getProjectForContext(context, projectId);
    const records = await projectFinanceRecords(project.$id);
    return { scope: 'project', ...buildProjectAnalytics(project, records, { year: selectedYear, quarter: selectedQuarter }) };
  }

  requireOrganizationFinanceRead(context);
  const [projects, budgetLines, expenditures, reallocations, adjustments, commitments] = await Promise.all([
    listAllDocuments(COLLECTIONS.PROJECTS, [Query.equal('organizationId', context.organizationId), Query.orderAsc('name')]),
    listAllDocuments(COLLECTIONS.BUDGET_LINES, [Query.equal('organizationId', context.organizationId)]),
    listAllDocuments(COLLECTIONS.EXPENDITURES, [Query.equal('organizationId', context.organizationId)]),
    listAllDocuments(COLLECTIONS.BUDGET_REALLOCATIONS, [Query.equal('organizationId', context.organizationId)]),
    listAllDocuments(COLLECTIONS.FINANCE_ADJUSTMENTS, [Query.equal('organizationId', context.organizationId)]),
    listAllDocuments(COLLECTIONS.COMMITMENTS, [Query.equal('organizationId', context.organizationId)]),
  ]);
  const projectRows = projects.map((project) => buildProjectAnalytics(project, {
    budgetLines: budgetLines.filter((record) => record.projectId === project.$id),
    expenditures: expenditures.filter((record) => record.projectId === project.$id),
    reallocations: reallocations.filter((record) => record.projectId === project.$id),
    adjustments: adjustments.filter((record) => record.projectId === project.$id),
    commitments: commitments.filter((record) => record.projectId === project.$id),
  }, { year: selectedYear, quarter: selectedQuarter }));
  const allPerformance = projectRows.flatMap((row) => row.activities);
  const allPending = projectRows.flatMap((row) => row.pendingReview);
  const currentQuarterIndex = Math.floor(new Date().getUTCMonth() / 3);
  const currencyGroups = summarizePerformanceByCurrency(allPerformance, allPending).map((group) => ({
    ...group,
    quarterSpend: money(projectRows
      .filter((row) => row.project.budgetCurrency === group.currency)
      .reduce((sum, row) => sum + (row.quarterlySpend[currentQuarterIndex]?.amount || 0), 0)),
  }));
  return {
    scope: 'organization',
    year: selectedYear,
    currencyGroups,
    projects: projectRows.map((row) => ({
      ...row.project,
      ...row.totals,
      exceptions: row.exceptions.length,
    })),
    pendingReview: allPending.length,
    exceptions: projectRows.reduce((sum, row) => sum + row.exceptions.length, 0),
    recentReallocations: projectRows
      .flatMap((row) => row.recentReallocations.map((record) => ({ ...record, projectName: row.project.name })))
      .sort((a, b) => new Date(b.reviewedAt || b.$updatedAt) - new Date(a.reviewedAt || a.$updatedAt))
      .slice(0, 4),
  };
}

export async function getQuarterlyReport(context, { projectId, year, quarter }) {
  const project = await getProjectForContext(context, projectId);
  const selectedYear = Number(year) || new Date().getUTCFullYear();
  const selectedQuarter = Number(quarter);
  if (!Number.isInteger(selectedQuarter) || selectedQuarter < 1 || selectedQuarter > 4) {
    throw new HttpError(400, 'quarter must be between 1 and 4.', 'VALIDATION_ERROR');
  }
  const records = await projectFinanceRecords(project.$id);
  const performance = calculateBudgetPerformance(
    records.budgetLines,
    records.expenditures,
    records.reallocations,
    records.adjustments
  );
  const quarterEndMonth = selectedQuarter * 3;
  const quarterEnd = new Date(Date.UTC(selectedYear, quarterEndMonth, 1));
  const expensesByLine = new Map();
  const cumulativeByLine = new Map();
  const expenseById = new Map(records.expenditures.map((expense) => [expense.$id, expense]));

  for (const expense of records.expenditures) {
    if (expense.status !== FINANCE_STATUSES.APPROVED) continue;
    const expenseDate = new Date(expense.expenseDate);
    if (expenseDate < quarterEnd) {
      cumulativeByLine.set(expense.budgetLineId, money((cumulativeByLine.get(expense.budgetLineId) || 0) + expense.amount));
    }
    if (isWithinQuarter(expense.expenseDate, selectedYear, selectedQuarter)) {
      expensesByLine.set(expense.budgetLineId, money((expensesByLine.get(expense.budgetLineId) || 0) + expense.amount));
    }
  }
  for (const adjustment of records.adjustments) {
    if (adjustment.status !== FINANCE_STATUSES.APPROVED) continue;
    const effectiveDate = new Date(adjustment.effectiveDate);
    const signed = signedAdjustmentAmount(adjustment);
    if (effectiveDate < quarterEnd) {
      cumulativeByLine.set(adjustment.budgetLineId, money((cumulativeByLine.get(adjustment.budgetLineId) || 0) + signed));
    }
    if (isWithinQuarter(adjustment.effectiveDate, selectedYear, selectedQuarter)) {
      expensesByLine.set(adjustment.budgetLineId, money((expensesByLine.get(adjustment.budgetLineId) || 0) + signed));
    }
  }

  const activities = performance.map((line) => {
    const quarterSpend = expensesByLine.get(line.$id) || 0;
    const cumulativeSpend = cumulativeByLine.get(line.$id) || 0;
    const remaining = money(line.revisedBudget - cumulativeSpend);
    return {
      budgetLineId: line.$id,
      activityId: line.activityId,
      activityCode: line.activityCode,
      activityName: line.activityName,
      currency: line.currency,
      originalBudget: line.originalBudget,
      revisedBudget: line.revisedBudget,
      quarterSpend,
      cumulativeSpend,
      remaining,
      variance: remaining,
      utilisation: line.revisedBudget > 0
        ? Math.round((cumulativeSpend / line.revisedBudget) * 10000) / 100
        : 0,
    };
  });

  const byCategory = {};
  const byResponsible = {};
  for (const expense of records.expenditures) {
    if (expense.status !== FINANCE_STATUSES.APPROVED || !isWithinQuarter(expense.expenseDate, selectedYear, selectedQuarter)) continue;
    byCategory[expense.category] = money((byCategory[expense.category] || 0) + expense.amount);
    byResponsible[expense.responsibleStaffName] = money((byResponsible[expense.responsibleStaffName] || 0) + expense.amount);
  }
  for (const adjustment of records.adjustments) {
    if (adjustment.status !== FINANCE_STATUSES.APPROVED || !isWithinQuarter(adjustment.effectiveDate, selectedYear, selectedQuarter)) continue;
    const original = expenseById.get(adjustment.originalExpenseId);
    const signed = signedAdjustmentAmount(adjustment);
    const category = original?.category || 'other';
    const responsible = original?.responsibleStaffName || 'Unassigned';
    byCategory[category] = money((byCategory[category] || 0) + signed);
    byResponsible[responsible] = money((byResponsible[responsible] || 0) + signed);
  }

  const totals = activities.reduce((result, activity) => ({
    originalBudget: money(result.originalBudget + activity.originalBudget),
    revisedBudget: money(result.revisedBudget + activity.revisedBudget),
    quarterSpend: money(result.quarterSpend + activity.quarterSpend),
    cumulativeSpend: money(result.cumulativeSpend + activity.cumulativeSpend),
    remaining: money(result.remaining + activity.remaining),
  }), { originalBudget: 0, revisedBudget: 0, quarterSpend: 0, cumulativeSpend: 0, remaining: 0 });

  return {
    project: {
      $id: project.$id,
      code: project.code,
      name: project.name,
      currency: project.budgetCurrency,
    },
    year: selectedYear,
    quarter: selectedQuarter,
    totals: {
      ...totals,
      variance: totals.remaining,
      utilisation: totals.revisedBudget > 0
        ? Math.round((totals.cumulativeSpend / totals.revisedBudget) * 10000) / 100
        : 0,
    },
    activities,
    byCategory: Object.entries(byCategory).map(([name, amount]) => ({ name, amount })),
    byResponsible: Object.entries(byResponsible).map(([name, amount]) => ({ name, amount })),
    reallocations: records.reallocations
      .filter((record) => record.status === FINANCE_STATUSES.APPROVED && isWithinQuarter(record.reviewedAt, selectedYear, selectedQuarter))
      .map(unpackFinanceDocument),
  };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// ---------------------------------------------------------------------------
// Section 7 — Variance explanations. Materiality is a configurable Finance
// setting (see financeDomain.DEFAULT_FINANCE_SETTINGS.varianceMaterialityPercent),
// never a UI-only constant, so the threshold used to flag a record here is the
// same one editable via updateFinanceSettings.
// ---------------------------------------------------------------------------

async function currentVarianceForScope(context, project, { budgetLineId = null, activityId = null }) {
  const records = await projectFinanceRecords(project.$id);
  const performance = calculateBudgetPerformance(
    records.budgetLines, records.expenditures, records.reallocations, records.adjustments
  );
  const scoped = budgetLineId
    ? performance.filter((line) => line.$id === budgetLineId)
    : activityId
      ? performance.filter((line) => line.activityId === activityId)
      : performance;
  if (scoped.length === 0) return null;
  const revisedBudget = money(scoped.reduce((sum, line) => sum + line.revisedBudget, 0));
  const availableBalance = money(scoped.reduce((sum, line) => sum + line.availableBalance, 0));
  const variancePercent = revisedBudget > 0 ? Math.round((Math.abs(availableBalance) / revisedBudget) * 10000) / 100 : 0;
  return { varianceAmount: availableBalance, variancePercent, currency: scoped[0].currency };
}

export async function listVarianceExplanations(context, filters = {}) {
  if (filters.projectId) await getProjectForContext(context, filters.projectId);
  else requireOrganizationFinanceRead(context);
  const queries = [Query.equal('organizationId', context.organizationId), Query.orderDesc('$createdAt')];
  if (filters.projectId) queries.push(Query.equal('projectId', filters.projectId));
  if (filters.budgetLineId) queries.push(Query.equal('budgetLineId', filters.budgetLineId));
  if (filters.status) queries.push(Query.equal('status', filters.status));
  return (await listAllDocuments(COLLECTIONS.VARIANCE_EXPLANATIONS, queries)).map(unpackFinanceDocument);
}

async function varianceExplanationPayload(context, input, existing = null) {
  const project = await getProjectForContext(
    context,
    input.projectId || existing?.projectId,
    { permission: 'budgetProposal' }
  );
  const budgetLineId = cleanText(input.budgetLineId === undefined ? existing?.budgetLineId : input.budgetLineId, 64);
  const activityId = cleanText(input.activityId === undefined ? existing?.activityId : input.activityId, 64);
  let activityCode = null;
  let activityName = null;
  if (budgetLineId) {
    const line = await getLineInProject(budgetLineId, project);
    activityCode = line.activityCode || null;
    activityName = line.activityName;
  }
  const periodType = normalizePeriodType(input.periodType ?? existing?.periodType);
  const periodKey = cleanText(input.periodKey ?? existing?.periodKey, 64, { required: true, label: 'Reporting period' });
  const settings = await resolveFinanceSettings(context, project.$id);
  const computed = await currentVarianceForScope(context, project, { budgetLineId, activityId });
  return {
    organizationId: context.organizationId,
    projectId: project.$id,
    budgetLineId: budgetLineId || null,
    activityId: activityId || null,
    activityCode,
    activityName,
    periodType,
    periodKey,
    currency: computed?.currency || projectCurrency(project),
    varianceAmount: computed?.varianceAmount ?? 0,
    variancePercent: computed?.variancePercent ?? 0,
    materialityThresholdPercent: settings.varianceMaterialityPercent,
    explanation: cleanText(input.explanation ?? existing?.explanation, 4000, { required: true, label: 'Variance explanation' }),
  };
}

export async function createVarianceExplanation(context, input) {
  const payload = await varianceExplanationPayload(context, input);
  const submit = input.submit === true;
  let history = appendEvent(null, context, 'created');
  if (submit) history = appendHistory(history, workflowEvent(context, 'submitted'));
  return unpackFinanceDocument(await adminDatabases.createDocument(
    DB_ID,
    COLLECTIONS.VARIANCE_EXPLANATIONS,
    ID.unique(),
    {
      ...payload,
      status: submit ? FINANCE_STATUSES.SUBMITTED : FINANCE_STATUSES.DRAFT,
      createdBy: context.accountId,
      createdByName: context.displayName,
      submittedAt: submit ? new Date().toISOString() : null,
      lastEditedBy: context.accountId,
      workflowHistory: history,
    },
    []
  ));
}

export async function updateVarianceExplanation(context, id, input) {
  const record = await adminDatabases.getDocument(DB_ID, COLLECTIONS.VARIANCE_EXPLANATIONS, id);
  if (!canEditFinanceRecord(record, context.accountId)) {
    throw new HttpError(409, 'Only your draft or returned explanation can be edited.', 'FINANCE_RECORD_LOCKED');
  }
  const payload = await varianceExplanationPayload(context, input, record);
  const submit = input.submit === true;
  let history = appendEvent(record, context, 'edited');
  if (submit) {
    history = appendHistory(
      history,
      workflowEvent(context, record.status === FINANCE_STATUSES.RETURNED ? 'resubmitted' : 'submitted')
    );
  }
  return unpackFinanceDocument(await adminDatabases.updateDocument(DB_ID, COLLECTIONS.VARIANCE_EXPLANATIONS, id, {
    ...payload,
    status: submit ? FINANCE_STATUSES.SUBMITTED : record.status,
    submittedAt: submit ? new Date().toISOString() : record.submittedAt,
    reviewerComment: submit ? null : record.reviewerComment,
    lastEditedBy: context.accountId,
    workflowHistory: history,
  }));
}

// ---------------------------------------------------------------------------
// Section 9 — Management exceptions ("Needs Attention"). Every item is
// derived directly from live records; nothing here is fabricated, and every
// item carries an href so it drills into its underlying record.
// ---------------------------------------------------------------------------

function daysBetween(from, to = new Date()) {
  return Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000)));
}

export async function getFinanceExceptions(context, filters = {}) {
  const { projectId = null, type = null, severity = null } = filters;
  const accessible = projectId
    ? [await getProjectForContext(context, projectId)]
    : (await listAllDocuments(COLLECTIONS.PROJECTS, [Query.equal('organizationId', context.organizationId)]))
      .filter((project) => project.organizationId === context.organizationId);
  const visibleProjects = [];
  for (const project of accessible) {
    const capabilities = await getProjectFinanceCapabilities(context, project);
    if (capabilities.canView) visibleProjects.push(project);
  }

  const items = [];
  for (const project of visibleProjects) {
    const [records, settings, varianceExplanations] = await Promise.all([
      projectFinanceRecords(project.$id),
      resolveFinanceSettings(context, project.$id),
      listAllDocuments(COLLECTIONS.VARIANCE_EXPLANATIONS, [
        Query.equal('organizationId', context.organizationId),
        Query.equal('projectId', project.$id),
      ]),
    ]);
    const performance = calculateBudgetPerformance(
      records.budgetLines, records.expenditures, records.reallocations, records.adjustments, records.commitments
    );
    const explainedLineIds = new Set(
      varianceExplanations
        .filter((item) => item.status !== FINANCE_STATUSES.REJECTED)
        .map((item) => item.budgetLineId)
        .filter(Boolean)
    );

    for (const line of performance) {
      const band = utilisationBand(line.utilisation, settings);
      if (band.key === 'near_limit') {
        items.push({
          type: 'near_limit', severity: 'warning',
          title: `${line.activityName} is nearing its budget limit`,
          description: `Utilisation is ${line.utilisation}% of the revised budget (threshold ${settings.nearLimitThresholdPercent}%).`,
          projectId: project.$id, projectCode: project.code, projectName: project.name,
          activityId: line.activityId, activityCode: line.activityCode, activityName: line.activityName,
          amount: line.availableBalance, currency: line.currency,
          href: `/finance/budgets?projectId=${project.$id}`,
        });
      } else if (band.key === 'at_or_over_budget') {
        items.push({
          type: 'over_budget', severity: 'critical',
          title: `${line.activityName} is at or over budget`,
          description: `Utilisation is ${line.utilisation}% of the revised budget; available balance is ${line.availableBalance} ${line.currency}.`,
          projectId: project.$id, projectCode: project.code, projectName: project.name,
          activityId: line.activityId, activityCode: line.activityCode, activityName: line.activityName,
          amount: line.availableBalance, currency: line.currency,
          href: `/finance/budgets?projectId=${project.$id}`,
        });
      }
      const materiality = settings.varianceMaterialityPercent;
      if (line.utilisation !== 0 && Math.abs(100 - line.utilisation) >= materiality && !explainedLineIds.has(line.$id)) {
        items.push({
          type: 'variance_explanation_required', severity: 'medium',
          title: `${line.activityName} needs a variance explanation`,
          description: `Variance against the revised budget exceeds the ${materiality}% materiality threshold and has no recorded explanation.`,
          projectId: project.$id, projectCode: project.code, projectName: project.name,
          activityId: line.activityId, activityCode: line.activityCode, activityName: line.activityName,
          amount: line.availableBalance, currency: line.currency,
          href: `/finance/budgets?projectId=${project.$id}`,
        });
      }
      if (line.revisedBudget > 0 && line.approvedSpend === 0 && line.committedAmount === 0) {
        items.push({
          type: 'no_spend', severity: 'info',
          title: `${line.activityName} has budget but no recorded spend`,
          description: `A revised budget of ${line.revisedBudget} ${line.currency} has no approved expenditure or commitment against it yet.`,
          projectId: project.$id, projectCode: project.code, projectName: project.name,
          activityId: line.activityId, activityCode: line.activityCode, activityName: line.activityName,
          amount: line.revisedBudget, currency: line.currency,
          href: `/finance/budgets?projectId=${project.$id}`,
        });
      }
    }

    const agedSubmitted = [
      ...records.expenditures.map((record) => ({ ...record, kind: 'expenditure', href: `/finance/expenses?projectId=${project.$id}` })),
      ...records.budgetLines.map((record) => ({ ...record, kind: 'budgetLine', href: `/finance/budgets?projectId=${project.$id}` })),
      ...records.reallocations.map((record) => ({ ...record, kind: 'reallocation', href: `/finance/reallocations?projectId=${project.$id}` })),
    ].filter((record) => record.status === FINANCE_STATUSES.SUBMITTED);
    for (const record of agedSubmitted) {
      const ageDays = daysBetween(record.submittedAt || record.$createdAt);
      if (ageDays > settings.reviewSlaDays) {
        items.push({
          type: 'aged_review', severity: ageDays > settings.reviewSlaDays * 2 ? 'high' : 'warning',
          title: `${titleCaseKind(record.kind)} awaiting review for ${ageDays} day${ageDays === 1 ? '' : 's'}`,
          description: `Submitted ${formatShortDate(record.submittedAt)} and still awaiting a reviewer decision (SLA is ${settings.reviewSlaDays} days).`,
          projectId: project.$id, projectCode: project.code, projectName: project.name,
          activityId: record.activityId || null, activityCode: record.activityCode || null, activityName: record.activityName || null,
          amount: record.amount ?? record.originalAmount, currency: record.currency,
          ageDays, detectedAt: new Date().toISOString(),
          href: record.href,
        });
      }
    }

    for (const record of records.reallocations) {
      if (record.status !== FINANCE_STATUSES.SUBMITTED) continue;
      items.push({
        type: 'pending_reallocation', severity: 'medium',
        title: `Reallocation pending: ${record.fromActivityName} → ${record.toActivityName}`,
        description: record.reason,
        projectId: project.$id, projectCode: project.code, projectName: project.name,
        amount: record.amount, currency: record.currency,
        href: `/finance/reallocations?projectId=${project.$id}`,
      });
    }

    for (const record of records.expenditures) {
      if (record.status !== FINANCE_STATUSES.SUBMITTED) continue;
      const evidence = parseJsonArray(record.evidenceMetadata);
      if (evidence.length === 0) {
        items.push({
          type: 'missing_evidence', severity: 'warning',
          title: `${record.activityName} expense has no supporting evidence`,
          description: record.evidenceMissingReason
            ? `Documented exception: ${record.evidenceMissingReason}`
            : 'No evidence has been attached to this submitted expense.',
          projectId: project.$id, projectCode: project.code, projectName: project.name,
          activityId: record.activityId, activityCode: record.activityCode, activityName: record.activityName,
          amount: record.amount, currency: record.currency,
          href: `/finance/expenses?projectId=${project.$id}`,
        });
      }
    }
  }

  const filtered = items
    .filter((item) => !type || item.type === type)
    .filter((item) => !severity || item.severity === severity)
    .map((item, index) => ({ $id: `${item.projectId}-${item.type}-${item.activityId || item.recordId || index}`, ...item }));
  return filtered;
}

function titleCaseKind(kind) {
  return { budgetLine: 'Budget proposal', expenditure: 'Expense', reallocation: 'Reallocation', adjustment: 'Adjustment', commitment: 'Commitment' }[kind] || kind;
}

function formatShortDate(value) {
  if (!value) return 'an unknown date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'an unknown date' : date.toISOString().slice(0, 10);
}

export function quarterlyReportCsv(report) {
  const rows = [
    ['Activity code', 'Activity', 'Currency', 'Original budget', 'Revised budget', 'Quarter spend', 'Cumulative spend', 'Remaining', 'Variance', 'Utilisation %'],
    ...report.activities.map((activity) => [
      activity.activityCode || '',
      activity.activityName,
      activity.currency,
      activity.originalBudget,
      activity.revisedBudget,
      activity.quarterSpend,
      activity.cumulativeSpend,
      activity.remaining,
      activity.variance,
      activity.utilisation,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

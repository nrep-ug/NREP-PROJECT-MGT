import { Account, Client, Teams } from 'node-appwrite';
import { adminDatabases, adminTeams, COLLECTIONS, DB_ID, Query } from './appwriteAdmin';
import { deriveOrganizationFinanceAccess } from './financeDomain';

const ENDPOINT = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;

export class HttpError extends Error {
  constructor(status, message, code = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== 'bearer' || !token || token.length > 4096) {
    throw new HttpError(401, 'A valid authenticated session is required.', 'AUTH_REQUIRED');
  }
  return token;
}

function displayName(profile, authUser) {
  const profileName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim();
  return profileName || authUser.name || authUser.email || 'NREP user';
}

/**
 * Validate an Appwrite JWT and build the only identity context trusted by
 * privileged API routes. Organization membership comes from Appwrite Teams,
 * not from request parameters or a user-editable browser object.
 */
export async function requireAuthenticatedContext(request) {
  if (!ENDPOINT || !PROJECT_ID) {
    throw new HttpError(503, 'Authentication service is not configured.', 'AUTH_NOT_CONFIGURED');
  }

  const jwt = getBearerToken(request);
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setJWT(jwt)
    .addHeader('X-Appwrite-Response-Format', '1.9.0');

  let authUser;
  let teamList;
  try {
    [authUser, teamList] = await Promise.all([
      new Account(client).get(),
      new Teams(client).list([Query.limit(100)]),
    ]);
  } catch {
    throw new HttpError(401, 'Your session is invalid or has expired.', 'AUTH_INVALID');
  }

  const profiles = await adminDatabases.listDocuments(DB_ID, COLLECTIONS.USERS, [
    Query.equal('accountId', authUser.$id),
    Query.limit(1),
  ]);
  const profile = profiles.documents[0];
  if (!profile || profile.status === 'inactive' || profile.status === 'suspended') {
    throw new HttpError(403, 'Your NREP user profile is not active.', 'PROFILE_INACTIVE');
  }

  const teams = teamList.teams || [];
  const teamIds = teams.map((team) => team.$id);
  const organizationTeams = teams.filter((team) => team.$id.startsWith('org_'));
  const preferredOrganization = organizationTeams.find(
    (team) => team.$id === profile.organizationId
  );
  const organization = preferredOrganization;
  if (!organization) {
    throw new HttpError(403, 'Your profile organization does not match an active team membership.', 'ORG_MEMBERSHIP_MISMATCH');
  }

  const memberships = await adminTeams.listMemberships(organization.$id, [
    Query.equal('userId', authUser.$id),
    Query.limit(2),
  ]);
  const organizationMembership = memberships.memberships.find(
    (membership) => membership.userId === authUser.$id && membership.confirm !== false
  );
  if (!organizationMembership) {
    throw new HttpError(403, 'Your organization membership is not active.', 'ORG_MEMBERSHIP_MISMATCH');
  }

  const labels = Array.isArray(authUser.labels) ? authUser.labels : [];
  const organizationRoles = Array.isArray(organizationMembership.roles)
    ? organizationMembership.roles
    : [];
  let financeAccess;
  try {
    financeAccess = deriveOrganizationFinanceAccess(organizationRoles);
  } catch (error) {
    throw new HttpError(
      403,
      'Your Finance role assignment is conflicting. Ask an administrator to correct it.',
      error?.code || 'FINANCE_ROLE_CONFLICT'
    );
  }
  const financeRoles = financeAccess.roles;
  const financeRole = financeAccess.financeRole || (
    financeAccess.isBudgetApprover ? 'budget_approver' : financeAccess.isFinanceAdmin ? 'administrator' : null
  );
  const isAdmin = labels.includes('admin');
  const isManager = labels.includes('manager') || isAdmin;
  const hasFinanceRole = financeRoles.length > 0;

  return {
    accountId: authUser.$id,
    authUser,
    profile,
    organizationId: organization.$id,
    organizationName: organization.name,
    organizationMembership,
    organizationRoles,
    teams,
    teamIds,
    labels,
    isAdmin,
    isManager,
    hasFinanceRole,
    financeRole,
    financeRoles,
    displayName: displayName(profile, authUser),
    canViewOrganizationFinance: isManager || financeAccess.canViewOrganizationFinance,
    canEditFinance: financeAccess.canPrepareFinanceRecords,
    canReviewFinance: financeAccess.canReviewExpenses,
    canApproveBudgets: isAdmin || financeAccess.canApproveBudgets,
    canAdministerFinance: isAdmin || financeAccess.canAdministerFinance,
  };
}

export function requireAdmin(context) {
  if (!context.isAdmin) {
    throw new HttpError(403, 'Administrator access is required.', 'ADMIN_REQUIRED');
  }
}

export function requireFinanceOfficer(context) {
  if (!context.canEditFinance) {
    throw new HttpError(403, 'Finance Officer access is required.', 'FINANCE_OFFICER_REQUIRED');
  }
}

export function requireFinanceReviewer(context) {
  if (!context.canReviewFinance) {
    throw new HttpError(403, 'Finance Reviewer access is required.', 'FINANCE_REVIEWER_REQUIRED');
  }
}

export function requireBudgetApprover(context) {
  if (!context.canApproveBudgets) {
    throw new HttpError(403, 'Budget Approver access is required.', 'BUDGET_APPROVER_REQUIRED');
  }
}

export function requireFinanceAdministrator(context) {
  if (!context.canAdministerFinance) {
    throw new HttpError(403, 'Finance Administrator access is required.', 'FINANCE_ADMIN_REQUIRED');
  }
}

export function apiErrorResponse(error) {
  const status = error instanceof HttpError
    ? error.status
    : error?.code === 404
      ? 404
      : 500;
  const message = error instanceof HttpError
    ? error.message
    : status === 404
      ? 'The requested record was not found.'
      : 'The request could not be completed.';
  return {
    status,
    body: {
      error: message,
      ...(error instanceof HttpError && error.code ? { code: error.code } : {}),
    },
  };
}

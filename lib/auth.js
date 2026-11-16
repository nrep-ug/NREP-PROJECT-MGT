/**
 * Authentication utilities for checking sessions and permissions
 */

import { account, databases, teams, Query, COLLECTIONS } from './appwriteClient';
import { normalizeUgPhone } from './cleanCooking/domain';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68fb5845001d32f31656';

// Clean Cooking champions log in with their phone number; their Appwrite
// account uses this derived address (see lib/cleanCooking/championAccounts.js).
const CHAMPION_LOGIN_DOMAIN = 'champions.nrep.ug';

/** True for field-only accounts (champions): "field" label and no staff/client label. */
export function isFieldOnlyAccount(authUser) {
  const labels = authUser?.labels || [];
  return labels.includes('field') && !labels.some((l) => ['staff', 'admin', 'manager', 'client'].includes(l));
}

/**
 * Turn what the person typed into the Appwrite login email.
 * "0700 123 456" -> "256700123456@champions.nrep.ug"; emails pass through.
 * Throws a friendly error for something that is neither.
 */
export function resolveLoginIdentifier(identifier) {
  const value = String(identifier || '').trim();
  if (value.includes('@')) return value.toLowerCase();
  const phone = normalizeUgPhone(value);
  if (!phone) throw new Error('Enter your email address, or your phone number like 0700 123 456.');
  return `${phone.replace(/\D/g, '')}@${CHAMPION_LOGIN_DOMAIN}`;
}

/**
 * Get current authenticated user from session
 * @returns {Promise<Object|null>} User object or null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const user = await account.get();
    return user;
  } catch (error) {
    return null;
  }
}

/**
 * Get full user session data including profile, organization, and teams
 * @returns {Promise<Object|null>} Complete user session object or null
 */
export async function getUserSession() {
  try {

    // Step 1: Get authenticated user from session
    const authUser = await account.get();

    if (!authUser) return null;

    // Champions have no staff profile or organization membership by design;
    // they use the /field portal, not the staff session.
    if (isFieldOnlyAccount(authUser)) return null;

    // Step 2: Get user's teams to find organization and collect memberships
    const userTeams = await teams.list();

    // Step 2b: Collect all team memberships with roles for project-level permission checks
    // teams.list() returns Team objects but doesn't include the user's roles.
    // We need to fetch memberships for each team to get the user's roles.
    const teamMemberships = [];
    const membershipResults = await Promise.allSettled(
      userTeams.teams.map(async (t) => {
        try {
          const memberships = await teams.listMemberships(t.$id, [
            Query.equal('userId', authUser.$id),
            Query.limit(1)
          ]);
          if (memberships.memberships.length > 0) {
            return {
              teamId: t.$id,
              teamName: t.name,
              roles: memberships.memberships[0].roles || [],
            };
          }
          return null;
        } catch (err) {
          // User might not have permission to list memberships for some teams
          return { teamId: t.$id, teamName: t.name, roles: [] };
        }
      })
    );
    for (const result of membershipResults) {
      if (result.status === 'fulfilled' && result.value) {
        teamMemberships.push(result.value);
      }
    }

    // Step 3: Fetch user profile from database
    const userProfiles = await databases.listDocuments(
      DB_ID,
      COLLECTIONS.USERS,
      [
        Query.equal('accountId', authUser.$id),
        Query.limit(1)
      ]
    );

    if (userProfiles.documents.length === 0) {
      console.error('[getUserSession] User profile not found for accountId:', authUser.$id);
      throw new Error('User profile not found');
    }

    const userProfile = userProfiles.documents[0];
    const orgTeam = userTeams.teams.find((team) => team.$id === userProfile.organizationId);
    if (!orgTeam) {
      console.error('[getUserSession] Profile organization does not match an active team membership');
      throw new Error('Organization membership mismatch');
    }

    // Step 4: Get user's role from labels (not from team membership)
    // Note: 'admin' users automatically have both 'admin' and 'staff' labels
    const userLabels = authUser.labels || [];

    const isAdmin = userLabels.includes('admin');
    const isStaff = userLabels.includes('staff') || userLabels.includes('admin');
    const isClient = userLabels.includes('client');
    const organizationMembership = teamMemberships.find(
      (membership) => membership.teamId === userProfile.organizationId
    );
    const organizationRoles = organizationMembership?.roles || [];
    const financeRoles = organizationRoles.filter((role) => [
      'finance_officer',
      'finance_reviewer',
      'finance_budget_approver',
      'finance_admin',
    ].includes(role));
    const financeRole = financeRoles.includes('finance_reviewer')
      ? 'reviewer'
      : financeRoles.includes('finance_officer')
        ? 'officer'
        : financeRoles.includes('finance_budget_approver')
          ? 'budget_approver'
          : financeRoles.includes('finance_admin')
            ? 'administrator'
            : null;
    const isFinance = financeRoles.length > 0;
    const hasProjectFinanceAccess = teamMemberships.some((membership) => (
      membership.teamId !== userProfile.organizationId &&
      membership.roles?.some((role) => ['owner', 'manager'].includes(role))
    ));

    // Step 5: Check if user is a supervisor (if anyone has them as supervisedBy)
    // Later in the code we switched to using labels for roles, but this check remains for backward compatibility and specific logic.
    const supervisedStaff = await databases.listDocuments(
      DB_ID,
      COLLECTIONS.USERS,
      [
        Query.equal('supervisedBy', authUser.$id),
        Query.limit(1) // Just check if any exist
      ]
    );

    // Determine if user is a supervisor based on labels or supervised staff
    const isSupervisor = userLabels.includes('supervisor') || supervisedStaff.documents.length > 0;

    // Step 6: Fetch organization details
    const orgDocs = await databases.listDocuments(
      DB_ID,
      COLLECTIONS.ORGANIZATIONS,
      [
        Query.equal('$id', orgTeam.$id),
        Query.limit(1)
      ]
    );

    const organization = orgDocs.documents.length > 0 ? orgDocs.documents[0] : null;

    // Return complete session object
    const sessionData = {
      authUser,           // Appwrite auth user object
      profile: userProfile, // User profile from database
      organization,       // Organization details
      organizationId: orgTeam.$id,
      organizationName: orgTeam.name,
      teams: teamMemberships, // All team memberships with roles (for project-level permissions)
      labels: userLabels,   // User's labels (roles)
      isAdmin,
      isStaff,
      isClient,
      isSupervisor,        // Whether user supervises other staff
      isFinance,           // Organization-scoped Finance membership role
      financeRole,
      financeRoles,
      organizationRoles,
      canApproveBudgets: isAdmin || financeRoles.includes('finance_budget_approver'),
      canAdministerFinance: isAdmin || financeRoles.includes('finance_admin'),
      hasProjectFinanceAccess,
    };

    return sessionData;
  } catch (error) {
    console.error('[getUserSession] Error:', error);
    console.error('[getUserSession] Error details:', error.message, error.stack);
    return null;
  }
}

/**
 * Login with email (staff, clients) or phone number (Clean Cooking champions)
 * @param {string} identifier email address or Ugandan phone number
 * @param {string} password
 * @returns {Promise<Object>} Staff/client session object, or { isChampion: true }
 */
export async function login(identifier, password) {
  const email = resolveLoginIdentifier(identifier);

  // Kill current session if any
  try {
    await logout();
  } catch (error) {
    // Ignore logout errors
    console.warn('[login] Logout before login failed:', error);
  }

  // Step 1: Create Appwrite session
  await account.createEmailPasswordSession(email, password);

  // Champions go to the field portal; they have no staff session by design.
  const authUser = await account.get();
  if (isFieldOnlyAccount(authUser)) return { isChampion: true, authUser };

  // Step 2: Get full user session data
  const session = await getUserSession();

  if (!session) {
    console.error('[login] Failed to load user session data');
    throw new Error('Failed to load user session data');
  }

  return session;
}

/**
 * Logout current session
 * @returns {Promise<void>}
 */
export async function logout() {
  return await account.deleteSessions();
}

/**
 * Create a new account
 * @param {string} email
 * @param {string} password
 * @param {string} name
 * @returns {Promise<Object>} User object
 */
export async function register(email, password, name) {
  const { ID } = await import('./appwriteClient');
  return await account.create(ID.unique(), email, password, name);
}

/**
 * Check if user is authenticated (for server-side)
 * @param {Request} request - Next.js request object
 * @returns {Promise<Object|null>} User object or null
 */
export async function getSessionFromRequest(request) {
  try {
    const cookie = request.headers.get('cookie');
    if (!cookie) return null;

    // Parse session cookie (Appwrite uses 'a_session_*' cookies)
    // This is a simplified check - in production you'd validate the session properly
    return cookie.includes('a_session_') ? {} : null;
  } catch (error) {
    return null;
  }
}

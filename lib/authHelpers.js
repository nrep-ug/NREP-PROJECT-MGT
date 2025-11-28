/**
 * Reusable authorization helper functions for API routes
 * Uses Appwrite labels for role-based access control
 */

import { adminDatabases, adminTeams, adminUsers, Query } from './appwriteAdmin';

const DB_ID = process.env.APPWRITE_DATABASE_ID || 'pms_db';
const COL_USERS = 'pms_users';

/**
 * Get user by account ID
 * @param {string} accountId - User account ID
 * @returns {Promise<Object|null>} Appwrite user object with labels
 */
async function getUserByAccountId(accountId) {
  try {
    const user = await adminUsers.get(accountId);
    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Verify if a user has admin label
 * @param {string} accountId - User account ID
 * @returns {Promise<boolean>}
 */
export async function verifyAdminAccess(accountId) {
  try {
    if (!accountId) {
      return false;
    }

    const user = await getUserByAccountId(accountId);
    if (!user) {
      return false;
    }

    // Check if user has admin label
    return user.labels && user.labels.includes('admin');
  } catch (error) {
    console.error('Error verifying admin access:', error);
    return false;
  }
}

/**
 * Verify if a user has manager or admin label
 * @param {string} accountId - User account ID
 * @returns {Promise<boolean>}
 */
export async function verifyManagerAccess(accountId) {
  try {
    if (!accountId) {
      return false;
    }

    const user = await getUserByAccountId(accountId);
    if (!user) {
      return false;
    }

    // Check if user has admin or manager label
    return user.labels && (
      user.labels.includes('admin') ||
      user.labels.includes('manager')
    );
  } catch (error) {
    console.error('Error verifying manager access:', error);
    return false;
  }
}

/**
 * Verify if a user is a staff member (staff, manager, or admin)
 * @param {string} accountId - User account ID
 * @returns {Promise<boolean>}
 */
export async function verifyStaffAccess(accountId) {
  try {
    if (!accountId) {
      return false;
    }

    const user = await getUserByAccountId(accountId);
    if (!user) {
      return false;
    }

    // Check if user has staff, manager, or admin label
    return user.labels && (
      user.labels.includes('staff') ||
      user.labels.includes('manager') ||
      user.labels.includes('admin')
    );
  } catch (error) {
    console.error('Error verifying staff access:', error);
    return false;
  }
}

/**
 * Verify if user belongs to an organization
 * @param {string} accountId - User account ID
 * @param {string} organizationId - Organization team ID
 * @returns {Promise<boolean>}
 */
export async function verifyOrgMembership(accountId, organizationId) {
  try {
    if (!accountId || !organizationId) {
      return false;
    }

    // Get organization team memberships
    const memberships = await adminTeams.listMemberships(organizationId);

    // Check if user is a member
    return memberships.memberships.some(m => m.userId === accountId);
  } catch (error) {
    console.error('Error verifying org membership:', error);
    return false;
  }
}

/**
 * Verify if a user has a specific role in a project team
 * @param {string} userId - User account ID
 * @param {string} projectTeamId - Project team ID
 * @param {string[]} allowedRoles - Array of allowed roles (e.g., ['owner', 'manager'])
 * @returns {Promise<boolean>}
 */
export async function verifyProjectAccess(userId, projectTeamId, allowedRoles = ['owner', 'manager']) {
  try {
    if (!userId || !projectTeamId) {
      return false;
    }

    // Get project team memberships
    const memberships = await adminTeams.listMemberships(projectTeamId);

    // Find user's membership
    const userMembership = memberships.memberships.find(
      m => m.userId === userId
    );

    if (!userMembership) {
      return false;
    }

    // Check if user has any of the allowed roles
    return userMembership.roles.some(role => allowedRoles.includes(role));
  } catch (error) {
    console.error('Error verifying project access:', error);
    return false;
  }
}

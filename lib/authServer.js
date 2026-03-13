/**
 * Server-side authentication utilities
 * Used in API routes to verify user permissions
 */

import { cookies } from 'next/headers';
import { adminDatabases, adminTeams, Query } from './appwriteAdmin';

const DB_ID = process.env.APPWRITE_DATABASE_ID || 'pms_db';
const COLLECTIONS = {
  USERS: 'pms_users'
};

/**
 * Verify if the authenticated user is an admin
 * @param {string} userId - User account ID
 * @param {string} organizationId - Organization team ID
 * @returns {Promise<boolean>} True if user is admin
 */
export async function isUserAdmin(userId, organizationId) {
  try {
    // Get user profile to find their organization
    const userProfiles = await adminDatabases.listDocuments(
      DB_ID,
      COLLECTIONS.USERS,
      [
        Query.equal('accountId', userId),
        Query.limit(1)
      ]
    );

    if (userProfiles.documents.length === 0) {
      return false;
    }

    const userProfile = userProfiles.documents[0];
    const userOrgId = userProfile.organizationId;

    // If organizationId is provided, verify it matches
    if (organizationId && userOrgId !== organizationId) {
      return false;
    }

    // Get team memberships for the user
    const memberships = await adminTeams.listMemberships(userOrgId);

    // Find this user's membership
    const userMembership = memberships.memberships.find(
      m => m.userId === userId
    );

    if (!userMembership) {
      return false;
    }

    // Check if user has admin role
    return userMembership.roles.includes('admin');
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

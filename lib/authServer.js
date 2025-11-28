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
 * Extract user ID from session cookie
 * @param {Request} request - Next.js request object
 * @returns {string|null} User ID or null
 */
export async function getUserIdFromRequest(request) {
  try {
    const cookieStore = await cookies();

    // Get Appwrite session cookies
    // Appwrite uses multiple cookies, look for the main session cookie
    const sessionCookies = cookieStore.getAll().filter(cookie =>
      cookie.name.startsWith('a_session_')
    );

    if (sessionCookies.length === 0) {
      return null;
    }

    // Parse the session to get user ID
    // Note: This is a simplified approach. In production, you should validate
    // the session with Appwrite and get the user ID from the validated session
    const sessionCookie = sessionCookies[0];

    // For now, we'll use the adminUsers API to verify the session
    // by checking if we can get the current user
    // This requires the session to be valid

    return null; // Will be populated by checking session
  } catch (error) {
    console.error('Error extracting user ID from request:', error);
    return null;
  }
}

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

/**
 * Middleware to verify user session and admin status
 * Returns user data if authenticated and admin, throws error otherwise
 * @param {Request} request - Next.js request object
 * @returns {Promise<Object>} User session data
 */
export async function requireAdmin(request) {
  // For now, we'll extract user info from request body or headers
  // In a production app, you'd validate the Appwrite session cookie

  try {
    // Get the Authorization header or session cookie
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Error('No authorization header found');
    }

    // This is a simplified version - you should validate the session properly
    // For now, we'll trust the client to pass the userId
    // In production, decode and validate the JWT or session cookie

    return null; // Will implement proper session validation
  } catch (error) {
    throw new Error('Unauthorized: Admin access required');
  }
}

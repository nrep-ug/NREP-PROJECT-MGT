/**
 * Authentication utilities for checking sessions and permissions
 */

import { account, databases, teams, Query, COLLECTIONS } from './appwriteClient';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68fb5845001d32f31656';

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

    // Step 2: Get user's teams to find organization
    const userTeams = await teams.list();

    const orgTeam = userTeams.teams.find(t => t.$id.startsWith('org_'));

    if (!orgTeam) {
      console.error('[getUserSession] No organization team found');
      throw new Error('User is not member of any organization');
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

    // Step 4: Get user's role from labels (not from team membership)
    // Note: 'admin' users automatically have both 'admin' and 'staff' labels
    const userLabels = authUser.labels || [];

    const isAdmin = userLabels.includes('admin');
    const isStaff = userLabels.includes('staff') || userLabels.includes('admin');
    const isClient = userLabels.includes('client');
    const isFinance = userLabels.includes('finance');

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
      labels: userLabels,   // User's labels (roles)
      isAdmin,
      isStaff,
      isClient,
      isSupervisor,        // Whether user supervises other staff
      isFinance           // Whether user has finance role
    };

    return sessionData;
  } catch (error) {
    console.error('[getUserSession] Error:', error);
    console.error('[getUserSession] Error details:', error.message, error.stack);
    return null;
  }
}

/**
 * Login with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} Complete user session object
 */
export async function login(email, password) {
  // Kill current session if any
  try {
    await logout();
  } catch (error) {
    // Ignore logout errors
    console.warn('[login] Logout before login failed:', error);
  }

  // Step 1: Create Appwrite session
  const appwriteSession = await account.createEmailPasswordSession(email, password);

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

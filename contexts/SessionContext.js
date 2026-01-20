'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { getUserSession } from '@/lib/auth';

/**
 * Session Context
 * Provides user session data throughout the application
 *
 * Session data includes:
 * - authUser: Appwrite auth user object
 * - profile: User profile from database (accountId, email, username, firstName, lastName, etc.)
 * - organization: Organization details
 * - organizationId: Organization team ID
 * - organizationName: Organization name
 * - labels: User's role labels (admin, staff, client) - Note: admins have both 'admin' and 'staff' labels
 * - isAdmin: Boolean flag for admin access
 * - isStaff: Boolean flag for staff access (includes admins)
 * - isClient: Boolean flag for client access
 * - isSupervisor: Boolean flag indicating if user supervises other staff
 * - supervisedBy: Account ID of user's supervisor (if any)
 */

const SessionContext = createContext({
  session: null,
  loading: true,
  error: null,
  refreshSession: async () => { },
  clearSession: () => { },
});

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Load user session on mount
   * Skip if on login page to avoid interference with login flow
   */
  useEffect(() => {
    // Don't auto-load session on login page
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      setLoading(false);
      return;
    }
    loadSession();
  }, []);

  /**
   * Load the user session from Appwrite
   */
  const loadSession = async () => {
    try {
      setLoading(true);
      setError(null);

      const sessionData = await getUserSession();

      if (sessionData) {
        // Structure the session data for easy access
        const structuredSession = {
          // Auth user
          authUser: sessionData.authUser,

          // Profile data
          profile: sessionData.profile,
          accountId: sessionData.profile?.accountId,
          email: sessionData.profile?.email,
          username: sessionData.profile?.username,
          firstName: sessionData.profile?.firstName,
          lastName: sessionData.profile?.lastName,
          otherNames: sessionData.profile?.otherNames,
          status: sessionData.profile?.status,
          title: sessionData.profile?.title,
          department: sessionData.profile?.department,
          timezone: sessionData.profile?.timezone || 'Africa/Kampala',
          avatarUrl: sessionData.profile?.avatarUrl,

          // Organization data
          organization: sessionData.organization,
          organizationId: sessionData.organizationId,
          organizationName: sessionData.organizationName,

          // Role labels and permissions
          labels: sessionData.labels || [],
          isAdmin: sessionData.isAdmin || false,
          isStaff: sessionData.isStaff || false,
          isClient: sessionData.isClient || false,
          isFinance: sessionData.isFinance || false,

          // Supervisor information
          isSupervisor: sessionData.isSupervisor || false,
          supervisedBy: sessionData.profile?.supervisedBy || null,
        };

        setSession(structuredSession);
        return structuredSession;
      } else {
        setSession(null);
        return null;
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      setError(err.message || 'Failed to load session');
      setSession(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh the session (useful after profile updates)
   * @returns {Promise<Object|null>} The refreshed session data or null
   */
  const refreshSession = async () => {
    return await loadSession();
  };

  /**
   * Clear the session (useful on logout)
   */
  const clearSession = () => {
    setSession(null);
    setError(null);
  };

  return (
    <SessionContext.Provider
      value={{
        session,
        loading,
        error,
        refreshSession,
        clearSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Custom hook to access the session context
 * @returns {Object} Session context with session data and methods
 */
export function useSession() {
  const context = useContext(SessionContext);

  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }

  return context;
}

/**
 * Custom hook to get the current user (shorthand)
 * @returns {Object|null} Current user session or null
 */
export function useUser() {
  const { session } = useSession();
  return session;
}

/**
 * Custom hook to check if user is authenticated
 * @returns {boolean} True if user is authenticated
 */
export function useAuth() {
  const { session, loading } = useSession();
  return { isAuthenticated: !!session, loading };
}

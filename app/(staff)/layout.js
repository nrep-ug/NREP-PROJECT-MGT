'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from 'react-bootstrap';

/**
 * Staff Route Group Layout
 *
 * This layout wraps all staff-only pages and automatically protects them.
 * - Redirects unauthenticated users to /login
 * - Redirects clients to /client/dashboard
 *
 * All pages inside app/(staff)/ are automatically protected.
 * The (staff) folder is a route group - it doesn't affect URLs.
 */
export default function StaffLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not authenticated - redirect to login
        console.log('[StaffLayout] No user, redirecting to login');
        router.push('/login');
      } else if (user.isClient) {
        // Client trying to access staff page - redirect to client dashboard
        console.log('[StaffLayout] Client detected, redirecting to client dashboard');
        router.push('/client/dashboard');
      }
    }
  }, [user, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <Spinner animation="border" role="status" />
          <p className="mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render content if user is not staff
  if (!user || user.isClient) {
    return null;
  }

  // User is authenticated and is staff - render children
  return <>{children}</>;
}

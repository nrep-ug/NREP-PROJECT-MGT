'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from 'react-bootstrap';

/**
 * Guard component that ensures only staff users can access the page
 * Redirects clients to /client/dashboard
 * Redirects unauthenticated users to /login
 */
export default function StaffGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not authenticated - redirect to login
        router.push('/login');
      } else if (user.isClient) {
        // Client trying to access staff page - redirect to client dashboard
        console.log('[StaffGuard] Redirecting client to client dashboard');
        router.push('/client/dashboard');
      }
    }
  }, [user, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <p className="mt-2">Loading...</p>
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

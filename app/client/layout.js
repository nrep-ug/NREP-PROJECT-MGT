'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ClientLayout({ children }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Wait for auth to load
    if (loading) return;

    // If no user, redirect to login
    if (!user) {
      router.push('/login?redirect=/client');
      return;
    }

    // If user is not a client, redirect to regular dashboard
    if (!user.isClient) {
      router.push('/dashboard');
      return;
    }
  }, [user, loading, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  // If not authenticated or not a client, show nothing (will redirect)
  if (!user || !user.isClient) {
    return null;
  }

  // Render children for authenticated clients
  return <>{children}</>;
}

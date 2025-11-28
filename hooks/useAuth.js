/**
 * Authentication hook for client components
 * Now uses SessionContext for improved performance
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/contexts/SessionContext';

export function useAuth(redirectTo = '/login') {
  const { session, loading, error } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if loading is complete and no session exists
    if (!loading && !session && redirectTo) {
      router.push(redirectTo);
    }
  }, [loading, session, redirectTo, router]);

  return {
    user: session,
    loading,
    error,
  };
}

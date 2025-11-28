'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Spinner } from 'react-bootstrap';
import { logout } from '@/lib/auth';
import { useSession } from '@/contexts/SessionContext';

export default function LogoutPage() {
  const router = useRouter();
  const { clearSession } = useSession();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout();
        // Clear the session from context
        clearSession();
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        router.push('/login');
      }
    };

    performLogout();
  }, [router, clearSession]);

  return (
    <Container className="text-center mt-5">
      <Spinner animation="border" role="status" />
      <p className="mt-3">Signing out...</p>
    </Container>
  );
}

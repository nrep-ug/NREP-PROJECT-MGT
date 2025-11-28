'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container, Alert, Spinner } from 'react-bootstrap';

export const dynamic = 'force-dynamic';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Processing invitation...');
  const [error, setError] = useState('');

  useEffect(() => {
    const processInvite = async () => {
      try {
        const userId = searchParams.get('userId');
        const secret = searchParams.get('secret');
        const membershipId = searchParams.get('membershipId');
        const teamId = searchParams.get('teamId');

        if (userId && secret && membershipId && teamId) {
          setMessage('Invitation received. Please set your password to continue.');
          // In a real implementation, you would handle the invitation acceptance here
          // For now, redirect to login after a short delay
          setTimeout(() => {
            router.push('/login?message=Please log in with your credentials');
          }, 3000);
        } else {
          setError('Invalid invitation link. Please contact your administrator.');
        }
      } catch (err) {
        setError('Failed to process invitation. Please try again or contact your administrator.');
        console.error('Invitation error:', err);
      }
    };

    processInvite();
  }, [router, searchParams]);

  return (
    <Container className="mt-5">
      <div className="text-center">
        {error ? (
          <Alert variant="danger">{error}</Alert>
        ) : (
          <>
            <Spinner animation="border" role="status" className="mb-3" />
            <p>{message}</p>
          </>
        )}
      </div>
    </Container>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <Container className="mt-5">
        <div className="text-center">
          <Spinner animation="border" role="status" className="mb-3" />
          <p>Loading...</p>
        </div>
      </Container>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}

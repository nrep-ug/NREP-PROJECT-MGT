'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Spinner } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { authenticatedFetch } from '@/lib/apiClient';
import AppLayout from '@/components/AppLayout';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';

/**
 * Sidebar → Clean Cooking.
 * One enabled project (today: BCCeC) → go straight to its Clean Cooking tab.
 * Several → let the user pick. None → explain how to switch it on.
 */
export default function CleanCookingLauncher() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ['clean-cooking', 'projects'],
    enabled: Boolean(user),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async () => {
      const response = await authenticatedFetch('/api/clean-cooking');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Clean Cooking projects could not be loaded.');
      return data.projects;
    },
  });

  const projects = query.data || [];
  useEffect(() => {
    if (projects.length === 1) router.replace(`/projects/${projects[0].$id}?tab=clean-cooking`);
  }, [projects, router]);

  return (
    <AppLayout user={user}>
      <h1 className="h3 fw-bold mb-1">Clean Cooking</h1>
      <p className="text-muted mb-4">EPC sales, champions and the Clean Cooking dashboard.</p>
      {loading || query.isLoading || projects.length === 1 ? (
        <div className="text-center py-5"><Spinner animation="border" /><p className="text-muted mt-2">Opening Clean Cooking…</p></div>
      ) : query.isError ? (
        <Alert variant="warning">{query.error.message} <button type="button" className="btn btn-link btn-sm p-0" onClick={() => query.refetch()}>Retry</button></Alert>
      ) : projects.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon="bi-fire"
            title="Clean Cooking isn’t switched on for any of your projects"
            text={user?.isAdmin
              ? 'Open the project (for example BCCeC), choose the Clean Cooking tab and click “Enable Clean Cooking”.'
              : 'Ask an administrator to enable it on your project, or to add you to the project team.'}
            action={<Link href="/projects" className="btn btn-secondary btn-sm">Go to Projects</Link>}
          />
        </SectionCard>
      ) : (
        <SectionCard title="Choose a project">
          <div className="list-group list-group-flush">
            {projects.map((p) => (
              <Link key={p.$id} href={`/projects/${p.$id}?tab=clean-cooking`} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                <span><strong>{p.code}</strong> · {p.name}</span>
                <i className="bi bi-chevron-right" />
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </AppLayout>
  );
}

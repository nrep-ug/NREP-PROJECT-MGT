'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { useProject, useProjectMembers } from '@/hooks/useProjects';
import { formatDate } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';
import StatusBadge from '@/components/ui/StatusBadge';
import ProjectOverview from '@/components/project/ProjectOverview';
import ProjectTasks from '@/components/project/ProjectTasks';
import ProjectMilestones from '@/components/project/ProjectMilestones';
import ProjectDocumentsNew from '@/components/project/ProjectDocumentsNew';
import ProjectEmbeds from '@/components/project/ProjectEmbeds';
import ProjectStaffAssignment from '@/components/project/ProjectStaffAssignment';
import ProjectComponents from '@/components/project/ProjectComponents';
import ProjectRolesSettings from '@/components/project/ProjectRolesSettings';
import ProjectFinanceSummary from '@/components/project/ProjectFinanceSummary';
import styles from '@/components/project/ProjectViews.module.css';

function getCurrencySymbol(currency) {
  switch (currency) {
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'UGX': return 'Sh';
    default: return '$';
  }
}

const TAB_DEFS = [
  { key: 'overview', label: 'Overview', icon: 'bi-info-circle' },
  { key: 'milestones', label: 'Activities', icon: 'bi-flag' },
  { key: 'components', label: 'Components', icon: 'bi-boxes' },
  { key: 'tasks', label: 'Tasks', icon: 'bi-list-task' },
  { key: 'team', label: 'Team', icon: 'bi-people' },
  { key: 'documents', label: 'Documents', icon: 'bi-file-earmark-text' },
  { key: 'finance', label: 'Finance', icon: 'bi-cash-coin', requires: 'finance' },
  { key: 'embeds', label: 'Embeds', icon: 'bi-code-square' },
  { key: 'settings', label: 'Settings', icon: 'bi-gear', requires: 'settings' },
];

function ProjectDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(params.id);
  const { data: teamMembers = [] } = useProjectMembers(params.id, user?.authUser?.$id);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast, showToast, hideToast } = useToast();

  const currentUserId = user?.accountId || user?.authUser?.$id;
  const currentUserMember = teamMembers.find((m) => m.accountId === currentUserId);
  const currentUserProjectRoles = currentUserMember?.projectRoles || [];

  const canModifyProject = user?.isAdmin || currentUserProjectRoles.some((r) => ['manager', 'owner', 'lead'].includes(r));
  const isProjectMember = user?.isAdmin || (currentUserMember && !currentUserProjectRoles.every((r) => r === 'client_rep'));
  const canManageTeam = user?.isAdmin || currentUserProjectRoles.some((r) => ['manager', 'owner'].includes(r));
  const canViewFinance = Boolean(
    user?.isFinance || user?.isManager || user?.isAdmin ||
    currentUserProjectRoles.some((role) => ['owner', 'manager'].includes(role))
  );
  const isProjectHead = currentUserProjectRoles.some((role) => ['owner', 'manager'].includes(role));

  const visibleTabs = TAB_DEFS.filter((tab) => {
    if (tab.requires === 'finance') return canViewFinance;
    if (tab.requires === 'settings') return canManageTeam;
    return true;
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    const allowed = visibleTabs.map((t) => t.key);
    if (tab && allowed.includes(tab)) setActiveTab(tab);
    else if (tab && !allowed.includes(tab)) setActiveTab('overview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canViewFinance, canManageTeam]);

  const selectTab = (key) => {
    setActiveTab(key);
    router.push(`/projects/${project.$id}?tab=${key}`, { scroll: false });
  };

  if (authLoading || projectLoading) {
    return <AppLayout user={user}><LoadingSpinner message="Loading project..." /></AppLayout>;
  }
  if (projectError || !project) {
    return <AppLayout user={user}><Alert variant="danger">{projectError?.message || 'Project not found'}</Alert></AppLayout>;
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      <div className="mb-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push('/projects')}
        >
          <i className="bi bi-arrow-left me-2" />Back to Projects
        </Button>
      </div>

      <div className={styles.detailHeader}>
        <div className={styles.detailEyebrow}>
          <span className={styles.codeChip}>{project.code}</span>
          <StatusBadge status={project.status} />
          {project.demoSeedId && <span className={styles.demoChip}><i className="bi bi-stars" />Demo</span>}
        </div>
        <div className={styles.detailTitleRow}>
          <h1 className={styles.detailTitle}>{project.name}</h1>
        </div>
        {project.description && <p className="text-muted mb-0 mt-2" style={{ maxWidth: '70ch' }}>{project.description}</p>}
        <div className={styles.detailMetaRow}>
          {(project.startDate || project.endDate) && (
            <span className={styles.detailMetaItem}>
              <i className="bi bi-calendar-event" />
              {project.startDate && formatDate(project.startDate)}{project.startDate && project.endDate && ' – '}{project.endDate && formatDate(project.endDate)}
            </span>
          )}
          {typeof project.budgetAmount === 'number' && (
            <span className={styles.detailMetaItem}>
              <i className="bi bi-cash-stack" />Budget <strong className={styles.detailBudget}>{getCurrencySymbol(project.budgetCurrency || 'USD')}{project.budgetAmount.toLocaleString()}</strong>
            </span>
          )}
          {teamMembers.length > 0 && (
            <span className={styles.detailMetaItem}><i className="bi bi-people" />{teamMembers.length} team member{teamMembers.length === 1 ? '' : 's'}</span>
          )}
          {isProjectHead && <span className={styles.detailMetaItem}><i className="bi bi-person-badge" />You lead this project</span>}
        </div>
      </div>

      <nav className={styles.tabBar} aria-label="Project sections">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.tabLink} ${activeTab === tab.key ? styles.tabLinkActive : ''}`}
            aria-current={activeTab === tab.key ? 'page' : undefined}
            onClick={() => selectTab(tab.key)}
          >
            <i className={`bi ${tab.icon}`} />{tab.label}
          </button>
        ))}
      </nav>

      <div>
        {activeTab === 'overview' && <ProjectOverview project={project} user={user} showToast={showToast} />}
        {activeTab === 'team' && (
          <ProjectStaffAssignment
            projectId={project.$id}
            projectTeamId={project.projectTeamId}
            organizationId={user?.organizationId}
            currentUser={user}
            canManageTeam={canManageTeam}
            showToast={showToast}
          />
        )}
        {activeTab === 'tasks' && <ProjectTasks project={project} user={user} showToast={showToast} canModify={canModifyProject} />}
        {activeTab === 'milestones' && <ProjectMilestones project={project} user={user} showToast={showToast} canModify={canModifyProject} />}
        {activeTab === 'documents' && <ProjectDocumentsNew project={project} user={user} showToast={showToast} canManage={canModifyProject} canUpload={isProjectMember} />}
        {activeTab === 'finance' && canViewFinance && <ProjectFinanceSummary project={project} />}
        {activeTab === 'embeds' && <ProjectEmbeds project={project} user={user} showToast={showToast} canModify={canModifyProject} />}
        {activeTab === 'components' && <ProjectComponents project={project} user={user} showToast={showToast} canModify={canModifyProject} teamMembers={teamMembers} />}
        {activeTab === 'settings' && canManageTeam && (
          <div>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <p className="text-muted mb-0">Manage project roles, permissions, and advanced settings.</p>
              <Button variant="outline-secondary" size="sm" onClick={() => router.push(`/projects/${project.$id}/settings`)}>
                <i className="bi bi-box-arrow-up-right me-1" />Open Full Settings
              </Button>
            </div>
            <ProjectRolesSettings projectId={project.$id} requesterId={currentUserId} showToast={showToast} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<AppLayout><LoadingSpinner message="Loading project..." /></AppLayout>}>
      <ProjectDetailContent />
    </Suspense>
  );
}

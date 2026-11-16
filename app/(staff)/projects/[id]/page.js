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
import CleanCookingTab from '@/components/cleanCooking/CleanCookingTab';
import { useCleanCookingStatus } from '@/hooks/useCleanCooking';
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
  { key: 'clean-cooking', label: 'Clean Cooking', icon: 'bi-fire', requires: 'cleanCooking' },
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
  const [showFullDescription, setShowFullDescription] = useState(false);
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
  const { data: cleanCookingStatus } = useCleanCookingStatus(params.id);
  // Visible when the module is enabled and the caller may read it; admins also
  // see it on other projects so they can enable it from the tab.
  const canViewCleanCooking = Boolean(cleanCookingStatus?.enabled || (user?.isAdmin && cleanCookingStatus && !cleanCookingStatus.unavailable));

  const visibleTabs = TAB_DEFS.filter((tab) => {
    if (tab.requires === 'finance') return canViewFinance;
    if (tab.requires === 'settings') return canManageTeam;
    if (tab.requires === 'cleanCooking') return canViewCleanCooking;
    return true;
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    const allowed = visibleTabs.map((t) => t.key);
    if (tab && allowed.includes(tab)) setActiveTab(tab);
    else if (tab && !allowed.includes(tab)) setActiveTab('overview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canViewFinance, canManageTeam, canViewCleanCooking]);

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

  // Timeline progress for the facts card: % of the project period elapsed.
  const timeline = (() => {
    const start = project.startDate ? new Date(project.startDate).getTime() : NaN;
    const end = project.endDate ? new Date(project.endDate).getTime() : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const now = Date.now();
    const percent = Math.round(Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)));
    const dayMs = 86_400_000;
    let label;
    if (now < start) label = `Starts in ${Math.ceil((start - now) / dayMs)} days`;
    else if (now > end) label = 'Period ended';
    else {
      const daysLeft = Math.ceil((end - now) / dayMs);
      label = `${percent}% of period elapsed · ${daysLeft} days left`;
    }
    return { percent, label };
  })();

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
        {activeTab === 'overview' && (
          <div className={styles.overviewStack}>
            <div className={styles.overviewTop}>
              <section className={styles.overviewDescription} aria-labelledby="overview-about">
                <h2 id="overview-about" className={styles.overviewHeading}>About this project</h2>
                {project.description ? (
                  <div className={styles.detailDescriptionWrap}>
                    <p
                      id="project-description"
                      className={`${styles.detailDescription} ${showFullDescription ? '' : styles.detailDescriptionClamped}`}
                    >
                      {project.description}
                    </p>
                    {project.description.length > 220 && (
                      <button
                        type="button"
                        className={styles.readMore}
                        aria-expanded={showFullDescription}
                        aria-controls="project-description"
                        onClick={() => setShowFullDescription((v) => !v)}
                      >
                        {showFullDescription ? 'Show less' : 'Read more'}
                        <i className={`bi ${showFullDescription ? 'bi-chevron-up' : 'bi-chevron-down'} ms-1`} />
                      </button>
                    )}
                  </div>
                ) : (
                  <p className={styles.detailDescription}>No description yet.</p>
                )}
              </section>
              <ProjectOverview project={project} user={user} />
            </div>
            <div className={styles.factGrid}>
              {(project.startDate || project.endDate) && (
                <div className={styles.factCard}>
                  <span className={styles.factIcon}><i className="bi bi-calendar-range" /></span>
                  <div className={styles.factBody}>
                    <span className={styles.factLabel}>Timeline</span>
                    <span className={styles.factValue}>
                      {project.startDate ? formatDate(project.startDate) : '—'} – {project.endDate ? formatDate(project.endDate) : '—'}
                    </span>
                    {timeline && (
                      <>
                        <div className={styles.factProgress} aria-hidden="true"><span style={{ width: `${timeline.percent}%` }} /></div>
                        <span className={styles.factHint}>{timeline.label}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              {typeof project.budgetAmount === 'number' && (
                <div className={styles.factCard}>
                  <span className={styles.factIcon}><i className="bi bi-cash-stack" /></span>
                  <div className={styles.factBody}>
                    <span className={styles.factLabel}>Approved budget</span>
                    <span className={`${styles.factValue} ${styles.factValueLarge}`}>
                      {getCurrencySymbol(project.budgetCurrency || 'USD')}{project.budgetAmount.toLocaleString()}
                      <small className={styles.factCurrency}>{project.budgetCurrency || 'USD'}</small>
                    </span>
                    {canViewFinance ? (
                      <button type="button" className={styles.factLink} onClick={() => selectTab('finance')}>
                        Spending &amp; balances <i className="bi bi-arrow-right" />
                      </button>
                    ) : (
                      <span className={styles.factHint}>Total for the whole project period</span>
                    )}
                  </div>
                </div>
              )}
              <div className={styles.factCard}>
                <span className={styles.factIcon}><i className="bi bi-people" /></span>
                <div className={styles.factBody}>
                  <span className={styles.factLabel}>Team</span>
                  <span className={styles.factValue}>{teamMembers.length} member{teamMembers.length === 1 ? '' : 's'}</span>
                  <span className={styles.factHint}>{isProjectHead ? 'You lead this project' : (currentUserMember ? 'You are on this team' : 'You are not on this team')}</span>
                  <button type="button" className={styles.factLink} onClick={() => selectTab('team')}>
                    See the team <i className="bi bi-arrow-right" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
        {activeTab === 'clean-cooking' && canViewCleanCooking && <CleanCookingTab project={project} user={user} showToast={showToast} />}
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

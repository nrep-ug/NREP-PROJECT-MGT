'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, Tabs, Tab, Alert, Container, Badge, Button, Row, Col } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { useProject, useProjectMembers } from '@/hooks/useProjects';
import { databases, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import { formatDate } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';
import ProjectOverview from '@/components/project/ProjectOverview';
import ProjectTasks from '@/components/project/ProjectTasks';
import ProjectMilestones from '@/components/project/ProjectMilestones';
import ProjectDocumentsNew from '@/components/project/ProjectDocumentsNew';
import ProjectEmbeds from '@/components/project/ProjectEmbeds';
import ProjectStaffAssignment from '@/components/project/ProjectStaffAssignment';
import ProjectComponents from '@/components/project/ProjectComponents';

function ProjectDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(params.id);
  const { data: teamMembers = [] } = useProjectMembers(params.id);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast, showToast, hideToast } = useToast();

  // Check permissions
  const canModify = user?.isAdmin || teamMembers.some(m => m.accountId === user?.$id);

  // Set active tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'team', 'tasks', 'milestones', 'documents', 'embeds', 'components'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'on_hold': return 'warning';
      case 'cancelled': return 'danger';
      case 'planned': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#198754';
      case 'completed': return '#0dcaf0';
      case 'on_hold': return '#ffc107';
      case 'cancelled': return '#dc3545';
      case 'planned': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const getCurrencySymbol = (currency) => {
    switch (currency) {
      case 'USD': return '$';
      case 'GBP': return '£';
      case 'EUR': return '€';
      case 'UGX': return 'Sh';
      default: return '$';
    }
  };

  if (authLoading || projectLoading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading project..." />
      </AppLayout>
    );
  }

  if (projectError || !project) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">{projectError?.message || 'Project not found'}</Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Back Button */}
      <div className="mb-3">
        <Button
          variant=""
          onClick={() => router.push('/projects')}
          style={{
            backgroundColor: 'white',
            border: '2px solid #cbd5e1',
            color: '#64748b',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#054653';
            e.currentTarget.style.color = '#054653';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          <i className="bi bi-arrow-left me-2"></i>
          Back to Projects
        </Button>
      </div>

      {/* Project Header Card */}
      <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        {/* Colored Status Bar */}
        <div style={{
          height: '6px',
          backgroundColor: getStatusColor(project.status),
          width: '100%'
        }}></div>

        <Card.Body className="p-4">
          <Row className="align-items-center">
            <Col lg={8}>
              <div className="d-flex align-items-start gap-3">
                {/* Project Icon */}
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#eff6ff'
                  }}
                >
                  <i className="bi bi-folder-fill" style={{ fontSize: '2rem', color: '#054653' }}></i>
                </div>

                {/* Project Info */}
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <Badge
                      style={{
                        backgroundColor: '#054653',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px'
                      }}
                    >
                      {project.code}
                    </Badge>
                    <Badge
                      bg={getStatusVariant(project.status)}
                      className="text-capitalize"
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px'
                      }}
                    >
                      {project.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  <h3 className="mb-2 fw-bold" style={{ color: '#1e293b' }}>
                    {project.name}
                  </h3>

                  {project.description && (
                    <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
                      {project.description}
                    </p>
                  )}
                </div>
              </div>
            </Col>

            <Col lg={4}>
              <Row className="g-3">
                {/* Budget */}
                <Col xs={6} lg={12}>
                  <div
                    className="p-3 rounded-3"
                    style={{ backgroundColor: '#f8fafc' }}
                  >
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <i className="bi bi-cash-stack" style={{ color: '#054653', fontSize: '1.25rem' }}></i>
                      <small className="text-muted text-uppercase" style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                        Budget
                      </small>
                    </div>
                    <div className="fw-bold" style={{ color: '#054653', fontSize: '1.5rem' }}>
                      {getCurrencySymbol(project.budgetCurrency || 'USD')}{project.budgetAmount?.toLocaleString() || '0'}
                    </div>
                  </div>
                </Col>

                {/* Timeline */}
                {(project.startDate || project.endDate) && (
                  <Col xs={6} lg={12}>
                    <div
                      className="p-3 rounded-3"
                      style={{ backgroundColor: '#f8fafc' }}
                    >
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <i className="bi bi-calendar-event" style={{ color: '#14B8A6', fontSize: '1.25rem' }}></i>
                        <small className="text-muted text-uppercase" style={{ fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                          Timeline
                        </small>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        {project.startDate && <div>{formatDate(project.startDate)}</div>}
                        {project.endDate && <div>to {formatDate(project.endDate)}</div>}
                      </div>
                    </div>
                  </Col>
                )}
              </Row>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tabs Section */}
      <Card className="border-0 shadow-sm" style={{ borderRadius: '12px' }}>
        <Card.Body className="p-4">
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => {
              setActiveTab(k);
              router.push(`/projects/${project.$id}?tab=${k}`, { scroll: false });
            }}
            className="mb-4"
            style={{
              borderBottom: '2px solid #e9ecef'
            }}
          >
            <Tab
              eventKey="overview"
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="bi bi-info-circle"></i>
                  <span className="d-none d-sm-inline">Overview</span>
                </span>
              }
            >
              <ProjectOverview project={project} user={user} showToast={showToast} />
            </Tab>
            <Tab
              eventKey="team"
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="bi bi-people"></i>
                  <span className="d-none d-sm-inline">Team</span>
                </span>
              }
            >
              <ProjectStaffAssignment
                projectId={project.$id}
                organizationId={user?.organizationId}
                currentUser={user}
                showToast={showToast}
              />
            </Tab>
            <Tab
              eventKey="tasks"
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="bi bi-list-task"></i>
                  <span className="d-none d-sm-inline">Tasks</span>
                </span>
              }
            >
              <ProjectTasks project={project} user={user} showToast={showToast} canModify={canModify} />
            </Tab>
            <Tab
              eventKey="milestones"
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="bi bi-flag"></i>
                  <span className="d-none d-sm-inline">Activity Schedule</span>
                </span>
              }
            >
              <ProjectMilestones project={project} user={user} showToast={showToast} canModify={canModify} />
            </Tab>
            <Tab
              eventKey="documents"
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="bi bi-file-earmark-text"></i>
                  <span className="d-none d-sm-inline">Documents</span>
                </span>
              }
            >
              <ProjectDocumentsNew project={project} user={user} showToast={showToast} canManage={canModify} />
            </Tab>
            <Tab
              eventKey="embeds"
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="bi bi-code-square"></i>
                  <span className="d-none d-sm-inline">Embeds</span>
                </span>
              }
            >
              <ProjectEmbeds project={project} user={user} showToast={showToast} canModify={canModify} />
            </Tab>
            <Tab
              eventKey="components"
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="bi bi-boxes"></i>
                  <span className="d-none d-sm-inline">Components</span>
                </span>
              }
            >
              <ProjectComponents project={project} user={user} showToast={showToast} canModify={canModify} teamMembers={teamMembers} />
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </AppLayout>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <LoadingSpinner message="Loading project..." />
      </AppLayout>
    }>
      <ProjectDetailContent />
    </Suspense>
  );
}

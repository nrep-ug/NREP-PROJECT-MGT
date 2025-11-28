'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, Tabs, Tab, Alert, Badge, Row, Col, Table, Button, ProgressBar, Modal } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { databases, storage, Query, COLLECTIONS, DB_ID, BUCKET_DOCS } from '@/lib/appwriteClient';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ProjectDocumentsClient from '@/components/project/ProjectDocumentsClient';
import { formatDate, formatDateTime } from '@/lib/date';

function ClientProjectDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [embeds, setEmbeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewEmbed, setPreviewEmbed] = useState(null);

  // Set active tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'milestones', 'tasks', 'documents', 'timesheets', 'embeds'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && params.id) {
      loadProjectData();
    }
  }, [user, params.id]);

  const loadProjectData = async () => {
    try {
      setLoading(true);

      // Load project
      const projectDoc = await databases.getDocument(
        DB_ID,
        COLLECTIONS.PROJECTS,
        params.id
      );

      // Verify this project belongs to the client's organization
      const clientOrgIds = user.profile?.clientOrganizationIds || [];
      if (!clientOrgIds.includes(projectDoc.clientId)) {
        setError('You do not have permission to view this project');
        setLoading(false);
        return;
      }

      setProject(projectDoc);

      // Load milestones
      const milestonesResponse = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.MILESTONES,
        [
          Query.equal('projectId', params.id),
          Query.orderAsc('dueDate'),
          Query.limit(100)
        ]
      );
      setMilestones(milestonesResponse.documents);

      // Load client-visible tasks
      const tasksResponse = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.TASKS,
        [
          Query.equal('projectId', params.id),
          Query.equal('isClientVisible', true),
          Query.orderDesc('$createdAt'),
          Query.limit(100)
        ]
      );
      setTasks(tasksResponse.documents);

      // Load timesheet summaries for the project
      // First, get all timesheet entries for this project
      const entriesResponse = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.TIMESHEET_ENTRIES,
        [
          Query.equal('projectId', params.id),
          Query.limit(1000) // Get up to 1000 entries
        ]
      );

      // Extract unique timesheet IDs
      const timesheetIds = [...new Set(entriesResponse.documents.map(entry => entry.timesheetId))];

      if (timesheetIds.length > 0) {
        // Fetch the timesheets using the IDs
        // Split into batches if there are more than 100 (Appwrite limit)
        const timesheetPromises = [];
        for (let i = 0; i < timesheetIds.length; i += 100) {
          const batch = timesheetIds.slice(i, i + 100);
          timesheetPromises.push(
            databases.listDocuments(
              DB_ID,
              COLLECTIONS.TIMESHEETS,
              [
                Query.equal('$id', batch),
                Query.orderDesc('weekStart'),
              ]
            )
          );
        }

        const timesheetResponses = await Promise.all(timesheetPromises);
        const allTimesheets = timesheetResponses.flatMap(response => response.documents);

        // Get unique account IDs from timesheets
        const accountIds = [...new Set(allTimesheets.map(t => t.accountId))];

        // Fetch user details for these accounts
        const usersMap = {};
        if (accountIds.length > 0) {
          try {
            const usersResponse = await databases.listDocuments(
              DB_ID,
              COLLECTIONS.USERS,
              [
                Query.equal('accountId', accountIds),
                Query.limit(100)
              ]
            );
            usersResponse.documents.forEach(user => {
              usersMap[user.accountId] = user;
            });
          } catch (err) {
            console.error('Failed to load user details:', err);
          }
        }

        // Calculate total hours per timesheet from entries and add user info
        const timesheetsWithHours = allTimesheets.map(timesheet => {
          const timesheetEntries = entriesResponse.documents.filter(
            entry => entry.timesheetId === timesheet.$id
          );
          const totalHours = timesheetEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
          const user = usersMap[timesheet.accountId];

          return {
            ...timesheet,
            totalHours,
            entryCount: timesheetEntries.length,
            staffName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown User'
          };
        });

        // Sort by weekStart descending and limit to 50 most recent
        timesheetsWithHours.sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));
        setTimesheets(timesheetsWithHours.slice(0, 50));
      } else {
        setTimesheets([]);
      }

      // Load client-visible embeds
      const embedsResponse = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.EMBEDS,
        [
          Query.equal('projectId', params.id),
          Query.equal('isClientVisible', true),
          Query.orderDesc('$createdAt'),
          Query.limit(100)
        ]
      );
      setEmbeds(embedsResponse.documents);

    } catch (err) {
      console.error('Failed to load project:', err);
      setError('Failed to load project. You may not have permission to view it.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'on_hold': return 'warning';
      case 'cancelled': return 'danger';
      default: return 'secondary';
    }
  };

  const getTaskStatusColor = (status) => {
    const colors = {
      todo: 'secondary',
      in_progress: 'primary',
      blocked: 'danger',
      done: 'success'
    };
    return colors[status] || 'secondary';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'secondary',
      medium: 'info',
      high: 'warning',
      critical: 'danger'
    };
    return colors[priority] || 'secondary';
  };

  const getMilestoneStatusColor = (status) => {
    const colors = {
      open: 'primary',
      reached: 'success',
      closed: 'secondary'
    };
    return colors[status] || 'secondary';
  };

  const calculateProjectProgress = () => {
    if (tasks.length === 0) return 0;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    return Math.round((completedTasks / tasks.length) * 100);
  };

  const handlePreviewEmbed = (embed) => {
    setPreviewEmbed(embed);
    setShowPreviewModal(true);
  };

  const handleOpenInNewTab = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading project..." />
      </AppLayout>
    );
  }

  if (error || !project) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error || 'Project not found'}
        </Alert>
        <Button variant="outline-secondary" onClick={() => router.push('/client/projects')}>
          <i className="bi bi-arrow-left me-2"></i>
          Back to Projects
        </Button>
      </AppLayout>
    );
  }

  const progress = calculateProjectProgress();

  return (
    <AppLayout user={user}>
      {/* Header */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2 mb-2">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => router.push('/client/projects')}
              >
                <i className="bi bi-arrow-left me-1"></i>
                Back
              </Button>
            </div>
            <h2 className="mb-2">{project.name}</h2>
            <div className="d-flex flex-wrap align-items-center gap-3">
              <span className="text-muted">
                <i className="bi bi-folder me-1"></i>
                <strong>Code:</strong> {project.code}
              </span>
              <Badge bg={getStatusVariant(project.status)} className="text-uppercase">
                {project.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <Row className="g-3">
          <Col md={2} sm={4} xs={6}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center p-2">
                <div className="text-muted small mb-1">Progress</div>
                <h4 className="mb-2">{progress}%</h4>
                <ProgressBar now={progress} variant={progress === 100 ? 'success' : 'primary'} style={{ height: '6px' }} />
              </Card.Body>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center p-2">
                <div className="text-muted small mb-1">Milestones</div>
                <h4 className="mb-0">{milestones.length}</h4>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center p-2">
                <div className="text-muted small mb-1">Tasks</div>
                <h4 className="mb-0">{tasks.length}</h4>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center p-2">
                <div className="text-muted small mb-1">Completed</div>
                <h4 className="mb-0">{tasks.filter(t => t.status === 'done').length}</h4>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center p-2">
                <div className="text-muted small mb-1">Documents</div>
                <h4 className="mb-0">
                  <i className="bi bi-folder"></i>
                </h4>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2} sm={4} xs={6}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center p-2">
                <div className="text-muted small mb-1">Embeds</div>
                <h4 className="mb-0">{embeds.length}</h4>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Tabs */}
      <Card className="border-0 shadow-sm">
        <Card.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => {
              setActiveTab(k);
              router.push(`/client/projects/${project.$id}?tab=${k}`, { scroll: false });
            }}
            className="mb-3"
          >
            {/* Overview Tab */}
            <Tab eventKey="overview" title={<><i className="bi bi-info-circle me-2"></i>Overview</>}>
              <Row>
                <Col lg={8}>
                  <h5 className="mb-3">Project Details</h5>

                  {project.description && (
                    <div className="mb-4">
                      <h6 className="text-muted mb-2">Description</h6>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{project.description}</p>
                    </div>
                  )}

                  <Row className="g-3">
                    <Col md={6}>
                      <Card className="bg-light border-0">
                        <Card.Body>
                          <h6 className="text-muted mb-2">
                            <i className="bi bi-calendar-event me-2"></i>
                            Start Date
                          </h6>
                          <p className="mb-0">{project.startDate ? formatDate(project.startDate) : 'Not set'}</p>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={6}>
                      <Card className="bg-light border-0">
                        <Card.Body>
                          <h6 className="text-muted mb-2">
                            <i className="bi bi-calendar-check me-2"></i>
                            End Date
                          </h6>
                          <p className="mb-0">{project.endDate ? formatDate(project.endDate) : 'Not set'}</p>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </Col>

                <Col lg={4}>
                  <h5 className="mb-3">Project Status</h5>
                  <Card className="bg-light border-0 mb-3">
                    <Card.Body>
                      <div className="mb-3">
                        <div className="text-muted small mb-1">Current Status</div>
                        <Badge bg={getStatusVariant(project.status)} className="text-uppercase">
                          {project.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="mb-3">
                        <div className="text-muted small mb-1">Overall Progress</div>
                        <div className="d-flex align-items-center gap-2">
                          <ProgressBar now={progress} className="flex-grow-1" style={{ height: '8px' }} />
                          <strong>{progress}%</strong>
                        </div>
                      </div>
                      <div>
                        <div className="text-muted small mb-1">Created</div>
                        <div className="small">{formatDate(project.$createdAt)}</div>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Tab>

            {/* Milestones Tab */}
            <Tab eventKey="milestones" title={<><i className="bi bi-flag me-2"></i>Milestones ({milestones.length})</>}>
              {milestones.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-flag" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  <h6 className="mt-3">No Milestones</h6>
                  <p className="text-muted mb-0">No milestones have been set for this project</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover>
                    <thead className="table-light">
                      <tr>
                        <th>Milestone</th>
                        <th>Status</th>
                        <th>Start Date</th>
                        <th>Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {milestones.map((milestone) => (
                        <tr key={milestone.$id}>
                          <td>
                            <strong>{milestone.name}</strong>
                            {milestone.description && (
                              <div className="small text-muted text-truncate" style={{ maxWidth: '300px' }}>
                                {milestone.description}
                              </div>
                            )}
                          </td>
                          <td>
                            <Badge bg={getMilestoneStatusColor(milestone.status)} className="text-uppercase" style={{ fontSize: '0.7rem' }}>
                              {milestone.status}
                            </Badge>
                          </td>
                          <td>
                            <small>{milestone.startDate ? formatDate(milestone.startDate) : '-'}</small>
                          </td>
                          <td>
                            <small>{milestone.dueDate ? formatDate(milestone.dueDate) : '-'}</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Tab>

            {/* Tasks Tab */}
            <Tab eventKey="tasks" title={<><i className="bi bi-list-task me-2"></i>Tasks ({tasks.length})</>}>
              {tasks.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-list-task" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  <h6 className="mt-3">No Visible Tasks</h6>
                  <p className="text-muted mb-0">No tasks are currently visible to you</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover>
                    <thead className="table-light">
                      <tr>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Due Date</th>
                        <th>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => (
                        <tr key={task.$id}>
                          <td>
                            <strong>{task.title}</strong>
                            {task.description && (
                              <div className="small text-muted text-truncate" style={{ maxWidth: '350px' }}>
                                {task.description}
                              </div>
                            )}
                          </td>
                          <td>
                            <Badge bg={getTaskStatusColor(task.status)} className="text-uppercase" style={{ fontSize: '0.7rem' }}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td>
                            <Badge bg={getPriorityColor(task.priority)} style={{ fontSize: '0.7rem' }}>
                              {task.priority}
                            </Badge>
                          </td>
                          <td>
                            <small>{task.dueDate ? formatDate(task.dueDate) : '-'}</small>
                          </td>
                          <td>
                            <div style={{ width: '100px' }}>
                              <small className="text-muted">{task.status === 'done' ? '100%' : task.status === 'in_progress' ? '50%' : '0%'}</small>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Tab>

            {/* Documents Tab */}
            <Tab eventKey="documents" title={<><i className="bi bi-file-earmark-text me-2"></i>Documents</>}>
              <ProjectDocumentsClient project={project} user={user} />
            </Tab>

            {/* Timesheets Tab */}
            <Tab eventKey="timesheets" title={<><i className="bi bi-clock-history me-2"></i>Time Reports ({timesheets.length})</>}>
              {timesheets.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-clock-history" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  <h6 className="mt-3">No Time Reports</h6>
                  <p className="text-muted mb-0">No timesheet data is available for this project</p>
                </div>
              ) : (
                <div>
                  <Alert variant="info" className="mb-3">
                    <i className="bi bi-info-circle me-2"></i>
                    This view shows aggregated time tracking data for your project. Individual entry details are not displayed.
                  </Alert>
                  <div className="table-responsive">
                    <Table hover>
                      <thead className="table-light">
                        <tr>
                          <th>Week</th>
                          <th>Staff Member</th>
                          <th>Status</th>
                          <th>Total Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timesheets.map((timesheet) => (
                          <tr key={timesheet.$id}>
                            <td>
                              <strong>Week of {formatDate(timesheet.weekStart)}</strong>
                              {timesheet.weekEnd && (
                                <div className="small text-muted">
                                  {formatDate(timesheet.weekStart)} - {formatDate(timesheet.weekEnd)}
                                </div>
                              )}
                            </td>
                            <td>
                              <strong>{timesheet.staffName || 'Unknown'}</strong>
                              {timesheet.entryCount && (
                                <div className="small text-muted">
                                  {timesheet.entryCount} {timesheet.entryCount === 1 ? 'entry' : 'entries'}
                                </div>
                              )}
                            </td>
                            <td>
                              <Badge
                                bg={
                                  timesheet.status === 'approved'
                                    ? 'success'
                                    : timesheet.status === 'submitted'
                                    ? 'info'
                                    : timesheet.status === 'rejected'
                                    ? 'danger'
                                    : 'secondary'
                                }
                                className="text-uppercase"
                                style={{ fontSize: '0.7rem' }}
                              >
                                {timesheet.status || 'draft'}
                              </Badge>
                            </td>
                            <td>
                              <strong>{timesheet.totalHours || 0}h</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}
            </Tab>

            {/* Embeds Tab */}
            <Tab eventKey="embeds" title={<><i className="bi bi-window me-2"></i>Embeds ({embeds.length})</>}>
              {embeds.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-window" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  <h6 className="mt-3">No Embeds</h6>
                  <p className="text-muted mb-0">No embeds are currently available for you to view</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover>
                    <thead className="table-light">
                      <tr>
                        <th>Title</th>
                        <th>Provider</th>
                        <th>URL</th>
                        <th>Dimensions</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {embeds.map((embed) => (
                        <tr key={embed.$id}>
                          <td>
                            <i className="bi bi-window me-2 text-primary"></i>
                            <strong>{embed.title}</strong>
                          </td>
                          <td>
                            {embed.provider ? (
                              <Badge bg="info" style={{ fontSize: '0.7rem' }}>
                                {embed.provider}
                              </Badge>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <small className="text-muted" style={{ wordBreak: 'break-all' }}>
                              {embed.url.length > 50 ? embed.url.substring(0, 50) + '...' : embed.url}
                            </small>
                          </td>
                          <td>
                            <small className="text-muted">
                              {embed.width} × {embed.height}px
                            </small>
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={() => handlePreviewEmbed(embed)}
                                title="Preview embed"
                              >
                                <i className="bi bi-eye me-1"></i> Preview
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                onClick={() => handleOpenInNewTab(embed.url)}
                                title="Open in new tab"
                              >
                                <i className="bi bi-box-arrow-up-right"></i>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      {/* Preview Modal */}
      <Modal
        show={showPreviewModal}
        onHide={() => setShowPreviewModal(false)}
        size="xl"
        fullscreen="lg-down"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {previewEmbed?.title}
            {previewEmbed?.provider && (
              <Badge bg="info" className="ms-2">{previewEmbed.provider}</Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0" style={{ minHeight: '70vh' }}>
          {previewEmbed && (
            <div
              className="embed-preview-container"
              style={{
                position: 'relative',
                width: '100%',
                height: '70vh',
                minHeight: '500px'
              }}
            >
              <iframe
                src={previewEmbed.url}
                title={previewEmbed.title}
                allowFullScreen={previewEmbed.allowFullscreen}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 0
                }}
              />
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => previewEmbed && handleOpenInNewTab(previewEmbed.url)}
          >
            <i className="bi bi-box-arrow-up-right me-2"></i> Open in New Tab
          </Button>
          <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </AppLayout>
  );
}

export default function ClientProjectDetailPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <LoadingSpinner message="Loading project..." />
      </AppLayout>
    }>
      <ClientProjectDetailContent />
    </Suspense>
  );
}

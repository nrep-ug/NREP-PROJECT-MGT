'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Row, Col, Badge, Alert, Table, ProgressBar, Dropdown } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { databases, COLLECTIONS, DB_ID, Query } from '@/lib/appwriteClient';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/date';

export default function MilestoneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState(null);
  const [milestone, setMilestone] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (user && params.id && params.milestoneId) {
      loadData();
    }
  }, [user, params.id, params.milestoneId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load project
      const projectDoc = await databases.getDocument(
        DB_ID,
        COLLECTIONS.PROJECTS,
        params.id
      );
      setProject(projectDoc);

      // Load milestone
      const milestoneDoc = await databases.getDocument(
        DB_ID,
        COLLECTIONS.MILESTONES,
        params.milestoneId
      );
      setMilestone(milestoneDoc);

      // Load tasks linked to this milestone
      const tasksResponse = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.TASKS,
        [
          Query.equal('milestoneId', params.milestoneId),
          Query.orderDesc('$createdAt'),
          Query.limit(100)
        ]
      );
      setTasks(tasksResponse.documents);
    } catch (err) {
      console.error('Failed to load data:', err);
      showToast('Failed to load Activity Schedule. You may not have permission to view it.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      open: 'primary',
      reached: 'success',
      closed: 'secondary'
    };
    return colors[status] || 'secondary';
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

  const canEdit = () => {
    if (!user) return false;
    return user.isAdmin; // Or check if user is project manager
  };

  // Calculate Activity Schedule progress based on tasks
  const calculateProgress = () => {
    if (tasks.length === 0) return 0;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    return Math.round((completedTasks / tasks.length) * 100);
  };

  const getTaskStats = () => {
    return {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      done: tasks.filter(t => t.status === 'done').length,
    };
  };

  const getTotalEstimatedHours = () => {
    return tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
  };

  const hasIncompleteTasks = () => {
    return tasks.some(task => task.status !== 'done');
  };

  const getStatusIcon = (status) => {
    const icons = {
      open: 'bi-flag',
      reached: 'bi-flag-fill',
      closed: 'bi-archive'
    };
    return icons[status] || 'bi-flag';
  };

  const handleQuickStatusUpdate = async (newStatus) => {
    // Prevent closing Activity Schedule if there are incomplete tasks
    if (newStatus === 'closed' && hasIncompleteTasks()) {
      showToast('Cannot close Activity Schedule. There are still incomplete tasks linked to this Activity Schedule.', 'warning');
      return;
    }

    try {
      await databases.updateDocument(
        DB_ID,
        COLLECTIONS.MILESTONES,
        params.milestoneId,
        {
          status: newStatus,
          updatedBy: user.authUser.$id,
        }
      );

      // Update local state
      setMilestone(prev => ({ ...prev, status: newStatus }));
      showToast('Activity Schedule status updated successfully!', 'success');

      // Reload data to ensure consistency
      setTimeout(() => {
        loadData();
      }, 500);
    } catch (err) {
      console.error('Failed to update Activity Schedule status:', err);
      showToast(err.message || 'Failed to update Activity Schedule status', 'danger');
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading Activity Schedule..." />
      </AppLayout>
    );
  }

  if (!project || !milestone) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Activity Schedule not found or you don&apos;t have permission to access it.
        </Alert>
      </AppLayout>
    );
  }

  const progress = calculateProgress();
  const stats = getTaskStats();
  const totalHours = getTotalEstimatedHours();

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Header */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-start">
          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2 mb-2">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => router.push(`/projects/${project.$id}?tab=milestones`)}
              >
                <i className="bi bi-arrow-left me-1"></i>
                Back
              </Button>
              <Badge bg={getStatusColor(milestone.status)} className="text-uppercase">
                {milestone.status}
              </Badge>
            </div>
            <h2 className="mb-1">
              <i className="bi bi-flag me-2"></i>
              {milestone.name}
            </h2>
            <p className="text-muted mb-0">
              Project: <strong>{project.name}</strong> ({project.code})
            </p>
          </div>
          {canEdit() && (
            <div className="d-flex gap-2">
              <Dropdown>
                <Dropdown.Toggle variant="outline-primary" size="sm">
                  <i className="bi bi-arrow-repeat me-1"></i>
                  Update Status
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item
                    onClick={() => handleQuickStatusUpdate('open')}
                    active={milestone.status === 'open'}
                  >
                    <i className={`bi bi-flag text-primary me-2`}></i>
                    Open
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={() => handleQuickStatusUpdate('reached')}
                    active={milestone.status === 'reached'}
                  >
                    <i className={`bi bi-flag-fill text-success me-2`}></i>
                    Reached
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={() => handleQuickStatusUpdate('closed')}
                    active={milestone.status === 'closed'}
                    disabled={hasIncompleteTasks()}
                  >
                    <i className={`bi bi-archive text-secondary me-2`}></i>
                    Closed
                    {hasIncompleteTasks() && (
                      <small className="d-block text-muted" style={{ fontSize: '0.7rem' }}>
                        (Complete all tasks first)
                      </small>
                    )}
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push(`/projects/${project.$id}/milestones/${milestone.$id}/edit`)}
              >
                <i className="bi bi-pencil me-1"></i>
                Edit
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Section */}
      {tasks.length > 0 && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">Overall Progress</h6>
              <Badge bg="primary" pill>{progress}%</Badge>
            </div>
            <ProgressBar
              now={progress}
              variant={progress === 100 ? 'success' : progress > 50 ? 'primary' : 'warning'}
              style={{ height: '10px' }}
            />
            <div className="d-flex justify-content-between mt-2">
              <small className="text-muted">{stats.done} of {stats.total} tasks completed</small>
              <small className="text-muted">{totalHours} hours estimated</small>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Statistics Cards */}
      <Row className="mb-4">
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="bi bi-list-task" style={{ fontSize: '2rem', color: '#6c757d' }}></i>
              </div>
              <h3 className="mb-1">{stats.total}</h3>
              <div className="text-muted small">Total Tasks</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="bi bi-arrow-clockwise" style={{ fontSize: '2rem', color: '#2563EB' }}></i>
              </div>
              <h3 className="mb-1">{stats.inProgress}</h3>
              <div className="text-muted small">In Progress</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="bi bi-x-octagon" style={{ fontSize: '2rem', color: '#dc3545' }}></i>
              </div>
              <h3 className="mb-1">{stats.blocked}</h3>
              <div className="text-muted small">Blocked</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="mb-2">
                <i className="bi bi-check-circle-fill" style={{ fontSize: '2rem', color: '#198754' }}></i>
              </div>
              <h3 className="mb-1">{stats.done}</h3>
              <div className="text-muted small">Completed</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Activity Schedule Details & Tasks */}
      <Row>
        <Col lg={4}>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white">
              <h5 className="mb-0">Activity Schedule Details</h5>
            </Card.Header>
            <Card.Body>
              {milestone.description && (
                <div className="mb-4">
                  <h6 className="text-muted mb-2">Description</h6>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{milestone.description}</p>
                </div>
              )}

              <div className="mb-3">
                <h6 className="text-muted mb-2">Start Date</h6>
                <p className="mb-0">
                  {milestone.startDate ? (
                    <>
                      <i className="bi bi-calendar-event me-2 text-primary"></i>
                      {formatDate(milestone.startDate)}
                    </>
                  ) : (
                    <span className="text-muted fst-italic">Not set</span>
                  )}
                </p>
              </div>

              <div className="mb-3">
                <h6 className="text-muted mb-2">Due Date</h6>
                <p className="mb-0">
                  {milestone.dueDate ? (
                    <>
                      <i className="bi bi-calendar-check me-2 text-danger"></i>
                      {formatDate(milestone.dueDate)}
                    </>
                  ) : (
                    <span className="text-muted fst-italic">Not set</span>
                  )}
                </p>
              </div>

              {milestone.actualDueDate && (
                <div className="mb-3">
                  <h6 className="text-muted mb-2">Actual Completion Date</h6>
                  <p className="mb-0">
                    <i className="bi bi-calendar-check-fill me-2 text-success"></i>
                    {formatDate(milestone.actualDueDate)}
                  </p>
                </div>
              )}

              <div>
                <h6 className="text-muted mb-2">Status</h6>
                <Badge bg={getStatusColor(milestone.status)} className="text-uppercase">
                  {milestone.status}
                </Badge>
              </div>
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white">
              <h5 className="mb-0">Timeline</h5>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <small className="text-muted d-block mb-1">Created</small>
                <small>{milestone.$createdAt ? formatDate(milestone.$createdAt) : 'Unknown'}</small>
              </div>
              <div>
                <small className="text-muted d-block mb-1">Last Updated</small>
                <small>{milestone.$updatedAt ? formatDate(milestone.$updatedAt) : 'Unknown'}</small>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={8}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Linked Tasks ({tasks.length})</h5>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const params = new URLSearchParams({
                    milestoneId: milestone.$id,
                  });
                  router.push(`/projects/${project.$id}/tasks/new?${params.toString()}`);
                }}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Add Task
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              {tasks.length === 0 ? (
                <div className="text-center py-5">
                  <div className="mb-3">
                    <i className="bi bi-inbox" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  </div>
                  <h6>No Tasks Yet</h6>
                  <p className="text-muted mb-3">Create tasks to track work for this Activity Schedule</p>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      const params = new URLSearchParams({
                        milestoneId: milestone.$id,
                      });
                      router.push(`/projects/${project.$id}/tasks/new?${params.toString()}`);
                    }}
                  >
                    <i className="bi bi-plus-circle me-2"></i>
                    Create Task
                  </Button>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Due Date</th>
                        <th>Hours</th>
                        <th>Assigned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => (
                        <tr
                          key={task.$id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => router.push(`/projects/${project.$id}/tasks/${task.$id}`)}
                        >
                          <td>
                            <strong>{task.title}</strong>
                            {task.description && (
                              <div className="small text-muted text-truncate" style={{ maxWidth: '300px' }}>
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
                            {task.dueDate ? (
                              <small>{formatDate(task.dueDate)}</small>
                            ) : (
                              <small className="text-muted">-</small>
                            )}
                          </td>
                          <td>
                            <small>{task.estimatedHours || 0}h</small>
                          </td>
                          <td>
                            {task.assignedTo && task.assignedTo.length > 0 ? (
                              <Badge bg="light" text="dark" pill>
                                {task.assignedTo.length}
                              </Badge>
                            ) : (
                              <small className="text-muted">-</small>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </AppLayout>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Form, Button, Row, Col, Alert, Badge, Modal, Dropdown } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { databases, COLLECTIONS, DB_ID, Query } from '@/lib/appwriteClient';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/date';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState(null);
  const [task, setTask] = useState(null);
  const [milestone, setMilestone] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const [formData, setFormData] = useState({
    milestoneId: '',
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    estimatedHours: 0,
    startDate: '',
    dueDate: '',
    assignedTo: [],
  });

  useEffect(() => {
    if (user && params.id && params.taskId) {
      loadData();
    }
  }, [user, params.id, params.taskId]);

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

      // Load task
      const taskDoc = await databases.getDocument(
        DB_ID,
        COLLECTIONS.TASKS,
        params.taskId
      );
      setTask(taskDoc);

      // Populate form
      setFormData({
        milestoneId: taskDoc.milestoneId || '',
        title: taskDoc.title || '',
        description: taskDoc.description || '',
        priority: taskDoc.priority || 'medium',
        status: taskDoc.status || 'todo',
        estimatedHours: taskDoc.estimatedHours || 0,
        startDate: taskDoc.startDate || '',
        dueDate: taskDoc.dueDate || '',
        assignedTo: taskDoc.assignedTo || [],
      });

      // Load milestone if task is linked to one
      if (taskDoc.milestoneId) {
        try {
          const milestoneDoc = await databases.getDocument(
            DB_ID,
            COLLECTIONS.MILESTONES,
            taskDoc.milestoneId
          );
          setMilestone(milestoneDoc);
        } catch (err) {
          console.error('Failed to load milestone:', err);
        }
      }

      // Load all milestones for editing
      const milestonesResponse = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.MILESTONES,
        [Query.equal('projectId', params.id), Query.orderAsc('startDate')]
      );
      setMilestones(milestonesResponse.documents);

      // Load project members
      const membersResponse = await fetch(`/api/projects/${params.id}/members`);
      const membersData = await membersResponse.json();
      if (membersResponse.ok) {
        setProjectMembers(membersData.members || []);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      showToast('Failed to load task. You may not have permission to view it.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const canEdit = () => {
    if (!task || !user) return false;

    // Admins can always edit
    if (user.isAdmin) return true;

    // Project managers can edit
    // Note: We'd need to check if user is a manager in the project team
    // For now, we'll check if they're assigned to the task or created it

    // Check if user is assigned to the task
    if (task.assignedTo && task.assignedTo.includes(user.authUser.$id)) return true;

    // Check if user created the task
    if (task.createdBy === user.authUser.$id) return true;

    return false;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleAssignment = (memberId) => {
    setFormData(prev => {
      const currentAssignments = prev.assignedTo || [];
      if (currentAssignments.includes(memberId)) {
        // Remove member
        return { ...prev, assignedTo: currentAssignments.filter(id => id !== memberId) };
      } else {
        // Add member
        return { ...prev, assignedTo: [...currentAssignments, memberId] };
      }
    });
  };

  const handleRemoveAssignment = (memberId) => {
    setFormData(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.filter(id => id !== memberId)
    }));
  };

  const validateDates = () => {
    const selectedMilestone = milestones.find(m => m.$id === formData.milestoneId);

    if (selectedMilestone) {
      if (formData.startDate && selectedMilestone.startDate) {
        if (new Date(formData.startDate) < new Date(selectedMilestone.startDate)) {
          showToast('Task start date cannot be before activity schedule start date', 'warning');
          return false;
        }
      }

      if (formData.dueDate && selectedMilestone.dueDate) {
        if (new Date(formData.dueDate) > new Date(selectedMilestone.dueDate)) {
          showToast('Task due date cannot be after activity schedule due date', 'warning');
          return false;
        }
      }
    } else {
      if (formData.startDate && project.startDate) {
        if (new Date(formData.startDate) < new Date(project.startDate)) {
          showToast('Task start date cannot be before project start date', 'warning');
          return false;
        }
      }

      if (formData.dueDate && project.endDate) {
        if (new Date(formData.dueDate) > new Date(project.endDate)) {
          showToast('Task due date cannot be after project end date', 'warning');
          return false;
        }
      }
    }

    if (formData.startDate && formData.dueDate) {
      if (new Date(formData.startDate) > new Date(formData.dueDate)) {
        showToast('Task start date cannot be after due date', 'warning');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showToast('Task title is required', 'warning');
      return;
    }

    if (!validateDates()) {
      return;
    }

    setSubmitting(true);

    try {
      await databases.updateDocument(
        DB_ID,
        COLLECTIONS.TASKS,
        params.taskId,
        {
          milestoneId: formData.milestoneId || null,
          title: formData.title,
          description: formData.description || null,
          priority: formData.priority,
          status: formData.status,
          estimatedHours: parseFloat(formData.estimatedHours) || 0,
          startDate: formData.startDate || null,
          dueDate: formData.dueDate || null,
          assignedTo: formData.assignedTo,
          updatedBy: user.authUser.$id,
        }
      );

      showToast('Task updated successfully!', 'success');
      setEditing(false);
      loadData(); // Reload to get fresh data
    } catch (err) {
      console.error('Failed to update task:', err);
      showToast(err.message || 'Failed to update task', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await databases.deleteDocument(
        DB_ID,
        COLLECTIONS.TASKS,
        params.taskId
      );

      showToast('Task deleted successfully!', 'success');

      setTimeout(() => {
        router.push(`/projects/${project.$id}?tab=tasks`);
      }, 1000);
    } catch (err) {
      console.error('Failed to delete task:', err);
      showToast(err.message || 'Failed to delete task', 'danger');
    }
  };

  const handleQuickStatusUpdate = async (newStatus) => {
    try {
      await databases.updateDocument(
        DB_ID,
        COLLECTIONS.TASKS,
        params.taskId,
        {
          status: newStatus,
          updatedBy: user.authUser.$id,
        }
      );

      showToast('Task status updated successfully!', 'success');
      loadData(); // Reload to get fresh data
    } catch (err) {
      console.error('Failed to update status:', err);
      showToast(err.message || 'Failed to update task status', 'danger');
    }
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

  const getStatusColor = (status) => {
    const colors = {
      todo: 'secondary',
      in_progress: 'primary',
      blocked: 'danger',
      done: 'success'
    };
    return colors[status] || 'secondary';
  };

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading task..." />
      </AppLayout>
    );
  }

  if (!project || !task) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Task not found or you don&apos;t have permission to access it.
        </Alert>
      </AppLayout>
    );
  }

  const userCanEdit = canEdit();

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
                onClick={() => router.push(`/projects/${project.$id}?tab=tasks`)}
              >
                <i className="bi bi-arrow-left me-1"></i>
                Back
              </Button>
              <Badge bg={getStatusColor(task.status)} className="text-uppercase">
                {task.status.replace('_', ' ')}
              </Badge>
              <Badge bg={getPriorityColor(task.priority)}>
                {task.priority} priority
              </Badge>
            </div>
            <h2 className="mb-1">{task.title}</h2>
            <p className="text-muted mb-0">
              Project: <strong>{project.name}</strong> ({project.code})
              {milestone && (
                <>
                  {' • '}
                  Activity Schedule: <strong>{milestone.name}</strong>
                </>
              )}
            </p>
          </div>
          {userCanEdit && !editing && (
            <div className="d-flex gap-2">
              {/* Quick Status Update Dropdown */}
              <Dropdown>
                <Dropdown.Toggle variant="outline-primary" size="sm">
                  <i className="bi bi-arrow-repeat me-1"></i>
                  Update Status
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Header>Change Status To:</Dropdown.Header>
                  <Dropdown.Item
                    onClick={() => handleQuickStatusUpdate('todo')}
                    active={task.status === 'todo'}
                  >
                    <i className="bi bi-circle text-secondary me-2"></i>
                    To Do
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={() => handleQuickStatusUpdate('in_progress')}
                    active={task.status === 'in_progress'}
                  >
                    <i className="bi bi-arrow-clockwise text-primary me-2"></i>
                    In Progress
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={() => handleQuickStatusUpdate('blocked')}
                    active={task.status === 'blocked'}
                  >
                    <i className="bi bi-x-octagon text-danger me-2"></i>
                    Blocked
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item
                    onClick={() => handleQuickStatusUpdate('done')}
                    active={task.status === 'done'}
                  >
                    <i className="bi bi-check-circle-fill text-success me-2"></i>
                    Done
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                <i className="bi bi-pencil me-1"></i>
                Edit
              </Button>
            </div>
          )}
        </div>
      </div>

      {editing ? (
        /* Edit Mode */
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Activity Schedule</Form.Label>
                <Form.Select
                  name="milestoneId"
                  value={formData.milestoneId}
                  onChange={handleChange}
                  disabled={submitting}
                >
                  <option value="">No activity schedule (optional)</option>
                  {milestones.map((ms) => (
                    <option key={ms.$id} value={ms.$id}>
                      {ms.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>
                  Task Title <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  disabled={submitting}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={submitting}
                />
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Priority</Form.Label>
                    <Form.Select
                      name="priority"
                      value={formData.priority}
                      onChange={handleChange}
                      disabled={submitting}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Status</Form.Label>
                    <Form.Select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      disabled={submitting}
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Estimated Hours</Form.Label>
                    <Form.Control
                      type="number"
                      name="estimatedHours"
                      value={formData.estimatedHours}
                      onChange={handleChange}
                      min="0"
                      step="0.5"
                      disabled={submitting}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Start Date</Form.Label>
                    <Form.Control
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleChange}
                      disabled={submitting}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Due Date</Form.Label>
                    <Form.Control
                      type="date"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleChange}
                      min={formData.startDate}
                      disabled={submitting}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Assign To</Form.Label>

                {/* Selected Members Display */}
                <div className="mb-2">
                  {formData.assignedTo && formData.assignedTo.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2">
                      {formData.assignedTo.map((memberId) => {
                        const member = projectMembers.find(m => m.accountId === memberId);
                        if (!member) return null;
                        return (
                          <Badge
                            key={memberId}
                            bg="primary"
                            className="d-flex align-items-center gap-2 px-3 py-2"
                            style={{ fontSize: '0.9rem' }}
                          >
                            <span>{member.firstName} {member.lastName}</span>
                            <button
                              type="button"
                              className="btn-close btn-close-white"
                              style={{ fontSize: '0.7rem' }}
                              onClick={() => handleRemoveAssignment(memberId)}
                              disabled={submitting}
                              aria-label="Remove"
                            ></button>
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-muted small mb-2">No team members assigned yet</div>
                  )}
                </div>

                {/* Dropdown to Add Members */}
                <Dropdown>
                  <Dropdown.Toggle
                    variant="outline-secondary"
                    id="assign-members-dropdown"
                    disabled={submitting || projectMembers.length === 0}
                    className="w-100 text-start d-flex justify-content-between align-items-center"
                  >
                    <span>
                      <i className="bi bi-person-plus me-2"></i>
                      {projectMembers.length === 0 ? 'No team members available' : 'Add team member'}
                    </span>
                  </Dropdown.Toggle>

                  <Dropdown.Menu className="w-100" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {projectMembers.length === 0 ? (
                      <Dropdown.ItemText>No team members available</Dropdown.ItemText>
                    ) : (
                      projectMembers.map((member) => {
                        const isAssigned = formData.assignedTo.includes(member.accountId);
                        return (
                          <Dropdown.Item
                            key={member.accountId}
                            onClick={() => handleToggleAssignment(member.accountId)}
                            active={isAssigned}
                          >
                            <div className="d-flex align-items-center justify-content-between">
                              <div>
                                <div>
                                  {member.firstName} {member.lastName}
                                </div>
                                <small className="text-muted">@{member.username}</small>
                              </div>
                              {isAssigned && <i className="bi bi-check-lg text-success"></i>}
                            </div>
                          </Dropdown.Item>
                        );
                      })
                    )}
                  </Dropdown.Menu>
                </Dropdown>

                <Form.Text className="text-muted">
                  Click to add or remove team members (optional)
                </Form.Text>
              </Form.Group>

              <div className="d-flex justify-content-between align-items-center mt-4">
                {(user.isAdmin || task.createdBy === user.authUser.$id) && (
                  <Button
                    variant="outline-danger"
                    onClick={() => setShowDeleteModal(true)}
                    disabled={submitting}
                  >
                    <i className="bi bi-trash me-2"></i>
                    Delete Task
                  </Button>
                )}

                <div className="d-flex gap-2 ms-auto">
                  <Button
                    variant="outline-secondary"
                    onClick={() => {
                      setEditing(false);
                      // Reset form to original values
                      setFormData({
                        milestoneId: task.milestoneId || '',
                        title: task.title || '',
                        description: task.description || '',
                        priority: task.priority || 'medium',
                        status: task.status || 'todo',
                        estimatedHours: task.estimatedHours || 0,
                        startDate: task.startDate || '',
                        dueDate: task.dueDate || '',
                        assignedTo: task.assignedTo || [],
                      });
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Form>
          </Card.Body>
        </Card>
      ) : (
        /* View Mode */
        <Row>
          <Col lg={8}>
            <Card className="border-0 shadow-sm mb-4">
              <Card.Header className="bg-white">
                <h5 className="mb-0">Task Details</h5>
              </Card.Header>
              <Card.Body>
                <div className="mb-4">
                  <h6 className="text-muted mb-2">Description</h6>
                  {task.description ? (
                    <p style={{ whiteSpace: 'pre-wrap' }}>{task.description}</p>
                  ) : (
                    <p className="text-muted fst-italic">No description provided</p>
                  )}
                </div>

                <Row>
                  <Col md={6}>
                    <div className="mb-3">
                      <h6 className="text-muted mb-2">Start Date</h6>
                      <p>{task.startDate ? formatDate(task.startDate) : 'Not set'}</p>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="mb-3">
                      <h6 className="text-muted mb-2">Due Date</h6>
                      <p>{task.dueDate ? formatDate(task.dueDate) : 'Not set'}</p>
                    </div>
                  </Col>
                </Row>

                <div className="mb-3">
                  <h6 className="text-muted mb-2">Estimated Hours</h6>
                  <p>{task.estimatedHours || 0} hours</p>
                </div>

                {milestone && (
                  <div className="mb-3">
                    <h6 className="text-muted mb-2">Linked Activity Schedule</h6>
                    <Badge bg="primary" className="fs-6">
                      {milestone.name}
                    </Badge>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={4}>
            <Card className="border-0 shadow-sm mb-4">
              <Card.Header className="bg-white">
                <h5 className="mb-0">Assigned To</h5>
              </Card.Header>
              <Card.Body>
                {task.assignedTo && task.assignedTo.length > 0 ? (
                  <div className="d-flex flex-column gap-2">
                    {projectMembers
                      .filter(member => task.assignedTo.includes(member.accountId))
                      .map(member => (
                        <div key={member.accountId} className="d-flex align-items-center gap-2">
                          <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px', flexShrink: 0 }}>
                            <strong>{member.firstName[0]}{member.lastName[0]}</strong>
                          </div>
                          <div>
                            <div><strong>{member.firstName} {member.lastName}</strong></div>
                            <small className="text-muted">@{member.username}</small>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-muted fst-italic mb-0">No one assigned</p>
                )}
              </Card.Body>
            </Card>

            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white">
                <h5 className="mb-0">Task Info</h5>
              </Card.Header>
              <Card.Body>
                <div className="mb-3">
                  <small className="text-muted d-block mb-1">Created</small>
                  <small>{task.$createdAt ? formatDate(task.$createdAt) : 'Unknown'}</small>
                </div>
                <div className="mb-3">
                  <small className="text-muted d-block mb-1">Last Updated</small>
                  <small>{task.$updatedAt ? formatDate(task.$updatedAt) : 'Unknown'}</small>
                </div>
                <div>
                  <small className="text-muted d-block mb-1">Task ID</small>
                  <small className="font-monospace">{task.$id}</small>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Task</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Are you sure you want to delete this task? This action cannot be undone.
          </Alert>
          <p className="mb-0"><strong>Task:</strong> {task.title}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            <i className="bi bi-trash me-2"></i>
            Delete Task
          </Button>
        </Modal.Footer>
      </Modal>
    </AppLayout>
  );
}

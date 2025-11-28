'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, Form, Button, Row, Col, Alert, Badge, Dropdown } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { databases, COLLECTIONS, DB_ID, ID, Permission, Role, Query } from '@/lib/appwriteClient';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

function NewTaskContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  const [selectedMilestone, setSelectedMilestone] = useState(null);

  useEffect(() => {
    if (user && params.id) {
      loadData();
    }
  }, [user, params.id]);

  // Pre-fill milestone from query params
  useEffect(() => {
    const milestoneId = searchParams.get('milestoneId');
    if (milestoneId) {
      setFormData(prev => ({ ...prev, milestoneId }));
    }
  }, [searchParams]);

  useEffect(() => {
    // Update selected milestone when milestoneId changes
    if (formData.milestoneId) {
      const milestone = milestones.find(m => m.$id === formData.milestoneId);
      setSelectedMilestone(milestone || null);
    } else {
      setSelectedMilestone(null);
    }
  }, [formData.milestoneId, milestones]);

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

      // Load milestones
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
      showToast('Failed to load project data. You may not have permission to view it.', 'danger');
    } finally {
      setLoading(false);
    }
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
    // If milestone is selected, validate against milestone dates
    if (selectedMilestone) {
      if (formData.startDate && selectedMilestone.startDate) {
        if (new Date(formData.startDate) < new Date(selectedMilestone.startDate)) {
          showToast('Task start date cannot be before milestone start date', 'warning');
          return false;
        }
      }

      if (formData.startDate && selectedMilestone.dueDate) {
        if (new Date(formData.startDate) > new Date(selectedMilestone.dueDate)) {
          showToast('Task start date cannot be after milestone due date', 'warning');
          return false;
        }
      }

      if (formData.dueDate && selectedMilestone.startDate) {
        if (new Date(formData.dueDate) < new Date(selectedMilestone.startDate)) {
          showToast('Task due date cannot be before milestone start date', 'warning');
          return false;
        }
      }

      if (formData.dueDate && selectedMilestone.dueDate) {
        if (new Date(formData.dueDate) > new Date(selectedMilestone.dueDate)) {
          showToast('Task due date cannot be after milestone due date', 'warning');
          return false;
        }
      }
    } else {
      // No milestone selected, validate against project dates
      if (formData.startDate && project.startDate) {
        if (new Date(formData.startDate) < new Date(project.startDate)) {
          showToast('Task start date cannot be before project start date', 'warning');
          return false;
        }
      }

      if (formData.startDate && project.endDate) {
        if (new Date(formData.startDate) > new Date(project.endDate)) {
          showToast('Task start date cannot be after project end date', 'warning');
          return false;
        }
      }

      if (formData.dueDate && project.startDate) {
        if (new Date(formData.dueDate) < new Date(project.startDate)) {
          showToast('Task due date cannot be before project start date', 'warning');
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

    // Validate start date vs due date
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
      await databases.createDocument(
        DB_ID,
        COLLECTIONS.TASKS,
        ID.unique(),
        {
          projectId: project.$id,
          milestoneId: formData.milestoneId || null,
          title: formData.title,
          description: formData.description || null,
          priority: formData.priority,
          status: formData.status,
          estimatedHours: parseFloat(formData.estimatedHours) || 0,
          startDate: formData.startDate || null,
          dueDate: formData.dueDate || null,
          assignedTo: formData.assignedTo,
          createdBy: user.authUser.$id,
        },
        [
          // Read: Anyone in the organization can read
          Permission.read(Role.team(project.organizationId)),
          // Update: Any project team member can update (this allows task status changes)
          Permission.update(Role.team(project.projectTeamId)),
          // Delete: Only admins and project managers can delete
          Permission.delete(Role.label('admin')),
          Permission.delete(Role.team(project.projectTeamId, 'manager')),
        ]
      );

      showToast('Task created successfully!', 'success');

      setTimeout(() => {
        router.push(`/projects/${project.$id}?tab=tasks`);
      }, 1000);
    } catch (err) {
      console.error('Failed to create task:', err);
      showToast(err.message || 'Failed to create task', 'danger');
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading..." />
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Project not found or you don&apos;t have permission to access it.
        </Alert>
      </AppLayout>
    );
  }

  // Get date constraints
  const getMinDate = () => {
    if (selectedMilestone?.startDate) return selectedMilestone.startDate;
    return project.startDate || undefined;
  };

  const getMaxDate = () => {
    if (selectedMilestone?.dueDate) return selectedMilestone.dueDate;
    return project.endDate || undefined;
  };

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2>Create New Task</h2>
            <p className="text-muted mb-0">
              Project: <strong>{project.name}</strong> ({project.code})
            </p>
          </div>
          <Button variant="outline-secondary" onClick={() => router.push(`/projects/${project.$id}?tab=tasks`)}>
            <i className="bi bi-arrow-left me-2"></i>
            Back to Project
          </Button>
        </div>
      </div>

      {selectedMilestone ? (
        <Alert variant="info" className="mb-3">
          <i className="bi bi-flag me-2"></i>
          <strong>Milestone Timeline:</strong> {selectedMilestone.name}
          {selectedMilestone.startDate && selectedMilestone.dueDate && (
            <>
              {' - '}
              {new Date(selectedMilestone.startDate).toLocaleDateString()} - {new Date(selectedMilestone.dueDate).toLocaleDateString()}
            </>
          )}
          <br />
          <small>Task dates must fall within this milestone timeline.</small>
        </Alert>
      ) : project.startDate && project.endDate ? (
        <Alert variant="info" className="mb-3">
          <i className="bi bi-info-circle me-2"></i>
          <strong>Project Timeline:</strong> {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
          <br />
          <small>Task dates must fall within this project timeline.</small>
        </Alert>
      ) : null}

      <Card className="border-0 shadow-sm">
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Milestone</Form.Label>
              <Form.Select
                name="milestoneId"
                value={formData.milestoneId}
                onChange={handleChange}
                disabled={submitting}
              >
                <option value="">No milestone (optional)</option>
                {milestones.map((milestone) => (
                  <option key={milestone.$id} value={milestone.$id}>
                    {milestone.name}
                    {milestone.startDate && milestone.dueDate && (
                      ` (${new Date(milestone.startDate).toLocaleDateString()} - ${new Date(milestone.dueDate).toLocaleDateString()})`
                    )}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Link this task to a milestone (optional)
              </Form.Text>
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
                placeholder="e.g., Design homepage mockup"
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
                placeholder="Enter task description (optional)"
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
                    placeholder="0"
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
                    min={getMinDate()}
                    max={getMaxDate()}
                    disabled={submitting}
                  />
                  {(selectedMilestone?.startDate || project.startDate) && (
                    <Form.Text className="text-muted">
                      Must be after {new Date(selectedMilestone?.startDate || project.startDate).toLocaleDateString()}
                    </Form.Text>
                  )}
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
                    min={formData.startDate || getMinDate()}
                    max={getMaxDate()}
                    disabled={submitting}
                  />
                  {(selectedMilestone?.dueDate || project.endDate) && (
                    <Form.Text className="text-muted">
                      Must be before {new Date(selectedMilestone?.dueDate || project.endDate).toLocaleDateString()}
                    </Form.Text>
                  )}
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

            <div className="d-flex justify-content-end gap-2 mt-4">
              <Button
                variant="outline-secondary"
                onClick={() => router.push(`/projects/${project.$id}?tab=tasks`)}
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
                    Creating Task...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    Create Task
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </AppLayout>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <LoadingSpinner message="Loading..." />
      </AppLayout>
    }>
      <NewTaskContent />
    </Suspense>
  );
}

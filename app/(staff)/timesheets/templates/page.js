'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Row, Col, Card, Button, Table, Badge, Modal, Form, Alert } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';

/**
 * Timesheet Templates Management Page
 * Allows users to view, edit, and delete their saved templates
 */
export default function TemplatesPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [templates, setTemplates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    projectId: '',
    taskId: '',
    hours: '',
    notes: '',
    billable: true
  });

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);

  useEffect(() => {
    if (user?.authUser?.$id && user?.organizationId) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      // Load templates
      const templatesRes = await fetch(
        `/api/timesheets/templates?accountId=${user.authUser.$id}&organizationId=${user.organizationId}`
      );
      const templatesData = await templatesRes.json();

      if (!templatesRes.ok) {
        throw new Error(templatesData.error || 'Failed to load templates');
      }

      setTemplates(templatesData.templates || []);

      // Load projects for display
      const projectsRes = await fetch(`/api/projects?organizationId=${user.organizationId}`);
      const projectsData = await projectsRes.json();
      if (projectsRes.ok) {
        setProjects(projectsData.projects || []);
      }

      // Load tasks for editing
      const tasksRes = await fetch(`/api/tasks?organizationId=${user.organizationId}`);
      const tasksData = await tasksRes.json();
      if (tasksRes.ok) {
        setTasks(tasksData.tasks || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.$id === projectId);
    return project ? `${project.code} - ${project.name}` : projectId;
  };

  const getTaskName = (taskId) => {
    if (!taskId) return 'N/A';
    const task = tasks.find(t => t.$id === taskId);
    return task ? task.name : taskId;
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setEditForm({
      name: template.name,
      projectId: template.projectId,
      taskId: template.taskId || '',
      hours: template.hours,
      notes: template.notes || '',
      billable: template.billable
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim()) {
      alert('Please enter a template name');
      return;
    }

    if (!editForm.projectId) {
      alert('Please select a project');
      return;
    }

    if (!editForm.hours || parseFloat(editForm.hours) <= 0) {
      alert('Please enter valid hours');
      return;
    }

    try {
      // Delete old template
      await fetch(`/api/timesheets/templates?templateId=${editingTemplate.$id}`, {
        method: 'DELETE'
      });

      // Create new template with updated data
      const response = await fetch('/api/timesheets/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: user.authUser.$id,
          organizationId: user.organizationId,
          name: editForm.name,
          projectId: editForm.projectId,
          taskId: editForm.taskId || null,
          hours: parseFloat(editForm.hours),
          notes: editForm.notes || null,
          billable: editForm.billable
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update template');
      }

      setShowEditModal(false);
      setEditingTemplate(null);
      loadData();
    } catch (err) {
      console.error('Error updating template:', err);
      alert(err.message);
    }
  };

  const handleDeleteConfirm = (templateId) => {
    setDeletingTemplateId(templateId);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/timesheets/templates?templateId=${deletingTemplateId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete template');
      }

      setShowDeleteModal(false);
      setDeletingTemplateId(null);
      loadData();
    } catch (err) {
      console.error('Error deleting template:', err);
      alert(err.message);
    }
  };

  const handleUseTemplate = (template) => {
    // Navigate to entry page with template applied
    const params = new URLSearchParams({
      projectId: template.projectId,
      taskId: template.taskId || '',
      hours: template.hours,
      notes: template.notes || '',
      billable: template.billable.toString()
    });
    router.push(`/timesheets/entry?${params.toString()}`);
  };

  if (loading) {
    return (
      <Container className="py-4">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <h2>My Timesheet Templates</h2>
              <p className="text-muted mb-0">
                Save and reuse frequently-used time entries
              </p>
            </div>
            <div className="d-flex gap-2">
              <Button variant="outline-info" size="sm" onClick={() => router.push('/timesheets/reports')}>
                <i className="bi bi-graph-up me-2"></i>
                Reports
              </Button>
              <Button variant="outline-secondary" onClick={() => router.push('/timesheets')}>
                <i className="bi bi-arrow-left me-2"></i>
                Back to Timesheets
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Templates List */}
      <Row>
        <Col>
          <Card>
            <Card.Body>
              {templates.length === 0 ? (
                <div className="text-center py-5">
                  <p className="text-muted mb-3">
                    You haven&apos;t created any templates yet.
                  </p>
                  <p className="text-muted mb-3">
                    Templates allow you to save frequently-used time entries for quick reuse.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => router.push('/timesheets/entry')}
                  >
                    Create Entry & Save as Template
                  </Button>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover>
                    <thead>
                      <tr>
                        <th>Template Name</th>
                        <th>Project</th>
                        <th>Task</th>
                        <th>Hours</th>
                        <th>Billable</th>
                        <th>Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map(template => (
                        <tr key={template.$id}>
                          <td>
                            <strong>{template.name}</strong>
                          </td>
                          <td>
                            <small>{getProjectName(template.projectId)}</small>
                          </td>
                          <td>
                            <small className="text-muted">
                              {getTaskName(template.taskId)}
                            </small>
                          </td>
                          <td>
                            <Badge bg="info">{template.hours}h</Badge>
                          </td>
                          <td>
                            {template.billable ? (
                              <Badge bg="success">Billable</Badge>
                            ) : (
                              <Badge bg="secondary">Non-billable</Badge>
                            )}
                          </td>
                          <td>
                            <small className="text-muted">
                              {template.notes ?
                                (template.notes.length > 30 ?
                                  template.notes.substring(0, 30) + '...' :
                                  template.notes
                                ) :
                                '-'
                              }
                            </small>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleUseTemplate(template)}
                                title="Use this template"
                              >
                                Use
                              </Button>
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handleEdit(template)}
                                title="Edit template"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDeleteConfirm(template.$id)}
                                title="Delete template"
                              >
                                Delete
                              </Button>
                            </div>
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

      {/* Edit Template Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Template</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Template Name *</Form.Label>
              <Form.Control
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="e.g., Daily Standup Meeting"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Project *</Form.Label>
              <Form.Select
                value={editForm.projectId}
                onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value })}
              >
                <option value="">Select Project</option>
                {projects.map(project => (
                  <option key={project.$id} value={project.$id}>
                    {project.code} - {project.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Task (Optional)</Form.Label>
              <Form.Select
                value={editForm.taskId}
                onChange={(e) => setEditForm({ ...editForm, taskId: e.target.value })}
              >
                <option value="">No Task</option>
                {tasks
                  .filter(task => task.projectId === editForm.projectId)
                  .map(task => (
                    <option key={task.$id} value={task.$id}>
                      {task.name}
                    </option>
                  ))}
              </Form.Select>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Hours *</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    value={editForm.hours}
                    onChange={(e) => setEditForm({ ...editForm, hours: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Billable</Form.Label>
                  <Form.Check
                    type="switch"
                    id="edit-billable-switch"
                    label={editForm.billable ? 'Billable' : 'Non-billable'}
                    checked={editForm.billable}
                    onChange={(e) => setEditForm({ ...editForm, billable: e.target.checked })}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Notes (Optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Add any notes or description..."
                maxLength={500}
              />
              <Form.Text className="text-muted">
                {editForm.notes.length}/500 characters
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveEdit}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Template</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete this template?</p>
          <p className="text-muted mb-0">This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { databases, COLLECTIONS, DB_ID, ID, Permission, Role } from '@/lib/appwriteClient';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function NewMilestonePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'open',
    startDate: '',
    dueDate: '',
    actualDueDate: ''
  });

  useEffect(() => {
    if (user && params.id) {
      loadProject();
    }
  }, [user, params.id]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const projectDoc = await databases.getDocument(
        DB_ID,
        COLLECTIONS.PROJECTS,
        params.id
      );
      setProject(projectDoc);
    } catch (err) {
      console.error('Failed to load project:', err);
      showToast('Failed to load project. You may not have permission to view it.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateDates = () => {
    // Validate start date against project dates
    if (formData.startDate && project.startDate) {
      if (new Date(formData.startDate) < new Date(project.startDate)) {
        showToast('Milestone start date cannot be before project start date', 'warning');
        return false;
      }
    }

    if (formData.startDate && project.endDate) {
      if (new Date(formData.startDate) > new Date(project.endDate)) {
        showToast('Milestone start date cannot be after project end date', 'warning');
        return false;
      }
    }

    // Validate due date against project dates
    if (formData.dueDate && project.startDate) {
      if (new Date(formData.dueDate) < new Date(project.startDate)) {
        showToast('Milestone due date cannot be before project start date', 'warning');
        return false;
      }
    }

    if (formData.dueDate && project.endDate) {
      if (new Date(formData.dueDate) > new Date(project.endDate)) {
        showToast('Milestone due date cannot be after project end date', 'warning');
        return false;
      }
    }

    // Validate start date vs due date
    if (formData.startDate && formData.dueDate) {
      if (new Date(formData.startDate) > new Date(formData.dueDate)) {
        showToast('Milestone start date cannot be after due date', 'warning');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('Milestone name is required', 'warning');
      return;
    }

    if (!validateDates()) {
      return;
    }

    setSubmitting(true);

    try {
      await databases.createDocument(
        DB_ID,
        COLLECTIONS.MILESTONES,
        ID.unique(),
        {
          projectId: project.$id,
          name: formData.name,
          description: formData.description || null,
          status: formData.status,
          startDate: formData.startDate || null,
          dueDate: formData.dueDate || null,
          actualDueDate: formData.actualDueDate || null,
          createdBy: user.authUser.$id,
        },
        [
          // Read: Anyone in the organization can read
          Permission.read(Role.team(project.organizationId)),
          // Update: Admins and project managers can update
          Permission.update(Role.label('admin')),
          Permission.update(Role.team(project.projectTeamId, 'manager')),
          // Delete: Admins and project managers can delete
          Permission.delete(Role.label('admin')),
          Permission.delete(Role.team(project.projectTeamId, 'manager')),
        ]
      );

      showToast('Milestone created successfully!', 'success');

      setTimeout(() => {
        router.push(`/projects/${project.$id}?tab=milestones`);
      }, 1000);
    } catch (err) {
      console.error('Failed to create milestone:', err);
      showToast(err.message || 'Failed to create milestone', 'danger');
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

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2>Create New Milestone</h2>
            <p className="text-muted mb-0">
              Project: <strong>{project.name}</strong> ({project.code})
            </p>
          </div>
          <Button variant="outline-secondary" onClick={() => router.push(`/projects/${project.$id}?tab=milestones`)}>
            <i className="bi bi-arrow-left me-2"></i>
            Back to Project
          </Button>
        </div>
      </div>

      {project.startDate && project.endDate && (
        <Alert variant="info" className="mb-3">
          <i className="bi bi-info-circle me-2"></i>
          <strong>Project Timeline:</strong> {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
          <br />
          <small>Milestone dates must fall within this project timeline.</small>
        </Alert>
      )}

      <Card className="border-0 shadow-sm">
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>
                Milestone Name <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Phase 1 Completion"
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
                placeholder="Enter milestone description (optional)"
                disabled={submitting}
              />
            </Form.Group>

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    disabled={submitting}
                  >
                    <option value="open">Open</option>
                    <option value="reached">Reached</option>
                    <option value="closed">Closed</option>
                  </Form.Select>
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
                    min={project.startDate || undefined}
                    max={project.endDate || undefined}
                    disabled={submitting}
                  />
                  {project.startDate && (
                    <Form.Text className="text-muted">
                      Must be after {new Date(project.startDate).toLocaleDateString()}
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
                    min={formData.startDate || project.startDate || undefined}
                    max={project.endDate || undefined}
                    disabled={submitting}
                  />
                  {project.endDate && (
                    <Form.Text className="text-muted">
                      Must be before {new Date(project.endDate).toLocaleDateString()}
                    </Form.Text>
                  )}
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Actual Due Date</Form.Label>
              <Form.Control
                type="date"
                name="actualDueDate"
                value={formData.actualDueDate}
                onChange={handleChange}
                disabled={submitting}
              />
              <Form.Text className="text-muted">
                Only fill this if the milestone has been completed
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <Button
                variant="outline-secondary"
                onClick={() => router.push(`/projects/${project.$id}?tab=milestones`)}
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
                    Creating Milestone...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    Create Milestone
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

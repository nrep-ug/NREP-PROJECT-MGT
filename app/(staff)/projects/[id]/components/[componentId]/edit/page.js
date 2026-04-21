'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { useProject, useProjectMembers } from '@/hooks/useProjects';
import { databases, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function EditComponentPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: project, isLoading: projectLoading } = useProject(params.id);
  const { data: teamMembers = [] } = useProjectMembers(params.id, user?.authUser?.$id);
  const [component, setComponent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leaderId: '',
  });

  // Load component data
  useEffect(() => {
    if (user && params.componentId) {
      loadComponent();
    }
  }, [user, params.componentId]);

  const loadComponent = async () => {
    try {
      setLoading(true);
      const doc = await databases.getDocument(
        DB_ID,
        COLLECTIONS.PROJECT_COMPONENTS,
        params.componentId
      );
      setComponent(doc);
      setFormData({
        name: doc.name || '',
        description: doc.description || '',
        leaderId: doc.leaderId || '',
      });
    } catch (err) {
      console.error('Failed to load component:', err);
      showToast('Failed to load component', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('Component name is required', 'warning');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/components/${params.componentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          requesterId: user.authUser.$id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update component');
      }

      showToast('Component updated successfully!', 'success');

      setTimeout(() => {
        router.push(`/projects/${params.id}/components/${params.componentId}`);
      }, 1000);
    } catch (err) {
      console.error('Failed to update component:', err);
      showToast(err.message || 'Failed to update component', 'danger');
      setSubmitting(false);
    }
  };

  if (authLoading || projectLoading || loading) {
    return (
      <AppLayout user={user}>
        <LoadingSpinner message="Loading component..." />
      </AppLayout>
    );
  }

  if (!project || !component) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Component not found
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      <div className="mb-4">
        <Button
          variant="link"
          onClick={() => router.push(`/projects/${params.id}/components/${params.componentId}`)}
          className="p-0 mb-3 text-decoration-none"
          style={{ color: '#054653', fontWeight: '500' }}
        >
          <i className="bi bi-arrow-left me-2"></i>
          Back to Component
        </Button>

        {/* Hero Header Card */}
        <Card className="border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)' }}>
          <Card.Body className="text-white p-4">
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center me-3"
                  style={{
                    width: '56px',
                    height: '56px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <i className="bi bi-pencil-square" style={{ fontSize: '1.75rem' }}></i>
                </div>
                <div>
                  <h2 className="mb-1 fw-bold">Edit Component</h2>
                  <p className="mb-0 opacity-90">
                    Editing <strong>{component.name}</strong> — {project.name}
                  </p>
                </div>
              </div>
              <div className="opacity-15" style={{ fontSize: '5rem', marginTop: '-1rem', marginRight: '-1rem' }}>
                <i className="bi bi-box-seam"></i>
              </div>
            </div>
          </Card.Body>
        </Card>
      </div>

      <Card className="border-0 shadow-sm rounded-4">
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            {/* Component Details Section */}
            <div className="d-flex align-items-center mb-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center me-3"
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)',
                  boxShadow: '0 2px 8px rgba(5, 70, 83, 0.3)'
                }}
              >
                <i className="bi bi-box-seam text-white" style={{ fontSize: '1rem' }}></i>
              </div>
              <h6 className="text-uppercase fw-bold small mb-0" style={{ color: '#054653', letterSpacing: '0.5px' }}>
                Component Details
              </h6>
            </div>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-medium">
                Name <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Backend API"
                required
                disabled={submitting}
                className="bg-light border-0"
                style={{ padding: '0.75rem', borderRadius: '8px' }}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-medium">Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Component description..."
                disabled={submitting}
                className="bg-light border-0"
                style={{ padding: '0.75rem', borderRadius: '8px' }}
              />
            </Form.Group>

            {/* Team Section */}
            <div className="d-flex align-items-center mb-3 mt-4">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center me-3"
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'linear-gradient(135deg, #14B8A6 0%, #0f9488 100%)',
                  boxShadow: '0 2px 8px rgba(20, 184, 166, 0.3)'
                }}
              >
                <i className="bi bi-person-badge text-white" style={{ fontSize: '1rem' }}></i>
              </div>
              <h6 className="text-uppercase fw-bold small mb-0" style={{ color: '#14B8A6', letterSpacing: '0.5px' }}>
                Leadership
              </h6>
            </div>

            <Form.Group className="mb-4">
              <Form.Label className="small fw-medium">Component Leader</Form.Label>
              <Form.Select
                name="leaderId"
                value={formData.leaderId}
                onChange={handleChange}
                disabled={submitting}
                className="bg-light border-0"
                style={{ padding: '0.75rem', borderRadius: '8px' }}
              >
                <option value="">No leader assigned</option>
                {teamMembers.map((member) => (
                  <option key={member.accountId} value={member.accountId}>
                    {member.firstName} {member.lastName} (@{member.username})
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted small">
                Optional: Assign a team member as the component leader
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-between align-items-center mt-5 pt-4 border-top">
              <Button
                variant="link"
                className="text-muted text-decoration-none"
                onClick={() => router.push(`/projects/${params.id}/components/${params.componentId}`)}
                disabled={submitting}
                style={{ fontWeight: '500' }}
              >
                <i className="bi bi-arrow-left me-2"></i>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="px-5 py-3 fw-semibold border-0"
                style={{
                  background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)',
                  color: 'white',
                  borderRadius: '10px',
                  boxShadow: '0 4px 15px rgba(5, 70, 83, 0.4)',
                  fontSize: '1rem',
                  transition: 'all 0.3s ease',
                  transform: 'translateY(0)'
                }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(5, 70, 83, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(5, 70, 83, 0.4)';
                }}
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
          </Form>
        </Card.Body>
      </Card>
    </AppLayout>
  );
}

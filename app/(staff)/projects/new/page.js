'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function NewProjectPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    clientId: '',
    startDate: '',
    endDate: '',
    budgetAmount: '',
    budgetCurrency: 'USD',
    status: 'planned'
  });

  const [components, setComponents] = useState([]);

  useEffect(() => {
    if (user) {
      loadClients();
    }
  }, [user]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/clients?organizationId=${user.organizationId}`);
      const data = await response.json();

      if (response.ok) {
        setClients(data.clients || []);
      } else {
        showToast('Failed to load clients', 'danger');
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
      showToast('Failed to load clients', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addComponent = () => {
    setComponents([...components, { name: '', description: '' }]);
  };

  const removeComponent = (index) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const handleComponentChange = (index, field, value) => {
    const updatedComponents = [...components];
    updatedComponents[index][field] = value;
    setComponents(updatedComponents);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.code.trim()) {
      showToast('Project code is required', 'warning');
      return;
    }

    if (!formData.name.trim()) {
      showToast('Project name is required', 'warning');
      return;
    }

    if (!formData.clientId) {
      showToast('Please select a client', 'warning');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          budgetAmount: parseFloat(formData.budgetAmount) || 0,
          organizationId: user.organizationId,
          createdBy: user.authUser.$id,
          components: components.filter(c => c.name.trim()), // Only send components with names
          requesterId: user.authUser.$id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      showToast('Project created successfully!', 'success');

      // Navigate to the newly created project
      setTimeout(() => {
        router.push(`/projects/${data.project.$id}`);
      }, 1000);
    } catch (err) {
      console.error('Failed to create project:', err);
      showToast(err.message || 'Failed to create project', 'danger');
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

  // Check if user is admin
  if (!user?.isAdmin) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Only administrators can create projects.
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
          onClick={() => router.push('/projects')}
          className="p-0 mb-3 text-decoration-none"
          style={{ color: '#054653', fontWeight: '500' }}
        >
          <i className="bi bi-arrow-left me-2"></i>
          Back to Projects
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
                  <i className="bi bi-folder-plus" style={{ fontSize: '1.75rem' }}></i>
                </div>
                <div>
                  <h2 className="mb-1 fw-bold">Create New Project</h2>
                  <p className="mb-0 opacity-90">Fill in the details to create a new project</p>
                </div>
              </div>
              <div className="opacity-15" style={{ fontSize: '5rem', marginTop: '-1rem', marginRight: '-1rem' }}>
                <i className="bi bi-folder-fill"></i>
              </div>
            </div>
          </Card.Body>
        </Card>
      </div>

      <Card className="border-0 shadow-sm rounded-4">
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            {/* Basic Information Section */}
            <div className="d-flex align-items-center mb-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center me-3"
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'linear-gradient(135deg, #054653 0%, #1d4ed8 100%)',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                }}
              >
                <i className="bi bi-info-circle-fill text-white" style={{ fontSize: '1rem' }}></i>
              </div>
              <h6 className="text-uppercase fw-bold small mb-0" style={{ color: '#054653', letterSpacing: '0.5px' }}>
                Basic Information
              </h6>
            </div>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-medium">
                    Project Code <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="e.g., PROJ-2025-001"
                    required
                    disabled={submitting}
                    className="bg-light border-0"
                    style={{ padding: '0.75rem', borderRadius: '8px' }}
                  />
                  <Form.Text className="text-muted small">
                    Unique identifier for the project
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-medium">
                    Project Name <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Website Redesign"
                    required
                    disabled={submitting}
                    className="bg-light border-0"
                    style={{ padding: '0.75rem', borderRadius: '8px' }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <Form.Label className="small fw-medium">Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter project description..."
                disabled={submitting}
                className="bg-light border-0"
                style={{ padding: '0.75rem', borderRadius: '8px' }}
              />
            </Form.Group>

            {/* Client & Status Section */}
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
                <i className="bi bi-people-fill text-white" style={{ fontSize: '1rem' }}></i>
              </div>
              <h6 className="text-uppercase fw-bold small mb-0" style={{ color: '#14B8A6', letterSpacing: '0.5px' }}>
                Client & Status
              </h6>
            </div>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-medium">
                    Client <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    name="clientId"
                    value={formData.clientId}
                    onChange={handleChange}
                    required
                    disabled={submitting}
                    className="bg-light border-0"
                    style={{ padding: '0.75rem', borderRadius: '8px' }}
                  >
                    <option value="">Select a client...</option>
                    {clients.map((client) => (
                      <option key={client.$id} value={client.$id}>
                        {client.name} {client.companyName ? `(${client.companyName})` : ''}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-medium">Status</Form.Label>
                  <Form.Select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    disabled={submitting}
                    className="bg-light border-0"
                    style={{ padding: '0.75rem', borderRadius: '8px' }}
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            {/* Timeline & Budget Section */}
            <div className="d-flex align-items-center mb-3 mt-4">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center me-3"
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                }}
              >
                <i className="bi bi-calendar-check-fill text-white" style={{ fontSize: '1rem' }}></i>
              </div>
              <h6 className="text-uppercase fw-bold small mb-0" style={{ color: '#f59e0b', letterSpacing: '0.5px' }}>
                Timeline & Budget
              </h6>
            </div>

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-medium">
                    <i className="bi bi-calendar-event me-2" style={{ color: '#054653' }}></i>
                    Start Date
                  </Form.Label>
                  <Form.Control
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    disabled={submitting}
                    className="bg-light border-0"
                    style={{ padding: '0.75rem', borderRadius: '8px' }}
                  />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-medium">
                    <i className="bi bi-calendar-check me-2" style={{ color: '#14B8A6' }}></i>
                    End Date
                  </Form.Label>
                  <Form.Control
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    disabled={submitting}
                    className="bg-light border-0"
                    style={{ padding: '0.75rem', borderRadius: '8px' }}
                  />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-medium">
                    <i className="bi bi-cash-stack me-2" style={{ color: '#f59e0b' }}></i>
                    Budget
                  </Form.Label>
                  <Row className="g-2">
                    <Col xs={7}>
                      <Form.Control
                        type="number"
                        name="budgetAmount"
                        value={formData.budgetAmount}
                        onChange={handleChange}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        disabled={submitting}
                        className="bg-light border-0"
                        style={{ padding: '0.75rem', borderRadius: '8px' }}
                      />
                    </Col>
                    <Col xs={5}>
                      <Form.Select
                        name="budgetCurrency"
                        value={formData.budgetCurrency}
                        onChange={handleChange}
                        disabled={submitting}
                        className="bg-light border-0"
                        style={{ padding: '0.75rem', borderRadius: '8px' }}
                      >
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="UGX">UGX (Sh)</option>
                      </Form.Select>
                    </Col>
                  </Row>
                </Form.Group>
              </Col>
            </Row>

            {/* Project Components Section */}
            <div className="d-flex align-items-center mb-3 mt-4">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center me-3"
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                }}
              >
                <i className="bi bi-boxes text-white" style={{ fontSize: '1rem' }}></i>
              </div>
              <h6 className="text-uppercase fw-bold small mb-0" style={{ color: '#8b5cf6', letterSpacing: '0.5px' }}>
                Project Components (Optional)
              </h6>
            </div>

            {components.length > 0 && (
              <div className="mb-3">
                {components.map((component, index) => (
                  <div key={index} className="mb-3 p-3 bg-light rounded-3 border" style={{ borderColor: '#e5e7eb' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small fw-semibold text-muted">Component #{index + 1}</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-danger p-0"
                        onClick={() => removeComponent(index)}
                        disabled={submitting}
                        style={{ fontSize: '0.9rem' }}
                      >
                        <i className="bi bi-trash me-1"></i>
                        Remove
                      </Button>
                    </div>
                    <Row>
                      <Col md={4}>
                        <Form.Group className="mb-2">
                          <Form.Label className="small fw-medium">Name</Form.Label>
                          <Form.Control
                            type="text"
                            value={component.name}
                            onChange={(e) => handleComponentChange(index, 'name', e.target.value)}
                            placeholder="e.g., Backend API"
                            disabled={submitting}
                            className="bg-white border-0"
                            style={{ padding: '0.75rem', borderRadius: '8px' }}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={8}>
                        <Form.Group className="mb-2">
                          <Form.Label className="small fw-medium">Description</Form.Label>
                          <Form.Control
                            type="text"
                            value={component.description}
                            onChange={(e) => handleComponentChange(index, 'description', e.target.value)}
                            placeholder="Component description..."
                            disabled={submitting}
                            className="bg-white border-0"
                            style={{ padding: '0.75rem', borderRadius: '8px' }}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline-secondary"
              onClick={addComponent}
              disabled={submitting}
              className="mb-4 border-2"
              style={{
                borderStyle: 'dashed',
                borderColor: '#8b5cf6',
                color: '#8b5cf6',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!submitting) {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Add Component
            </Button>

            <div className="d-flex justify-content-between align-items-center mt-5 pt-4 border-top">
              <Button
                variant="link"
                className="text-muted text-decoration-none"
                onClick={() => router.push('/projects')}
                disabled={submitting}
                style={{ fontWeight: '500' }}
              >
                <i className="bi bi-arrow-left me-2"></i>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="px-5 py-3 fw-semibold position-relative overflow-hidden border-0"
                style={{
                  background: 'linear-gradient(135deg, #054653 0%, #1d4ed8 100%)',
                  color: 'white',
                  borderRadius: '10px',
                  boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
                  fontSize: '1rem',
                  transition: 'all 0.3s ease',
                  transform: 'translateY(0)'
                }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(37, 99, 235, 0.4)';
                }}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Creating Project...
                  </>
                ) : (
                  <>
                    <i className="bi bi-folder-plus me-2"></i>
                    Create Project
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

'use client';

import { useState, useEffect } from 'react';
import { Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import Toast, { useToast } from '@/components/Toast';

export default function NewClientPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    primaryContactId: '',
    address: '',
    website: '',
    notes: '',
    status: 'active',
  });

  const [clientUsers, setClientUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Load client users on mount
  useEffect(() => {
    if (user?.organizationId) {
      loadClientUsers();
    }
  }, [user]);

  // Check if user is admin
  if (!authLoading && user && !user.isAdmin) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">
          <Alert.Heading>Access Denied</Alert.Heading>
          <p>Only administrators can create client organizations.</p>
        </Alert>
      </AppLayout>
    );
  }

  const loadClientUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch(`/api/admin/users?organizationId=${user.organizationId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();

      // Filter for client users only
      const clients = data.users.filter(u => u.roles?.includes('client'));
      setClientUsers(clients);
    } catch (error) {
      console.error('Failed to load client users:', error);
      showToast('Failed to load client users', 'danger');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Validation
  const validateForm = () => {
    const errors = {};

    if (!formData.name || formData.name.trim().length < 2) {
      errors.name = 'Client organization name is required (min 2 characters)';
    }

    if (formData.website && !isValidUrl(formData.website)) {
      errors.website = 'Please enter a valid URL (e.g., https://example.com)';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Please fix the validation errors', 'warning');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          organizationId: user.organizationId,
          requesterId: user.authUser?.$id || user.accountId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create client organization');
      }

      showToast(`Client organization "${formData.name}" created successfully!`, 'success');

      // Redirect to clients list after a short delay
      setTimeout(() => {
        router.push('/clients');
      }, 1500);
    } catch (error) {
      console.error('Error creating client:', error);
      showToast(error.message, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <AppLayout user={user}>
        <div className="text-center py-5">
          <p>Loading...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      <div className="mb-4">
        <h2>Create Client Organization</h2>
        <p className="text-muted">
          Add a new client organization to manage projects and contacts
        </p>
      </div>

      <Card>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label>Organization Name *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={submitting}
                    placeholder="e.g., Acme Corporation"
                    isInvalid={!!validationErrors.name}
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.name}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Code</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    disabled={submitting}
                    placeholder="ACME"
                    maxLength={10}
                  />
                  <Form.Text className="text-muted">
                    Short code for reference
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Primary Contact Person</Form.Label>
              <Form.Select
                value={formData.primaryContactId}
                onChange={(e) => setFormData({ ...formData, primaryContactId: e.target.value })}
                disabled={submitting || loadingUsers}
              >
                <option value="">None (add contact later)</option>
                {clientUsers.map((u) => (
                  <option key={u.accountId} value={u.accountId}>
                    {u.firstName} {u.lastName} (@{u.username}) - {u.email}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Select a client user as the primary contact, or skip to add later.
                {clientUsers.length === 0 && !loadingUsers && (
                  <span className="text-warning d-block">
                    No client users available. Create a client user first in the Admin panel.
                  </span>
                )}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Address</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={submitting}
                placeholder="Street address, city, country"
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Website</Form.Label>
                  <Form.Control
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    disabled={submitting}
                    placeholder="https://example.com"
                    isInvalid={!!validationErrors.website}
                  />
                  <Form.Control.Feedback type="invalid">
                    {validationErrors.website}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={submitting}
                placeholder="Additional notes or information about this client organization"
              />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button
                variant="secondary"
                onClick={() => router.push('/clients')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Client Organization'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </AppLayout>
  );
}

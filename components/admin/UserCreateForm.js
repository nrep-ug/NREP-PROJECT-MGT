'use client';

import { useState } from 'react';
import { Modal, Form, Button, Row, Col, Alert, InputGroup } from 'react-bootstrap';

export default function UserCreateForm({ show, onHide, organizationId, currentUser, onUserCreated, showToast }) {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    otherNames: '',
    role: 'staff',
    title: '',
    department: '',
    sendEmail: true
  });
  const [loading, setLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Validate form
  const validateForm = () => {
    const errors = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      errors.email = 'Valid email is required';
    }

    // Username validation (alphanumeric and underscores only)
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!formData.username || !usernameRegex.test(formData.username)) {
      errors.username = 'Username must be 3-30 characters (letters, numbers, underscores only)';
    }

    // Name validations
    if (!formData.firstName || formData.firstName.trim().length < 2) {
      errors.firstName = 'First name must be at least 2 characters';
    }

    if (!formData.lastName || formData.lastName.trim().length < 2) {
      errors.lastName = 'Last name must be at least 2 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      showToast('Please fix the validation errors', 'warning');
      return;
    }

    setLoading(true);
    setCreatedUser(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          organizationId,
          requesterId: currentUser?.authUser?.$id || currentUser?.accountId || currentUser?.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setCreatedUser(data);
      showToast(`User ${data.user.username} created successfully!`, 'success');

      // Reset form
      setFormData({
        email: '',
        username: '',
        firstName: '',
        lastName: '',
        otherNames: '',
        role: 'staff',
        title: '',
        department: '',
        sendEmail: true
      });
      setValidationErrors({});

      // Notify parent
      if (onUserCreated) {
        onUserCreated(data.user);
      }

      // Keep modal open to show password if email wasn't sent
      if (!data.temporaryPassword) {
        setTimeout(() => {
          onHide();
          setCreatedUser(null);
        }, 2000);
      }

    } catch (error) {
      showToast(error.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Copy password to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Password copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy password', 'danger');
    });
  };

  const handleClose = () => {
    setCreatedUser(null);
    setValidationErrors({});
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Create New User</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {createdUser && createdUser.temporaryPassword && (
            <Alert variant="success">
              <Alert.Heading>✓ User Created Successfully!</Alert.Heading>
              <p className="mb-2">
                <strong>Email:</strong> {createdUser.user.email}<br />
                <strong>Username:</strong> @{createdUser.user.username}<br />
                <strong>Role:</strong> {createdUser.user.role}
              </p>
              <Alert.Heading className="h6 mt-3">Temporary Password</Alert.Heading>
              <p className="mb-2">
                Please share this password with the user securely. They should change it after first login.
              </p>
              <InputGroup className="mb-2">
                <Form.Control
                  type="text"
                  value={createdUser.temporaryPassword}
                  readOnly
                  className="font-monospace fs-6 bg-light"
                />
                <Button
                  variant="outline-primary"
                  onClick={() => copyToClipboard(createdUser.temporaryPassword)}
                >
                  Copy
                </Button>
              </InputGroup>
              <small className="text-danger">
                <strong>Important:</strong> This password will not be shown again. Copy it now.
              </small>
            </Alert>
          )}

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Email Address *</Form.Label>
                <Form.Control
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={loading || !!createdUser}
                  placeholder="user@example.com"
                  isInvalid={!!validationErrors.email}
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.email}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Username *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                  required
                  disabled={loading || !!createdUser}
                  placeholder="johndoe"
                  isInvalid={!!validationErrors.username}
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.username}
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                  3-30 characters (letters, numbers, underscores)
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>First Name *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  disabled={loading || !!createdUser}
                  placeholder="John"
                  isInvalid={!!validationErrors.firstName}
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.firstName}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Last Name *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  disabled={loading || !!createdUser}
                  placeholder="Doe"
                  isInvalid={!!validationErrors.lastName}
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.lastName}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Other Names</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.otherNames}
                  onChange={(e) => setFormData({ ...formData, otherNames: e.target.value })}
                  disabled={loading || !!createdUser}
                  placeholder="Middle names"
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Role *</Form.Label>
                <Form.Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                  disabled={loading || !!createdUser}
                >
                  <option value="admin">Admin - Full system access</option>
                  <option value="manager">Manager - Manage projects and approve timesheets</option>
                  <option value="staff">Staff - Work on tasks and log time</option>
                  <option value="client">Client - Read-only access to assigned projects</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Job Title</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  disabled={loading || !!createdUser}
                  placeholder="e.g., Project Manager"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Department</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  disabled={loading || !!createdUser}
                  placeholder="e.g., Engineering"
                />
              </Form.Group>
            </Col>
          </Row>

          {!createdUser && (
            <Alert variant="info" className="small">
              <strong>Note:</strong> Email integration is not yet configured. After creating the user,
              you&apos;ll receive a temporary password that must be manually shared with them.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          {createdUser ? (
            <>
              <Button variant="success" onClick={handleClose}>
                Done
              </Button>
              <Button variant="primary" onClick={() => setCreatedUser(null)}>
                Create Another User
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Creating User...' : 'Create User'}
              </Button>
            </>
          )}
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, Modal, Form, Alert, Row, Col, Table, Spinner } from 'react-bootstrap';
import { useProjectRoles, useCreateProjectRole, useUpdateProjectRole, useDeleteProjectRole } from '@/hooks/useProjectRoles';
import { PERMISSION_CATEGORIES, ALL_PERMISSIONS } from '@/lib/projectRoles';

/**
 * ProjectRolesSettings — Roles management UI for the project settings page.
 * Allows admins/managers to list, create, edit, and delete project roles.
 */
export default function ProjectRolesSettings({ projectId, requesterId, showToast }) {
  const { data: roles = [], isLoading, error } = useProjectRoles(projectId, requesterId);
  const createRole = useCreateProjectRole(projectId);
  const updateRole = useUpdateProjectRole(projectId);
  const deleteRole = useDeleteProjectRole(projectId);

  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null); // null = creating, object = editing

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('#6c757d');
  const [formPermissions, setFormPermissions] = useState([]);
  const [formPriority, setFormPriority] = useState(50);
  const [formIsStaffRole, setFormIsStaffRole] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const COLOR_PALETTE = [
    '#0d6efd', '#0dcaf0', '#198754', '#ffc107', '#dc3545',
    '#6f42c1', '#d63384', '#fd7e14', '#20c997', '#6c757d',
    '#343a40', '#0a58ca',
  ];

  const resetForm = () => {
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormColor('#6c757d');
    setFormPermissions([]);
    setFormPriority(50);
    setFormIsStaffRole(true);
    setEditingRole(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (role) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormSlug(role.slug);
    setFormDescription(role.description || '');
    setFormColor(role.color || '#6c757d');
    setFormPermissions(role.permissions || []);
    setFormPriority(role.priority ?? 50);
    setFormIsStaffRole(role.isStaffRole !== false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Auto-generate slug from name (only for new roles)
  useEffect(() => {
    if (!editingRole && formName) {
      setFormSlug(
        formName
          .toLowerCase()
          .replace(/[^a-z0-9\s_-]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 60)
      );
    }
  }, [formName, editingRole]);

  const togglePermission = (perm) => {
    setFormPermissions((prev) =>
      prev.includes(perm)
        ? prev.filter((p) => p !== perm)
        : [...prev, perm]
    );
  };

  const toggleCategoryAll = (category) => {
    const categoryPerms = PERMISSION_CATEGORIES[category];
    const allChecked = categoryPerms.every((p) => formPermissions.includes(p));
    if (allChecked) {
      setFormPermissions((prev) => prev.filter((p) => !categoryPerms.includes(p)));
    } else {
      setFormPermissions((prev) => [...new Set([...prev, ...categoryPerms])]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) {
      showToast('Name and slug are required', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      if (editingRole) {
        // Update
        await updateRole.mutateAsync({
          roleId: editingRole.$id,
          name: formName.trim(),
          description: formDescription.trim() || null,
          color: formColor,
          permissions: formPermissions,
          priority: formPriority,
          isStaffRole: formIsStaffRole,
          requesterId,
        });
        showToast(`Role "${formName}" updated successfully`, 'success');
      } else {
        // Create
        await createRole.mutateAsync({
          slug: formSlug.trim(),
          name: formName.trim(),
          description: formDescription.trim() || null,
          color: formColor,
          permissions: formPermissions,
          priority: formPriority,
          isStaffRole: formIsStaffRole,
          requesterId,
        });
        showToast(`Role "${formName}" created successfully`, 'success');
      }
      closeModal();
    } catch (err) {
      showToast(err.message || 'Failed to save role', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (role) => {
    if (!confirm(`Are you sure you want to delete the role "${role.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteRole.mutateAsync({ roleId: role.$id, requesterId });
      showToast(`Role "${role.name}" deleted`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete role', 'danger');
    }
  };

  // Sort roles by priority (descending)
  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }, [roles]);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm rounded-4 mb-4">
        <Card.Body className="text-center py-5">
          <Spinner animation="border" size="sm" className="me-2" />
          Loading roles...
        </Card.Body>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <i className="bi bi-exclamation-triangle me-2"></i>
        Failed to load project roles: {error.message}
      </Alert>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-sm rounded-4 mb-4">
        <Card.Header
          className="py-3 border-bottom-0 rounded-top-4"
          style={{ backgroundColor: '#f8fafc' }}
        >
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-shield-lock" style={{ fontSize: '1.25rem', color: '#054653' }}></i>
              <h5 className="mb-0 fw-bold" style={{ color: '#0f172a' }}>Project Roles</h5>
              <Badge bg="secondary" pill>{roles.length}</Badge>
            </div>
            <Button
              size="sm"
              style={{
                backgroundColor: '#054653',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                padding: '0.5rem 1rem',
              }}
              onClick={openCreateModal}
            >
              <i className="bi bi-plus-circle me-1"></i>
              Add Custom Role
            </Button>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {sortedRoles.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-shield" style={{ fontSize: '3rem', opacity: 0.2 }}></i>
              <h6 className="mt-3 text-muted">No Roles Configured</h6>
              <p className="text-muted small">
                Create roles to control what team members can do in this project.
              </p>
              <Button variant="outline-primary" size="sm" onClick={openCreateModal}>
                <i className="bi bi-plus-circle me-1"></i>
                Create First Role
              </Button>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0 align-middle">
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', padding: '0.75rem 1rem' }}>Role</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', padding: '0.75rem 1rem' }}>Slug</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', padding: '0.75rem 1rem' }}>Permissions</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', padding: '0.75rem 1rem' }}>Priority</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', padding: '0.75rem 1rem' }}>Type</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '600', color: '#64748b', padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRoles.map((role) => (
                    <tr key={role.$id}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div className="d-flex align-items-center gap-2">
                          <div
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: role.color || '#6c757d',
                              flexShrink: 0,
                            }}
                          ></div>
                          <div>
                            <strong style={{ color: '#1e293b' }}>{role.name}</strong>
                            {role.isDefault && (
                              <Badge bg="light" text="muted" className="ms-2" style={{ fontSize: '0.65rem' }}>
                                Default
                              </Badge>
                            )}
                            {role.description && (
                              <div className="text-muted small text-truncate" style={{ maxWidth: '250px' }}>
                                {role.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <code style={{ fontSize: '0.8rem', color: '#64748b' }}>{role.slug}</code>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <Badge
                          bg="light"
                          text="dark"
                          style={{ fontSize: '0.75rem' }}
                        >
                          {role.permissions?.length || 0} permissions
                        </Badge>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className="text-muted" style={{ fontSize: '0.85rem' }}>{role.priority ?? 50}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <Badge
                          bg={role.isStaffRole !== false ? 'info' : 'warning'}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {role.isStaffRole !== false ? 'Staff' : 'Client'}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="me-1"
                          onClick={() => openEditModal(role)}
                          style={{ borderRadius: '6px' }}
                        >
                          <i className="bi bi-pencil"></i>
                        </Button>
                        {!role.isDefault && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDelete(role)}
                            style={{ borderRadius: '6px' }}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
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

      {/* Create/Edit Role Modal */}
      <Modal show={showModal} onHide={closeModal} size="lg" centered>
        <Modal.Header closeButton className="border-bottom-0 pb-0">
          <Modal.Title className="fw-bold">
            <i className={`bi ${editingRole ? 'bi-pencil-square' : 'bi-plus-circle'} me-2`}
               style={{ color: '#054653' }}></i>
            {editingRole ? `Edit Role: ${editingRole.name}` : 'Create Custom Role'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body className="pt-3">
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Role Name <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g., Senior Developer"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">
                    Slug <span className="text-danger">*</span>
                    {editingRole && (
                      <Badge bg="warning" text="dark" className="ms-2" style={{ fontSize: '0.6rem' }}>
                        Cannot change
                      </Badge>
                    )}
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="auto-generated"
                    value={formSlug}
                    onChange={(e) => !editingRole && setFormSlug(e.target.value)}
                    required
                    disabled={submitting || !!editingRole}
                    style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                  />
                  <Form.Text className="text-muted">
                    Machine-readable identifier used in team memberships
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold small">Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="What can users with this role do?"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                disabled={submitting}
              />
            </Form.Group>

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Color</Form.Label>
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    {COLOR_PALETTE.map((color) => (
                      <div
                        key={color}
                        onClick={() => !submitting && setFormColor(color)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: color,
                          cursor: submitting ? 'not-allowed' : 'pointer',
                          border: formColor === color ? '3px solid #054653' : '2px solid #e2e8f0',
                          transition: 'all 0.15s',
                        }}
                      ></div>
                    ))}
                  </div>
                  <Form.Control
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    disabled={submitting}
                    style={{ width: '60px', height: '32px' }}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Priority</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={200}
                    value={formPriority}
                    onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
                    disabled={submitting}
                  />
                  <Form.Text className="text-muted">Higher = more important</Form.Text>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label className="fw-semibold small">Role Type</Form.Label>
                  <Form.Select
                    value={formIsStaffRole ? 'staff' : 'client'}
                    onChange={(e) => setFormIsStaffRole(e.target.value === 'staff')}
                    disabled={submitting}
                  >
                    <option value="staff">Staff</option>
                    <option value="client">Client</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            {/* Permissions */}
            <div className="mb-3">
              <Form.Label className="fw-semibold small d-flex align-items-center gap-2">
                <i className="bi bi-key" style={{ color: '#054653' }}></i>
                Permissions
                <Badge bg="light" text="dark" style={{ fontSize: '0.7rem' }}>
                  {formPermissions.length}/{ALL_PERMISSIONS.length} selected
                </Badge>
              </Form.Label>

              <div className="border rounded-3 p-3" style={{ backgroundColor: '#fafbfc', maxHeight: '300px', overflowY: 'auto' }}>
                {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => {
                  const allChecked = perms.every((p) => formPermissions.includes(p));
                  const someChecked = perms.some((p) => formPermissions.includes(p));
                  return (
                    <div key={category} className="mb-3">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <Form.Check
                          type="checkbox"
                          id={`cat-${category}`}
                          label={<strong style={{ color: '#334155', fontSize: '0.85rem' }}>{category}</strong>}
                          checked={allChecked}
                          ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                          onChange={() => toggleCategoryAll(category)}
                          disabled={submitting}
                        />
                      </div>
                      <div className="d-flex flex-wrap gap-2 ms-4">
                        {perms.map((perm) => (
                          <Form.Check
                            key={perm}
                            type="checkbox"
                            id={`perm-${perm}`}
                            label={
                              <code style={{ fontSize: '0.75rem', color: formPermissions.includes(perm) ? '#054653' : '#94a3b8' }}>
                                {perm}
                              </code>
                            }
                            checked={formPermissions.includes(perm)}
                            onChange={() => togglePermission(perm)}
                            disabled={submitting}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className="border-top-0">
            <Button variant="light" onClick={closeModal} disabled={submitting} className="px-4 border">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !formName.trim() || !formSlug.trim()}
              style={{ backgroundColor: '#054653', border: 'none', fontWeight: '600', padding: '0.5rem 1.5rem' }}
            >
              {submitting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  {editingRole ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                editingRole ? 'Update Role' : 'Create Role'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}

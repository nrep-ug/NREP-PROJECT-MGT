'use client';

import { useState } from 'react';
import { Button, Modal, Form, Card, Badge, Row, Col, InputGroup } from 'react-bootstrap';
import { useProjectComponents } from '@/hooks/useProjects';

export default function ProjectComponents({ project, user, showToast, canModify, teamMembers = [] }) {
    const { data: components = [], isLoading: loading, refetch } = useProjectComponents(project?.$id);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingComponent, setEditingComponent] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        leaderId: '',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const response = await fetch('/api/components', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.$id,
                    organizationId: project.organizationId,
                    projectTeamId: project.projectTeamId,
                    ...formData,
                }),
            });

            if (!response.ok) throw new Error('Failed to create component');

            showToast('Component created successfully!', 'success');
            setShowAddModal(false);
            setFormData({ name: '', description: '', leaderId: '' });
            refetch();
        } catch (err) {
            showToast(err.message || 'Failed to create component', 'danger');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (component) => {
        setEditingComponent(component);
        setFormData({
            name: component.name,
            description: component.description || '',
            leaderId: component.leaderId || '',
        });
        setShowEditModal(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const response = await fetch(`/api/components/${editingComponent.$id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) throw new Error('Failed to update component');

            showToast('Component updated successfully!', 'success');
            setShowEditModal(false);
            setEditingComponent(null);
            setFormData({ name: '', description: '', leaderId: '' });
            refetch();
        } catch (err) {
            showToast(err.message || 'Failed to update component', 'danger');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (componentId) => {
        if (!confirm('Are you sure you want to delete this component?')) return;

        try {
            const response = await fetch(`/api/components/${componentId}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete component');

            showToast('Component deleted successfully!', 'success');
            refetch();
        } catch (err) {
            showToast(err.message || 'Failed to delete component', 'danger');
        }
    };

    // Filter components
    const filteredComponents = components.filter(component =>
        component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (component.description && component.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) {
        return <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
    }

    return (
        <div>
            {/* Header with Actions */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
                <div className="d-flex align-items-center gap-2">
                    <h5 className="mb-0">Project Components</h5>
                    <Badge bg="secondary">{filteredComponents.length}</Badge>
                </div>

                <div className="d-flex flex-column flex-md-row gap-2 w-100 w-md-auto">
                    {/* Search */}
                    <InputGroup style={{ maxWidth: '300px' }}>
                        <InputGroup.Text style={{
                            backgroundColor: 'white',
                            borderColor: '#e2e8f0'
                        }}>
                            <i className="bi bi-search" style={{ color: '#64748b' }}></i>
                        </InputGroup.Text>
                        <Form.Control
                            type="text"
                            placeholder="Search components..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                borderColor: '#e2e8f0',
                                boxShadow: 'none'
                            }}
                        />
                    </InputGroup>

                    {/* Add Component Button */}
                    {canModify && (
                        <Button
                            variant=""
                            size="sm"
                            onClick={() => setShowAddModal(true)}
                            style={{
                                backgroundColor: '#054653',
                                color: 'white',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#043840';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#054653';
                            }}
                        >
                            <i className="bi bi-plus-circle me-2"></i>
                            Add Component
                        </Button>
                    )}
                </div>
            </div>

            {/* Components List */}
            {filteredComponents.length === 0 ? (
                <div className="text-center py-5">
                    <div className="mb-3">
                        <i className="bi bi-boxes" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
                    </div>
                    <h5>{searchTerm ? 'No components found' : 'No Components Yet'}</h5>
                    <p className="text-muted mb-3">
                        {searchTerm
                            ? 'Try adjusting your search criteria'
                            : 'Add your first component to get started'}
                    </p>
                    {!searchTerm && canModify && (
                        <Button
                            variant=""
                            onClick={() => setShowAddModal(true)}
                            style={{
                                backgroundColor: '#054653',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                fontSize: '0.95rem',
                                fontWeight: '600'
                            }}
                        >
                            <i className="bi bi-plus-circle me-2"></i>
                            Add Your First Component
                        </Button>
                    )}
                </div>
            ) : (
                <Row className="g-3">
                    {filteredComponents.map(component => (
                        <Col key={component.$id} md={6} lg={4}>
                            <Card
                                className="border-0 shadow-sm h-100"
                                style={{
                                    borderRadius: '12px',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '';
                                }}
                            >
                                <Card.Body className="p-4">
                                    {/* Component Icon and Title */}
                                    <div className="d-flex align-items-start gap-3 mb-3">
                                        <div
                                            className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                                            style={{
                                                width: '56px',
                                                height: '56px',
                                                backgroundColor: '#f8fafc'
                                            }}
                                        >
                                            <i
                                                className="bi bi-box-seam"
                                                style={{
                                                    fontSize: '2rem',
                                                    color: '#8b5cf6'
                                                }}
                                            ></i>
                                        </div>

                                        <div className="flex-grow-1 overflow-hidden">
                                            <h6 className="mb-1 fw-bold text-truncate" style={{ color: '#1e293b' }}>
                                                {component.name}
                                            </h6>
                                            {component.leaderId && (
                                                <Badge
                                                    bg="info"
                                                    style={{
                                                        fontSize: '0.65rem',
                                                        fontWeight: '600',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px'
                                                    }}
                                                >
                                                    <i className="bi bi-person-badge" style={{ fontSize: '0.65rem' }}></i> Has Leader
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {component.description && (
                                        <div className="mb-3">
                                            <small className="text-muted d-block mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                                                Description
                                            </small>
                                            <small className="d-block" style={{ color: '#64748b' }}>
                                                {component.description}
                                            </small>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    {canModify && (
                                        <div className="d-flex gap-2 mt-3 pt-3 border-top">
                                            <Button
                                                variant=""
                                                size="sm"
                                                className="flex-grow-1"
                                                onClick={() => handleEdit(component)}
                                                style={{
                                                    backgroundColor: 'white',
                                                    border: '2px solid #cbd5e1',
                                                    color: '#64748b',
                                                    padding: '0.5rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '500',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = '#054653';
                                                    e.currentTarget.style.color = '#054653';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                                    e.currentTarget.style.color = '#64748b';
                                                }}
                                            >
                                                <i className="bi bi-pencil"></i>
                                            </Button>
                                            <Button
                                                variant=""
                                                size="sm"
                                                className="flex-grow-1"
                                                onClick={() => handleDelete(component.$id)}
                                                style={{
                                                    backgroundColor: 'white',
                                                    border: '2px solid #cbd5e1',
                                                    color: '#dc3545',
                                                    padding: '0.5rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '500',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = '#dc3545';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                                }}
                                            >
                                                <i className="bi bi-trash"></i>
                                            </Button>
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}

            {/* Add Component Modal */}
            <Modal show={showAddModal} onHide={() => !submitting && setShowAddModal(false)} size="lg">
                <Modal.Header closeButton style={{ borderBottom: '2px solid #e9ecef' }}>
                    <Modal.Title>
                        <i className="bi bi-plus-circle me-2" style={{ color: '#054653' }}></i>
                        Add Component
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit}>
                    <Modal.Body className="p-4">
                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-semibold">Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Backend API"
                                required
                                disabled={submitting}
                                style={{
                                    borderColor: '#e2e8f0',
                                    padding: '0.75rem',
                                    borderRadius: '8px'
                                }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-semibold">Description</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                placeholder="Component description..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                disabled={submitting}
                                style={{
                                    borderColor: '#e2e8f0',
                                    padding: '0.75rem',
                                    borderRadius: '8px'
                                }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-semibold">Component Leader</Form.Label>
                            <Form.Select
                                value={formData.leaderId}
                                onChange={(e) => setFormData({ ...formData, leaderId: e.target.value })}
                                disabled={submitting}
                                style={{
                                    borderColor: '#e2e8f0',
                                    padding: '0.75rem',
                                    borderRadius: '8px'
                                }}
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
                    </Modal.Body>
                    <Modal.Footer style={{ borderTop: '2px solid #e9ecef' }}>
                        <Button
                            variant=""
                            onClick={() => setShowAddModal(false)}
                            disabled={submitting}
                            style={{
                                backgroundColor: 'white',
                                border: '2px solid #cbd5e1',
                                color: '#64748b',
                                padding: '0.5rem 1.5rem',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: '500'
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant=""
                            type="submit"
                            disabled={submitting}
                            style={{
                                backgroundColor: '#054653',
                                color: 'white',
                                border: 'none',
                                padding: '0.5rem 1.5rem',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: '600'
                            }}
                        >
                            {submitting ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Creating...
                                </>
                            ) : (
                                'Create Component'
                            )}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* Edit Component Modal */}
            <Modal show={showEditModal} onHide={() => !submitting && setShowEditModal(false)} size="lg">
                <Modal.Header closeButton style={{ borderBottom: '2px solid #e9ecef' }}>
                    <Modal.Title>
                        <i className="bi bi-pencil me-2" style={{ color: '#054653' }}></i>
                        Edit Component
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleUpdate}>
                    <Modal.Body className="p-4">
                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-semibold">Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Backend API"
                                required
                                disabled={submitting}
                                style={{
                                    borderColor: '#e2e8f0',
                                    padding: '0.75rem',
                                    borderRadius: '8px'
                                }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-semibold">Description</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                placeholder="Component description..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                disabled={submitting}
                                style={{
                                    borderColor: '#e2e8f0',
                                    padding: '0.75rem',
                                    borderRadius: '8px'
                                }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-semibold">Component Leader</Form.Label>
                            <Form.Select
                                value={formData.leaderId}
                                onChange={(e) => setFormData({ ...formData, leaderId: e.target.value })}
                                disabled={submitting}
                                style={{
                                    borderColor: '#e2e8f0',
                                    padding: '0.75rem',
                                    borderRadius: '8px'
                                }}
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
                    </Modal.Body>
                    <Modal.Footer style={{ borderTop: '2px solid #e9ecef' }}>
                        <Button
                            variant=""
                            onClick={() => setShowEditModal(false)}
                            disabled={submitting}
                            style={{
                                backgroundColor: 'white',
                                border: '2px solid #cbd5e1',
                                color: '#64748b',
                                padding: '0.5rem 1.5rem',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: '500'
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant=""
                            type="submit"
                            disabled={submitting}
                            style={{
                                backgroundColor: '#054653',
                                color: 'white',
                                border: 'none',
                                padding: '0.5rem 1.5rem',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                fontWeight: '600'
                            }}
                        >
                            {submitting ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Updating...
                                </>
                            ) : (
                                'Update Component'
                            )}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </div>
    );
}

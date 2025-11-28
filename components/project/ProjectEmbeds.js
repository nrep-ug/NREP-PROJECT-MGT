'use client';

import { useState, useEffect } from 'react';
import { Button, Modal, Form, Card, Badge, Table, Row, Col, InputGroup } from 'react-bootstrap';
import { useProjectEmbeds } from '@/hooks/useProjects';

export default function ProjectEmbeds({ project, user, showToast, canModify }) {
  const { data: embeds = [], isLoading: loading, refetch } = useProjectEmbeds(project?.$id);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewEmbed, setPreviewEmbed] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    provider: '',
    url: '',
    width: 1000,
    height: 650,
    allowFullscreen: true,
    isClientVisible: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/embeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.$id,
          organizationId: project.organizationId,
          projectTeamId: project.projectTeamId,
          ...formData,
          createdBy: user.$id,
        }),
      });

      if (!response.ok) throw new Error('Failed to create embed');

      showToast('Embed created successfully!', 'success');
      setShowAddModal(false);
      setFormData({ title: '', provider: '', url: '', width: 1000, height: 650, allowFullscreen: true, isClientVisible: false });
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to create embed', 'danger');
    }
  };

  const handlePreview = (embed) => {
    setPreviewEmbed(embed);
    setShowPreviewModal(true);
  };

  const handleOpenInNewTab = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getProviderIcon = (provider) => {
    const lowerProvider = provider?.toLowerCase() || '';
    if (lowerProvider.includes('figma')) return 'bi-palette';
    if (lowerProvider.includes('google')) return 'bi-google';
    if (lowerProvider.includes('youtube')) return 'bi-youtube';
    if (lowerProvider.includes('miro')) return 'bi-kanban';
    return 'bi-box';
  };

  const getProviderColor = (provider) => {
    const lowerProvider = provider?.toLowerCase() || '';
    if (lowerProvider.includes('figma')) return '#a855f7';
    if (lowerProvider.includes('google')) return '#054653';
    if (lowerProvider.includes('youtube')) return '#dc3545';
    if (lowerProvider.includes('miro')) return '#f59e0b';
    return '#64748b';
  };

  // Filter embeds
  const filteredEmbeds = embeds.filter(embed =>
    embed.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (embed.provider && embed.provider.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }

  return (
    <div>
      {/* Header with Actions */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div className="d-flex align-items-center gap-2">
          <h5 className="mb-0">Embeds</h5>
          <Badge bg="secondary">{filteredEmbeds.length}</Badge>
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
              placeholder="Search embeds..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                borderColor: '#e2e8f0',
                boxShadow: 'none'
              }}
            />
          </InputGroup>

          {/* Add Embed Button */}
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
              Add Embed
            </Button>
          )}
        </div>
      </div>

      {/* Embeds List */}
      {filteredEmbeds.length === 0 ? (
        <div className="text-center py-5">
          <div className="mb-3">
            <i className="bi bi-code-square" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
          </div>
          <h5>{searchTerm ? 'No embeds found' : 'No Embeds Yet'}</h5>
          <p className="text-muted mb-3">
            {searchTerm
              ? 'Try adjusting your search criteria'
              : 'Add your first embed to get started'}
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
              Add Your First Embed
            </Button>
          )}
        </div>
      ) : (
        <Row className="g-3">
          {filteredEmbeds.map(embed => (
            <Col key={embed.$id} md={6} lg={4}>
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
                  {/* Embed Icon and Title */}
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
                        className={getProviderIcon(embed.provider)}
                        style={{
                          fontSize: '2rem',
                          color: getProviderColor(embed.provider)
                        }}
                      ></i>
                    </div>

                    <div className="flex-grow-1 overflow-hidden">
                      <h6 className="mb-1 fw-bold text-truncate" style={{ color: '#1e293b' }}>
                        {embed.title}
                      </h6>
                      <div className="d-flex flex-wrap gap-1">
                        {embed.provider && (
                          <Badge
                            bg="info"
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: '600',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px'
                            }}
                          >
                            {embed.provider}
                          </Badge>
                        )}
                        <Badge
                          bg={embed.isClientVisible ? 'success' : 'secondary'}
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: '600',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px'
                          }}
                        >
                          {embed.isClientVisible ? (
                            <><i className="bi bi-eye" style={{ fontSize: '0.65rem' }}></i> Client Visible</>
                          ) : (
                            <><i className="bi bi-eye-slash" style={{ fontSize: '0.65rem' }}></i> Staff Only</>
                          )}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* URL */}
                  <div className="mb-3">
                    <small className="text-muted d-block mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                      URL
                    </small>
                    <small className="text-truncate d-block" style={{ color: '#64748b' }}>
                      {embed.url}
                    </small>
                  </div>

                  {/* Dimensions */}
                  <div className="mb-3">
                    <small className="text-muted d-block mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
                      Dimensions
                    </small>
                    <small style={{ color: '#64748b' }}>
                      {embed.width} × {embed.height}px
                    </small>
                  </div>

                  {/* Action Buttons */}
                  <div className="d-flex gap-2 mt-3 pt-3 border-top">
                    <Button
                      variant=""
                      size="sm"
                      className="flex-grow-1"
                      onClick={() => handlePreview(embed)}
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
                      <i className="bi bi-eye"></i>
                    </Button>
                    <Button
                      variant=""
                      size="sm"
                      className="flex-grow-1"
                      onClick={() => handleOpenInNewTab(embed.url)}
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
                        e.currentTarget.style.borderColor = '#14B8A6';
                        e.currentTarget.style.color = '#14B8A6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.color = '#64748b';
                      }}
                    >
                      <i className="bi bi-box-arrow-up-right"></i>
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Add Embed Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="lg">
        <Modal.Header closeButton style={{ borderBottom: '2px solid #e9ecef' }}>
          <Modal.Title>
            <i className="bi bi-plus-circle me-2" style={{ color: '#054653' }}></i>
            Add Embed
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body className="p-4">
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">Title <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Project Mockups"
                required
                style={{
                  borderColor: '#e2e8f0',
                  padding: '0.75rem',
                  borderRadius: '8px'
                }}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">Provider</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g., Google Slides, Figma, Miro"
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                style={{
                  borderColor: '#e2e8f0',
                  padding: '0.75rem',
                  borderRadius: '8px'
                }}
              />
              <Form.Text className="text-muted small">
                Optional: Name of the service (Google Slides, Figma, etc.)
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold">URL (HTTPS) <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="url"
                placeholder="https://..."
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                required
                style={{
                  borderColor: '#e2e8f0',
                  padding: '0.75rem',
                  borderRadius: '8px'
                }}
              />
              <Form.Text className="text-muted small">
                The embed URL (must start with HTTPS)
              </Form.Text>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold">Width (px)</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.width}
                    onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value) || 1000 })}
                    style={{
                      borderColor: '#e2e8f0',
                      padding: '0.75rem',
                      borderRadius: '8px'
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold">Height (px)</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) || 650 })}
                    style={{
                      borderColor: '#e2e8f0',
                      padding: '0.75rem',
                      borderRadius: '8px'
                    }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Allow fullscreen"
                checked={formData.allowFullscreen}
                onChange={(e) => setFormData({ ...formData, allowFullscreen: e.target.checked })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Visible to clients"
                checked={formData.isClientVisible}
                onChange={(e) => setFormData({ ...formData, isClientVisible: e.target.checked })}
              />
              <Form.Text className="text-muted small">
                Enable this to make the embed visible in the client portal
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer style={{ borderTop: '2px solid #e9ecef' }}>
            <Button
              variant=""
              onClick={() => setShowAddModal(false)}
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
              Create Embed
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Preview Modal */}
      <Modal
        show={showPreviewModal}
        onHide={() => setShowPreviewModal(false)}
        size="xl"
        fullscreen="lg-down"
      >
        <Modal.Header closeButton style={{ borderBottom: '2px solid #e9ecef' }}>
          <Modal.Title>
            {previewEmbed?.title}
            {previewEmbed?.provider && (
              <Badge bg="info" className="ms-2">{previewEmbed.provider}</Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0" style={{ minHeight: '70vh' }}>
          {previewEmbed && (
            <div
              className="embed-preview-container"
              style={{
                position: 'relative',
                width: '100%',
                height: '70vh',
                minHeight: '500px'
              }}
            >
              <iframe
                src={previewEmbed.url}
                title={previewEmbed.title}
                allowFullScreen={previewEmbed.allowFullscreen}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 0
                }}
              />
            </div>
          )}
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '2px solid #e9ecef' }}>
          <Button
            variant=""
            onClick={() => previewEmbed && handleOpenInNewTab(previewEmbed.url)}
            style={{
              backgroundColor: 'white',
              border: '2px solid #cbd5e1',
              color: '#64748b',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            <i className="bi bi-box-arrow-up-right me-2"></i>
            Open in New Tab
          </Button>
          <Button
            variant=""
            onClick={() => setShowPreviewModal(false)}
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
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

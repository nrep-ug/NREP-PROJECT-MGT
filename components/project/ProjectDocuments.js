'use client';

import { useState, useEffect } from 'react';
import { Button, Table, Badge, Form, Card, Row, Col, InputGroup } from 'react-bootstrap';
import { useProjectDocuments } from '@/hooks/useProjects';
import { databases, storage, Query, COLLECTIONS, DB_ID, BUCKET_DOCS, ID } from '@/lib/appwriteClient';
import { formatDateTime } from '@/lib/date';

export default function ProjectDocuments({ project, user, showToast, canModify }) {
  const { data: documents = [], isLoading: loading, refetch } = useProjectDocuments(project?.$id);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Upload to Storage
      const uploadedFile = await storage.createFile(BUCKET_DOCS, ID.unique(), file);

      // 2. Register document via API
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.$id,
          organizationId: project.organizationId,
          projectTeamId: project.projectTeamId,
          uploaderId: user.$id,
          title: file.name,
          category: 'other',
          fileId: uploadedFile.$id,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });

      if (!response.ok) throw new Error('Failed to register document');

      showToast('Document uploaded successfully!', 'success');
      refetch(); // Refresh list
    } catch (err) {
      showToast(err.message || 'Failed to upload document', 'danger');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = async (doc) => {
    try {
      // Get latest version
      const versions = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.DOCUMENT_VERSIONS,
        [Query.equal('documentId', doc.$id), Query.orderDesc('versionNo'), Query.limit(1)]
      );

      if (versions.documents.length > 0) {
        const latestVersion = versions.documents[0];
        const fileUrl = storage.getFileView(BUCKET_DOCS, latestVersion.fileId);
        window.open(fileUrl.href, '_blank');
      }
    } catch (err) {
      showToast('Failed to download document', 'danger');
    }
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const iconMap = {
      pdf: 'bi-file-earmark-pdf',
      doc: 'bi-file-earmark-word',
      docx: 'bi-file-earmark-word',
      xls: 'bi-file-earmark-excel',
      xlsx: 'bi-file-earmark-excel',
      ppt: 'bi-file-earmark-ppt',
      pptx: 'bi-file-earmark-ppt',
      jpg: 'bi-file-earmark-image',
      jpeg: 'bi-file-earmark-image',
      png: 'bi-file-earmark-image',
      gif: 'bi-file-earmark-image',
      zip: 'bi-file-earmark-zip',
      rar: 'bi-file-earmark-zip',
      txt: 'bi-file-earmark-text',
    };
    return iconMap[extension] || 'bi-file-earmark';
  };

  const getFileIconColor = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const colorMap = {
      pdf: '#dc3545',
      doc: '#054653',
      docx: '#054653',
      xls: '#198754',
      xlsx: '#198754',
      ppt: '#f59e0b',
      pptx: '#f59e0b',
      jpg: '#a855f7',
      jpeg: '#a855f7',
      png: '#a855f7',
      gif: '#a855f7',
      zip: '#6c757d',
      rar: '#6c757d',
    };
    return colorMap[extension] || '#64748b';
  };

  const getCategoryColor = (category) => {
    const colors = {
      spec: 'primary',
      design: 'info',
      contract: 'warning',
      report: 'success',
      other: 'secondary',
    };
    return colors[category] || 'secondary';
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }

  return (
    <div>
      {/* Header with Upload and Search */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div className="d-flex align-items-center gap-2">
          <h5 className="mb-0">Documents</h5>
          <Badge bg="secondary">{filteredDocuments.length}</Badge>
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
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                borderColor: '#e2e8f0',
                boxShadow: 'none'
              }}
            />
          </InputGroup>

          {/* Upload Button */}
          {canModify && (
            <label style={{ cursor: 'pointer', marginBottom: 0 }}>
              <input
                type="file"
                onChange={handleUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              <Button
                variant=""
                size="sm"
                as="span"
                disabled={uploading}
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
                  if (!uploading) {
                    e.currentTarget.style.backgroundColor = '#043840';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#054653';
                }}
              >
                <i className="bi bi-cloud-upload me-2"></i>
                {uploading ? 'Uploading...' : 'Upload Document'}
              </Button>
            </label>
          )}
        </div>
      </div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-5">
          <div className="mb-3">
            <i className="bi bi-file-earmark-text" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
          </div>
          <h5>{searchTerm ? 'No documents found' : 'No Documents Yet'}</h5>
          <p className="text-muted mb-3">
            {searchTerm
              ? 'Try adjusting your search criteria'
              : 'Upload your first document to get started'}
          </p>
        </div>
      ) : (
        <Row className="g-3">
          {filteredDocuments.map(doc => (
            <Col key={doc.$id} md={6} lg={4}>
              <Card
                className="border-0 shadow-sm h-100"
                style={{
                  borderRadius: '12px',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '';
                }}
                onClick={() => handleDownload(doc)}
              >
                <Card.Body className="p-4">
                  {/* File Icon */}
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
                        className={getFileIcon(doc.title)}
                        style={{
                          fontSize: '2rem',
                          color: getFileIconColor(doc.title)
                        }}
                      ></i>
                    </div>

                    <div className="flex-grow-1 overflow-hidden">
                      <h6 className="mb-1 fw-bold text-truncate" style={{ color: '#1e293b' }}>
                        {doc.title}
                      </h6>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <Badge
                          bg={getCategoryColor(doc.category)}
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: '600',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px'
                          }}
                        >
                          {doc.category}
                        </Badge>
                        <Badge
                          bg="light"
                          text="dark"
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: '600',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px'
                          }}
                        >
                          v{doc.currentVersion}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Document Info */}
                  <div className="pt-3 border-top">
                    <small className="text-muted d-flex align-items-center gap-2">
                      <i className="bi bi-clock" style={{ fontSize: '0.875rem' }}></i>
                      {formatDateTime(doc.$createdAt)}
                    </small>
                  </div>

                  {/* Action Button */}
                  <div className="mt-3">
                    <Button
                      variant=""
                      size="sm"
                      className="w-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(doc);
                      }}
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
                      <i className="bi bi-eye me-2"></i>
                      View Document
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}

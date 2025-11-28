'use client';

import { useState, useEffect } from 'react';
import { Card, Row, Col, Breadcrumb, InputGroup, Form, Badge, Button } from 'react-bootstrap';
import { databases, storage, Query, COLLECTIONS, DB_ID, BUCKET_DOCS } from '@/lib/appwriteClient';
import { formatDateTime } from '@/lib/date';

export default function ProjectDocumentsClient({ project, user }) {
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  useEffect(() => {
    if (project?.$id && user?.authUser?.$id) {
      loadFolders();
      loadDocuments();
    }
  }, [project, currentFolder, user]);

  const loadFolders = async () => {
    try {
      const response = await fetch(`/api/documents/folders?projectId=${project.$id}&requesterId=${user.authUser.$id}&isClient=true`);
      const data = await response.json();

      if (response.ok) {
        setFolders(data.folders || []);
      } else {
        console.error('Failed to load folders:', data.error);
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const parentFolderId = currentFolder?.$id || 'null';
      const response = await fetch(
        `/api/documents?projectId=${project.$id}&parentFolderId=${parentFolderId}&requesterId=${user.authUser.$id}&isClient=true`
      );
      const data = await response.json();

      if (response.ok) {
        setDocuments(data.documents || []);
      } else {
        console.error('Failed to load documents:', data.error);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get folder path for breadcrumb
  const getFolderPath = () => {
    if (!currentFolder) return [];
    const path = [];
    let folder = currentFolder;

    while (folder) {
      path.unshift(folder);
      if (folder.parentFolderId) {
        folder = folders.find(f => f.$id === folder.parentFolderId);
      } else {
        folder = null;
      }
    }
    return path;
  };

  // Get subfolders of current folder
  const getSubfolders = () => {
    return folders.filter(f => f.parentFolderId === currentFolder?.$id);
  };

  // Filter documents by search
  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // File type icons and colors
  const getFileIcon = (mimeType) => {
    if (!mimeType) return 'bi-file-earmark';
    if (mimeType.includes('pdf')) return 'bi-file-earmark-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'bi-file-earmark-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'bi-file-earmark-excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'bi-file-earmark-ppt';
    if (mimeType.includes('image')) return 'bi-file-earmark-image';
    if (mimeType.includes('video')) return 'bi-file-earmark-play';
    if (mimeType.includes('audio')) return 'bi-file-earmark-music';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'bi-file-earmark-zip';
    return 'bi-file-earmark';
  };

  const getFileColor = (mimeType) => {
    if (!mimeType) return '#6c757d';
    if (mimeType.includes('pdf')) return '#dc3545';
    if (mimeType.includes('word') || mimeType.includes('document')) return '#2b579a';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '#217346';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '#d24726';
    if (mimeType.includes('image')) return '#7952b3';
    if (mimeType.includes('video')) return '#0dcaf0';
    if (mimeType.includes('audio')) return '#fd7e14';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '#ffc107';
    return '#6c757d';
  };

  const handleViewDocument = async (doc) => {
    try {
      // Get the latest version from the versions collection
      const versionsResponse = await databases.listDocuments(
        DB_ID,
        'pms_document_versions',
        [
          Query.equal('documentId', doc.$id),
          Query.orderDesc('versionNo'),
          Query.limit(1)
        ]
      );

      if (versionsResponse.documents.length === 0) {
        console.error('No versions found for document');
        return;
      }

      const latestVersion = versionsResponse.documents[0];
      const fileUrl = storage.getFileView(BUCKET_DOCS, latestVersion.fileId);
      window.open(fileUrl.href, '_blank');
    } catch (error) {
      console.error('Failed to open document:', error);
    }
  };

  const folderPath = getFolderPath();
  const subfolders = getSubfolders();

  return (
    <div>
      {/* Header Controls */}
      <div className="mb-4">
        <Row className="align-items-center">
          <Col md={8}>
            {/* Breadcrumb */}
            <Breadcrumb>
              <Breadcrumb.Item
                active={!currentFolder}
                onClick={() => !currentFolder ? null : setCurrentFolder(null)}
                style={{ cursor: currentFolder ? 'pointer' : 'default' }}
              >
                <i className="bi bi-house-door me-1"></i>
                Root
              </Breadcrumb.Item>
              {folderPath.map((folder, index) => (
                <Breadcrumb.Item
                  key={folder.$id}
                  active={index === folderPath.length - 1}
                  onClick={() => index === folderPath.length - 1 ? null : setCurrentFolder(folder)}
                  style={{ cursor: index === folderPath.length - 1 ? 'default' : 'pointer' }}
                >
                  <i className="bi bi-folder me-1"></i>
                  {folder.name}
                </Breadcrumb.Item>
              ))}
            </Breadcrumb>
          </Col>
          <Col md={4}>
            {/* Search */}
            <InputGroup>
              <InputGroup.Text>
                <i className="bi bi-search"></i>
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
          </Col>
        </Row>

        {/* View Mode Toggle */}
        <div className="d-flex justify-content-end mt-2">
          <div className="btn-group" role="group">
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setViewMode('grid')}
            >
              <i className="bi bi-grid-3x3-gap"></i>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setViewMode('list')}
            >
              <i className="bi bi-list-ul"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">Loading documents...</p>
        </div>
      ) : (
        <>
          {/* Empty State */}
          {subfolders.length === 0 && filteredDocuments.length === 0 && (
            <div className="text-center py-5">
              <i className="bi bi-folder-x" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
              <h5 className="mt-3 text-muted">No documents available</h5>
              <p className="text-muted">This folder is empty or no documents are visible to you.</p>
            </div>
          )}

          {/* Grid View */}
          {viewMode === 'grid' && (subfolders.length > 0 || filteredDocuments.length > 0) && (
            <Row className="g-3">
              {/* Folders */}
              {subfolders.map(folder => (
                <Col key={folder.$id} xs={6} md={4} lg={3}>
                  <Card
                    className="h-100 shadow-sm border-0"
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      borderRadius: '12px'
                    }}
                    onClick={() => setCurrentFolder(folder)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    }}
                  >
                    <Card.Body className="text-center p-4">
                      <i
                        className="bi bi-folder-fill"
                        style={{ fontSize: '3rem', color: '#ffc107' }}
                      ></i>
                      <h6 className="mt-3 mb-0 text-truncate">{folder.name}</h6>
                    </Card.Body>
                  </Card>
                </Col>
              ))}

              {/* Documents */}
              {filteredDocuments.map(doc => (
                <Col key={doc.$id} xs={6} md={4} lg={3}>
                  <Card
                    className="h-100 shadow-sm border-0"
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      borderRadius: '12px'
                    }}
                    onClick={() => handleViewDocument(doc)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    }}
                  >
                    <Card.Body className="text-center p-4">
                      <i
                        className={`bi ${getFileIcon(doc.mimeType)}`}
                        style={{ fontSize: '3rem', color: getFileColor(doc.mimeType) }}
                      ></i>
                      <h6 className="mt-3 mb-2 text-truncate" title={doc.title}>
                        {doc.title}
                      </h6>
                      <div className="d-flex justify-content-center gap-2 flex-wrap">
                        {doc.category && (
                          <Badge bg="secondary" style={{ fontSize: '0.7rem' }}>
                            {doc.category}
                          </Badge>
                        )}
                        {doc.currentVersion && (
                          <Badge bg="info" style={{ fontSize: '0.7rem' }}>
                            v{doc.currentVersion}
                          </Badge>
                        )}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          {/* List View */}
          {viewMode === 'list' && (subfolders.length > 0 || filteredDocuments.length > 0) && (
            <div className="list-group">
              {/* Folders */}
              {subfolders.map(folder => (
                <div
                  key={folder.$id}
                  className="list-group-item list-group-item-action d-flex align-items-center gap-3"
                  style={{ cursor: 'pointer', borderRadius: '8px' }}
                  onClick={() => setCurrentFolder(folder)}
                >
                  <i
                    className="bi bi-folder-fill"
                    style={{ fontSize: '1.5rem', color: '#ffc107' }}
                  ></i>
                  <div className="flex-grow-1">
                    <h6 className="mb-0">{folder.name}</h6>
                    <small className="text-muted">Folder</small>
                  </div>
                  <i className="bi bi-chevron-right text-muted"></i>
                </div>
              ))}

              {/* Documents */}
              {filteredDocuments.map(doc => (
                <div
                  key={doc.$id}
                  className="list-group-item list-group-item-action d-flex align-items-center gap-3"
                  style={{ cursor: 'pointer', borderRadius: '8px' }}
                  onClick={() => handleViewDocument(doc)}
                >
                  <i
                    className={`bi ${getFileIcon(doc.mimeType)}`}
                    style={{ fontSize: '1.5rem', color: getFileColor(doc.mimeType) }}
                  ></i>
                  <div className="flex-grow-1">
                    <h6 className="mb-1">{doc.title}</h6>
                    <div className="d-flex align-items-center gap-2">
                      {doc.category && (
                        <Badge bg="secondary" style={{ fontSize: '0.7rem' }}>
                          {doc.category}
                        </Badge>
                      )}
                      {doc.currentVersion && (
                        <Badge bg="info" style={{ fontSize: '0.7rem' }}>
                          v{doc.currentVersion}
                        </Badge>
                      )}
                      <small className="text-muted">
                        {formatDateTime(doc.$createdAt)}
                      </small>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDocument(doc);
                    }}
                  >
                    <i className="bi bi-eye me-1"></i>
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

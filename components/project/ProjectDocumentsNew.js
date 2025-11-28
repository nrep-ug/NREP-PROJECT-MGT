'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Row, Col, Dropdown, Modal, Form, Badge, Breadcrumb, InputGroup, Spinner } from 'react-bootstrap';
import { databases, storage, Query, COLLECTIONS, DB_ID, BUCKET_DOCS, ID } from '@/lib/appwriteClient';
import { formatDateTime } from '@/lib/date';

export default function ProjectDocumentsNew({ project, user, showToast }) {
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Selected items for actions
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);

  // Upload form
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploadFolderId, setUploadFolderId] = useState(null);
  const [uploadIsClientVisible, setUploadIsClientVisible] = useState(false);
  const [uploadIsStaffVisible, setUploadIsStaffVisible] = useState(true);
  const [uploadStaffList, setUploadStaffList] = useState([]);
  const [uploadClientList, setUploadClientList] = useState([]);

  // Folder form
  const [folderName, setFolderName] = useState('');
  const [folderIsClientVisible, setFolderIsClientVisible] = useState(false);
  const [folderIsStaffVisible, setFolderIsStaffVisible] = useState(true);
  const [folderStaffList, setFolderStaffList] = useState([]);
  const [folderClientList, setFolderClientList] = useState([]);

  // Rename form
  const [renameValue, setRenameValue] = useState('');

  // Permissions form
  const [permIsClientVisible, setPermIsClientVisible] = useState(false);
  const [permIsStaffVisible, setPermIsStaffVisible] = useState(true);
  const [permStaffList, setPermStaffList] = useState([]);
  const [permClientList, setPermClientList] = useState([]);

  // Replace file
  const [replaceFile, setReplaceFile] = useState(null);

  // Staff and client lists for selection
  const [staffMembers, setStaffMembers] = useState([]);
  const [clients, setClients] = useState([]);

  // Check if user can manage documents (admin or project manager)
  const canManage = user?.isAdmin || (
    project?.projectTeamId && user?.teams?.some(
      team => team.teamId === project.projectTeamId && team.roles.includes('manager')
    )
  );

  useEffect(() => {
    if (project?.$id) {
      loadFolders();
      loadDocuments();
      loadStaffAndClients();
    }
  }, [project, currentFolder]);

  const loadStaffAndClients = async () => {
    try {
      // Load staff members from project team
      const teamResponse = await fetch(`/api/projects/${project.$id}/members`);
      if (teamResponse.ok) {
        const teamData = await teamResponse.json();
        setStaffMembers(teamData.members || []);
      }

      // Load clients from organization
      if (project.clientId) {
        const clientsResponse = await databases.listDocuments(
          DB_ID,
          COLLECTIONS.USERS,
          [
            Query.equal('organizationId', project.clientId),
            Query.equal('role', 'client'),
            Query.limit(100)
          ]
        );
        setClients(clientsResponse.documents || []);
      }
    } catch (err) {
      console.error('Failed to load staff/clients:', err);
    }
  };

  const loadFolders = async () => {
    try {
      const response = await fetch(`/api/documents/folders?projectId=${project.$id}&requesterId=${user.authUser.$id}&isClient=false`);
      const data = await response.json();

      if (response.ok) {
        setFolders(data.folders || []);
      } else {
        showToast('Failed to load folders', 'danger');
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
      showToast('Failed to load folders', 'danger');
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const parentFolderId = currentFolder?.$id || 'null';
      const response = await fetch(
        `/api/documents?projectId=${project.$id}&parentFolderId=${parentFolderId}&requesterId=${user.authUser.$id}&isClient=false`
      );
      const data = await response.json();

      if (response.ok) {
        setDocuments(data.documents || []);
      } else {
        showToast('Failed to load documents', 'danger');
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
      showToast('Failed to load documents', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!uploadFile || !uploadTitle.trim()) {
      showToast('Please select a file and provide a title', 'warning');
      return;
    }

    setUploading(true);
    try {
      // 1. Upload to Storage
      const uploadedFile = await storage.createFile(BUCKET_DOCS, ID.unique(), uploadFile);

      // 2. Register document via API
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.$id,
          organizationId: project.organizationId,
          projectTeamId: project.projectTeamId,
          uploaderId: user.authUser.$id,
          title: uploadTitle,
          category: uploadCategory,
          fileId: uploadedFile.$id,
          mimeType: uploadFile.type,
          sizeBytes: uploadFile.size,
          parentFolderId: uploadFolderId || currentFolder?.$id,
          isClientVisible: uploadIsClientVisible,
          isStaffVisible: uploadIsStaffVisible,
          staffList: uploadStaffList,
          clientList: uploadClientList
        }),
      });

      if (!response.ok) throw new Error('Failed to register document');

      showToast('Document uploaded successfully!', 'success');
      resetUploadForm();
      setShowUploadModal(false);
      loadDocuments();
    } catch (err) {
      showToast(err.message || 'Failed to upload document', 'danger');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      showToast('Please provide a folder name', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/documents/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.$id,
          name: folderName,
          parentFolderId: currentFolder?.$id,
          createdBy: user.authUser.$id,
          isClientVisible: folderIsClientVisible,
          isStaffVisible: folderIsStaffVisible,
          staffList: folderStaffList,
          clientList: folderClientList
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to create folder');

      showToast('Folder created successfully!', 'success');
      setFolderName('');
      setFolderIsClientVisible(false);
      setFolderIsStaffVisible(true);
      setFolderStaffList([]);
      setFolderClientList([]);
      setShowCreateFolderModal(false);
      loadFolders();
    } catch (err) {
      showToast(err.message || 'Failed to create folder', 'danger');
    }
  };

  const handleRenameDocument = async () => {
    if (!renameValue.trim()) {
      showToast('Please provide a name', 'warning');
      return;
    }

    try {
      const response = await fetch(`/api/documents/${selectedDoc.$id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: user.authUser.$id,
          title: renameValue
        }),
      });

      if (!response.ok) throw new Error('Failed to rename document');

      showToast('Document renamed successfully!', 'success');
      setShowRenameModal(false);
      loadDocuments();
    } catch (err) {
      showToast(err.message || 'Failed to rename document', 'danger');
    }
  };

  const handleRenameFolder = async () => {
    if (!renameValue.trim()) {
      showToast('Please provide a name', 'warning');
      return;
    }

    try {
      const response = await fetch(`/api/documents/folders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolder.$id,
          requesterId: user.authUser.$id,
          name: renameValue
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to rename folder');

      showToast('Folder renamed successfully!', 'success');
      setShowRenameModal(false);
      loadFolders();
    } catch (err) {
      showToast(err.message || 'Failed to rename folder', 'danger');
    }
  };

  const handleUpdatePermissions = async () => {
    try {
      const endpoint = selectedDoc ? `/api/documents/${selectedDoc.$id}` : `/api/documents/folders`;
      const method = 'PATCH';
      const body = selectedDoc ? {
        requesterId: user.authUser.$id,
        isClientVisible: permIsClientVisible,
        isStaffVisible: permIsStaffVisible,
        staffList: permStaffList,
        clientList: permClientList
      } : {
        folderId: selectedFolder.$id,
        requesterId: user.authUser.$id,
        isClientVisible: permIsClientVisible,
        isStaffVisible: permIsStaffVisible,
        staffList: permStaffList,
        clientList: permClientList
      };

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to update permissions');

      showToast('Permissions updated successfully!', 'success');
      setShowPermissionsModal(false);
      if (selectedDoc) {
        loadDocuments();
      } else {
        loadFolders();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update permissions', 'danger');
    }
  };

  const handleReplaceDocument = async () => {
    if (!replaceFile) {
      showToast('Please select a file', 'warning');
      return;
    }

    setUploading(true);
    try {
      // 1. Upload new file to Storage
      const uploadedFile = await storage.createFile(BUCKET_DOCS, ID.unique(), replaceFile);

      // 2. Create new version via API
      const response = await fetch(`/api/documents/${selectedDoc.$id}/version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: user.authUser.$id,
          fileId: uploadedFile.$id,
          mimeType: replaceFile.type,
          sizeBytes: replaceFile.size
        }),
      });

      if (!response.ok) throw new Error('Failed to upload new version');

      showToast('Document replaced with new version!', 'success');
      setReplaceFile(null);
      setShowReplaceModal(false);
      loadDocuments();
    } catch (err) {
      showToast(err.message || 'Failed to replace document', 'danger');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async () => {
    try {
      const response = await fetch(
        `/api/documents/${selectedDoc.$id}?requesterId=${user.authUser.$id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete document');

      showToast('Document deleted successfully!', 'success');
      setShowDeleteModal(false);
      loadDocuments();
    } catch (err) {
      showToast(err.message || 'Failed to delete document', 'danger');
    }
  };

  const handleDeleteFolder = async () => {
    try {
      const response = await fetch(
        `/api/documents/folders?folderId=${selectedFolder.$id}&requesterId=${user.authUser.$id}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to delete folder');

      showToast('Folder deleted successfully!', 'success');
      setShowDeleteModal(false);
      loadFolders();
    } catch (err) {
      showToast(err.message || 'Failed to delete folder', 'danger');
    }
  };

  const handleDownloadDocument = async (doc) => {
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

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadCategory('other');
    setUploadFolderId(null);
    setUploadIsClientVisible(false);
    setUploadIsStaffVisible(true);
    setUploadStaffList([]);
    setUploadClientList([]);
  };

  const openUploadModal = () => {
    resetUploadForm();
    setShowUploadModal(true);
  };

  const openCreateFolderModal = () => {
    setFolderName('');
    setFolderIsClientVisible(false);
    setFolderIsStaffVisible(true);
    setFolderStaffList([]);
    setFolderClientList([]);
    setShowCreateFolderModal(true);
  };

  const openRenameDocModal = (doc) => {
    setSelectedDoc(doc);
    setRenameValue(doc.title);
    setSelectedFolder(null);
    setShowRenameModal(true);
  };

  const openRenameFolderModal = (folder) => {
    setSelectedFolder(folder);
    setRenameValue(folder.name);
    setSelectedDoc(null);
    setShowRenameModal(true);
  };

  const openPermissionsModal = (item) => {
    // Check if it's a document or folder
    if (item.title) {
      // It's a document
      setSelectedDoc(item);
      setSelectedFolder(null);
    } else {
      // It's a folder
      setSelectedFolder(item);
      setSelectedDoc(null);
    }
    setPermIsClientVisible(item.isClientVisible || false);
    setPermIsStaffVisible(item.isStaffVisible !== undefined ? item.isStaffVisible : true);
    setPermStaffList(item.staffList || []);
    setPermClientList(item.clientList || []);
    setShowPermissionsModal(true);
  };

  const openReplaceModal = (doc) => {
    setSelectedDoc(doc);
    setReplaceFile(null);
    setShowReplaceModal(true);
  };

  const openDeleteDocModal = (doc) => {
    setSelectedDoc(doc);
    setSelectedFolder(null);
    setShowDeleteModal(true);
  };

  const openDeleteFolderModal = (folder) => {
    setSelectedFolder(folder);
    setSelectedDoc(null);
    setShowDeleteModal(true);
  };

  const canManageItem = (item) => {
    if (user?.isAdmin) return true;
    if (canManage) return true;
    if (item.uploaderId === user.authUser.$id) return true;
    if (item.createdBy === user.authUser.$id) return true;
    return false;
  };

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

  const getSubfolders = () => {
    return folders.filter(f => f.parentFolderId === (currentFolder?.$id || null));
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      contract: 'danger',
      spec: 'primary',
      design: 'info',
      report: 'success',
      invoice: 'warning',
      other: 'secondary',
    };
    return colors[category] || 'secondary';
  };

  return (
    <div>
      {/* Header with Actions */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h5 className="mb-1">Documents & Files</h5>
          <p className="text-muted small mb-0">
            Manage project documents organized in folders
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <Button
            variant=""
            size="sm"
            onClick={openCreateFolderModal}
            style={{
              backgroundColor: 'white',
              border: '2px solid #054653',
              color: '#054653',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}
          >
            <i className="bi bi-folder-plus me-2"></i>
            New Folder
          </Button>

          <Button
            variant=""
            size="sm"
            onClick={openUploadModal}
            disabled={uploading}
            style={{
              backgroundColor: '#054653',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}
          >
            {uploading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Uploading...
              </>
            ) : (
              <>
                <i className="bi bi-cloud-upload me-2"></i>
                Upload Document
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      {currentFolder && (
        <div className="mb-3">
          <Breadcrumb>
            <Breadcrumb.Item onClick={() => setCurrentFolder(null)} style={{ cursor: 'pointer' }}>
              <i className="bi bi-house-door me-1"></i>
              Root
            </Breadcrumb.Item>
            {getFolderPath().map((folder, idx) => (
              <Breadcrumb.Item
                key={folder.$id}
                active={idx === getFolderPath().length - 1}
                onClick={() => idx < getFolderPath().length - 1 && setCurrentFolder(folder)}
                style={{ cursor: idx < getFolderPath().length - 1 ? 'pointer' : 'default' }}
              >
                {folder.name}
              </Breadcrumb.Item>
            ))}
          </Breadcrumb>
        </div>
      )}

      {/* Search and View Toggle */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-2 mb-3">
        <InputGroup style={{ maxWidth: '350px' }}>
          <InputGroup.Text style={{ backgroundColor: 'white', borderColor: '#e2e8f0' }}>
            <i className="bi bi-search" style={{ color: '#64748b' }}></i>
          </InputGroup.Text>
          <Form.Control
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ borderColor: '#e2e8f0', boxShadow: 'none' }}
          />
        </InputGroup>

        <div className="btn-group" role="group">
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'outline-secondary'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <i className="bi bi-grid-3x3-gap"></i>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'outline-secondary'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <i className="bi bi-list-ul"></i>
          </Button>
        </div>
      </div>

      {/* Folders */}
      {getSubfolders().length > 0 && (
        <div className="mb-4">
          <h6 className="mb-3 text-muted">
            <i className="bi bi-folder2 me-2"></i>
            Folders
          </h6>
          <Row className="g-3">
            {getSubfolders().map(folder => (
              <Col key={folder.$id} xs={6} md={4} lg={3}>
                <Card
                  className="border-0 shadow-sm"
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
                >
                  <Card.Body className="p-3">
                    <div className="d-flex justify-content-between align-items-start">
                      <div
                        className="flex-grow-1"
                        onClick={() => setCurrentFolder(folder)}
                        style={{ cursor: 'pointer' }}
                      >
                        <i
                          className="bi bi-folder-fill"
                          style={{ fontSize: '2rem', color: '#f59e0b' }}
                        ></i>
                        <h6 className="mt-2 mb-0 text-truncate" style={{ fontSize: '0.875rem' }}>
                          {folder.name}
                        </h6>
                      </div>

                      {canManageItem(folder) && (
                        <Dropdown align="end">
                          <Dropdown.Toggle
                            variant="link"
                            size="sm"
                            className="text-secondary p-0"
                            style={{ border: 'none', boxShadow: 'none' }}
                          >
                            <i className="bi bi-three-dots-vertical"></i>
                          </Dropdown.Toggle>

                          <Dropdown.Menu>
                            <Dropdown.Item onClick={() => openRenameFolderModal(folder)}>
                              <i className="bi bi-pencil me-2"></i>
                              Rename
                            </Dropdown.Item>
                            <Dropdown.Item onClick={() => openPermissionsModal(folder)}>
                              <i className="bi bi-shield-lock me-2"></i>
                              Permissions
                            </Dropdown.Item>
                            <Dropdown.Divider />
                            <Dropdown.Item
                              onClick={() => openDeleteFolderModal(folder)}
                              className="text-danger"
                            >
                              <i className="bi bi-trash me-2"></i>
                              Delete
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* Documents */}
      <div>
        <h6 className="mb-3 text-muted">
          <i className="bi bi-file-earmark-text me-2"></i>
          Documents {filteredDocuments.length > 0 && `(${filteredDocuments.length})`}
        </h6>

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
          </div>
        ) : filteredDocuments.length === 0 ? (
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
            {!searchTerm && (
              <Button variant="primary" size="sm" onClick={openUploadModal}>
                <i className="bi bi-cloud-upload me-2"></i>
                Upload Document
              </Button>
            )}
          </div>
        ) : (
          <Row className="g-3">
            {filteredDocuments.map(doc => (
              <Col key={doc.$id} xs={12} md={viewMode === 'grid' ? 6 : 12} lg={viewMode === 'grid' ? 4 : 12}>
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
                  <Card.Body className="p-3">
                    <div className="d-flex align-items-start gap-3">
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
                        <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
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
                          {doc.isClientVisible && (
                            <Badge bg="info" style={{ fontSize: '0.65rem' }}>
                              <i className="bi bi-eye me-1"></i>
                              Client
                            </Badge>
                          )}
                        </div>
                        <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                          <i className="bi bi-clock me-1"></i>
                          {formatDateTime(doc.$createdAt)}
                        </small>
                      </div>

                      <Dropdown align="end">
                        <Dropdown.Toggle
                          variant="link"
                          size="sm"
                          className="text-secondary p-0"
                          style={{ border: 'none', boxShadow: 'none' }}
                        >
                          <i className="bi bi-three-dots-vertical"></i>
                        </Dropdown.Toggle>

                        <Dropdown.Menu>
                          <Dropdown.Item onClick={() => handleDownloadDocument(doc)}>
                            <i className="bi bi-download me-2"></i>
                            Download
                          </Dropdown.Item>
                          {canManageItem(doc) && (
                            <>
                              <Dropdown.Divider />
                              <Dropdown.Item onClick={() => openRenameDocModal(doc)}>
                                <i className="bi bi-pencil me-2"></i>
                                Rename
                              </Dropdown.Item>
                              <Dropdown.Item onClick={() => openReplaceModal(doc)}>
                                <i className="bi bi-arrow-repeat me-2"></i>
                                Replace
                              </Dropdown.Item>
                              <Dropdown.Item onClick={() => openPermissionsModal(doc)}>
                                <i className="bi bi-shield-lock me-2"></i>
                                Permissions
                              </Dropdown.Item>
                              <Dropdown.Divider />
                              <Dropdown.Item
                                onClick={() => openDeleteDocModal(doc)}
                                className="text-danger"
                              >
                                <i className="bi bi-trash me-2"></i>
                                Delete
                              </Dropdown.Item>
                            </>
                          )}
                        </Dropdown.Menu>
                      </Dropdown>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>

      {/* Upload Document Modal */}
      <Modal show={showUploadModal} onHide={() => !uploading && setShowUploadModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Upload Document</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>File *</Form.Label>
              <Form.Control
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setUploadFile(file);
                  if (file && !uploadTitle) {
                    setUploadTitle(file.name);
                  }
                }}
                disabled={uploading}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Document Title *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter document title..."
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                disabled={uploading}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Category</Form.Label>
              <Form.Select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                disabled={uploading}
              >
                <option value="other">Other</option>
                <option value="contract">Contract</option>
                <option value="spec">Specification</option>
                <option value="design">Design</option>
                <option value="report">Report</option>
                <option value="invoice">Invoice</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Folder</Form.Label>
              <Form.Select
                value={uploadFolderId || ''}
                onChange={(e) => setUploadFolderId(e.target.value || null)}
                disabled={uploading}
              >
                <option value="">
                  {currentFolder ? `Current Folder (${currentFolder.name})` : 'Root (No Folder)'}
                </option>
                {folders.map(folder => (
                  <option key={folder.$id} value={folder.$id}>
                    {folder.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <div className="border rounded p-3 mb-3" style={{ backgroundColor: '#f8fafc' }}>
              <h6 className="mb-3">Visibility Settings</h6>

              <Form.Check
                type="checkbox"
                id="upload-staff-visible"
                label="Visible to staff"
                checked={uploadIsStaffVisible}
                onChange={(e) => setUploadIsStaffVisible(e.target.checked)}
                disabled={uploading}
                className="mb-3"
              />

              {uploadIsStaffVisible && (
                <div className="ms-4 mb-3">
                  <Form.Label className="small text-muted">
                    Select specific staff (leave empty for all staff)
                  </Form.Label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                    {staffMembers.length === 0 ? (
                      <small className="text-muted">No staff members found</small>
                    ) : (
                      staffMembers.map(member => (
                        <Form.Check
                          key={member.accountId}
                          type="checkbox"
                          id={`upload-staff-${member.accountId}`}
                          label={`${member.firstName} ${member.lastName}`}
                          checked={uploadStaffList.includes(member.accountId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUploadStaffList([...uploadStaffList, member.accountId]);
                            } else {
                              setUploadStaffList(uploadStaffList.filter(id => id !== member.accountId));
                            }
                          }}
                          disabled={uploading}
                          className="mb-1"
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              <Form.Check
                type="checkbox"
                id="upload-client-visible"
                label="Visible to clients"
                checked={uploadIsClientVisible}
                onChange={(e) => setUploadIsClientVisible(e.target.checked)}
                disabled={uploading}
                className="mb-3"
              />

              {uploadIsClientVisible && (
                <div className="ms-4">
                  <Form.Label className="small text-muted">
                    Select specific clients (leave empty for all clients)
                  </Form.Label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                    {clients.length === 0 ? (
                      <small className="text-muted">No clients found</small>
                    ) : (
                      clients.map(client => (
                        <Form.Check
                          key={client.accountId}
                          type="checkbox"
                          id={`upload-client-${client.accountId}`}
                          label={`${client.firstName} ${client.lastName}`}
                          checked={uploadClientList.includes(client.accountId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUploadClientList([...uploadClientList, client.accountId]);
                            } else {
                              setUploadClientList(uploadClientList.filter(id => id !== client.accountId));
                            }
                          }}
                          disabled={uploading}
                          className="mb-1"
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowUploadModal(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUploadDocument} disabled={uploading || !uploadFile || !uploadTitle.trim()}>
            {uploading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Uploading...
              </>
            ) : (
              <>
                <i className="bi bi-cloud-upload me-2"></i>
                Upload
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Create Folder Modal */}
      <Modal show={showCreateFolderModal} onHide={() => setShowCreateFolderModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Create Folder</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Folder Name *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter folder name..."
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                autoFocus
              />
              {currentFolder && (
                <Form.Text className="text-muted">
                  This folder will be created inside "{currentFolder.name}"
                </Form.Text>
              )}
            </Form.Group>

            <div className="border rounded p-3 mb-3" style={{ backgroundColor: '#f8fafc' }}>
              <h6 className="mb-3">Visibility Settings</h6>

              <Form.Check
                type="checkbox"
                id="folder-staff-visible"
                label="Visible to staff"
                checked={folderIsStaffVisible}
                onChange={(e) => setFolderIsStaffVisible(e.target.checked)}
                className="mb-3"
              />

              {folderIsStaffVisible && (
                <div className="ms-4 mb-3">
                  <Form.Label className="small text-muted">
                    Select specific staff (leave empty for all staff)
                  </Form.Label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                    {staffMembers.length === 0 ? (
                      <small className="text-muted">No staff members found</small>
                    ) : (
                      staffMembers.map(member => (
                        <Form.Check
                          key={member.accountId}
                          type="checkbox"
                          id={`folder-staff-${member.accountId}`}
                          label={`${member.firstName} ${member.lastName}`}
                          checked={folderStaffList.includes(member.accountId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFolderStaffList([...folderStaffList, member.accountId]);
                            } else {
                              setFolderStaffList(folderStaffList.filter(id => id !== member.accountId));
                            }
                          }}
                          className="mb-1"
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              <Form.Check
                type="checkbox"
                id="folder-client-visible"
                label="Visible to clients"
                checked={folderIsClientVisible}
                onChange={(e) => setFolderIsClientVisible(e.target.checked)}
                className="mb-3"
              />

              {folderIsClientVisible && (
                <div className="ms-4">
                  <Form.Label className="small text-muted">
                    Select specific clients (leave empty for all clients)
                  </Form.Label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                    {clients.length === 0 ? (
                      <small className="text-muted">No clients found</small>
                    ) : (
                      clients.map(client => (
                        <Form.Check
                          key={client.accountId}
                          type="checkbox"
                          id={`folder-client-${client.accountId}`}
                          label={`${client.firstName} ${client.lastName}`}
                          checked={folderClientList.includes(client.accountId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFolderClientList([...folderClientList, client.accountId]);
                            } else {
                              setFolderClientList(folderClientList.filter(id => id !== client.accountId));
                            }
                          }}
                          className="mb-1"
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateFolderModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateFolder} disabled={!folderName.trim()}>
            <i className="bi bi-folder-plus me-2"></i>
            Create
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Rename Modal (for both documents and folders) */}
      <Modal show={showRenameModal} onHide={() => setShowRenameModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Rename {selectedDoc ? 'Document' : 'Folder'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>New Name *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter new name..."
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRenameModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={selectedDoc ? handleRenameDocument : handleRenameFolder}
            disabled={!renameValue.trim()}
          >
            <i className="bi bi-pencil me-2"></i>
            Rename
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Permissions Modal */}
      <Modal show={showPermissionsModal} onHide={() => setShowPermissionsModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{selectedDoc ? 'Document' : 'Folder'} Permissions</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">
            Control who can view this {selectedDoc ? 'document' : 'folder'}
          </p>
          <Form>
            <div className="border rounded p-3" style={{ backgroundColor: '#f8fafc' }}>
              <Form.Check
                type="checkbox"
                id="perm-staff-visible"
                label="Visible to staff"
                checked={permIsStaffVisible}
                onChange={(e) => setPermIsStaffVisible(e.target.checked)}
                className="mb-3"
              />

              {permIsStaffVisible && (
                <div className="ms-4 mb-3">
                  <Form.Label className="small text-muted">
                    Select specific staff (leave empty for all staff)
                  </Form.Label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                    {staffMembers.length === 0 ? (
                      <small className="text-muted">No staff members found</small>
                    ) : (
                      staffMembers.map(member => (
                        <Form.Check
                          key={member.accountId}
                          type="checkbox"
                          id={`perm-staff-${member.accountId}`}
                          label={`${member.firstName} ${member.lastName}`}
                          checked={permStaffList.includes(member.accountId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPermStaffList([...permStaffList, member.accountId]);
                            } else {
                              setPermStaffList(permStaffList.filter(id => id !== member.accountId));
                            }
                          }}
                          className="mb-1"
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              <Form.Check
                type="checkbox"
                id="perm-client-visible"
                label="Visible to clients"
                checked={permIsClientVisible}
                onChange={(e) => setPermIsClientVisible(e.target.checked)}
                className="mb-3"
              />

              {permIsClientVisible && (
                <div className="ms-4">
                  <Form.Label className="small text-muted">
                    Select specific clients (leave empty for all clients)
                  </Form.Label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                    {clients.length === 0 ? (
                      <small className="text-muted">No clients found</small>
                    ) : (
                      clients.map(client => (
                        <Form.Check
                          key={client.accountId}
                          type="checkbox"
                          id={`perm-client-${client.accountId}`}
                          label={`${client.firstName} ${client.lastName}`}
                          checked={permClientList.includes(client.accountId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPermClientList([...permClientList, client.accountId]);
                            } else {
                              setPermClientList(permClientList.filter(id => id !== client.accountId));
                            }
                          }}
                          className="mb-1"
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPermissionsModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdatePermissions}>
            <i className="bi bi-shield-lock me-2"></i>
            Update Permissions
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Replace Document Modal */}
      <Modal show={showReplaceModal} onHide={() => !uploading && setShowReplaceModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Replace Document</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">
            Upload a new version of "{selectedDoc?.title}". The old version will be kept in version history.
          </p>
          <Form>
            <Form.Group>
              <Form.Label>Select New File *</Form.Label>
              <Form.Control
                type="file"
                onChange={(e) => setReplaceFile(e.target.files?.[0])}
                disabled={uploading}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReplaceModal(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleReplaceDocument} disabled={uploading || !replaceFile}>
            {uploading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Uploading...
              </>
            ) : (
              <>
                <i className="bi bi-arrow-repeat me-2"></i>
                Replace
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal (for both documents and folders) */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="text-danger">
            Delete {selectedDoc ? 'Document' : 'Folder'}?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedDoc ? (
            <>
              <p>
                Are you sure you want to delete <strong>"{selectedDoc?.title}"</strong>?
              </p>
              <div className="alert alert-warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                This will permanently delete the document and all its versions. This action cannot be undone.
              </div>
            </>
          ) : (
            <>
              <p>
                Are you sure you want to delete the folder <strong>"{selectedFolder?.name}"</strong>?
              </p>
              <div className="alert alert-warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                The folder must be empty (no documents or subfolders) to be deleted.
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={selectedDoc ? handleDeleteDocument : handleDeleteFolder}
          >
            <i className="bi bi-trash me-2"></i>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

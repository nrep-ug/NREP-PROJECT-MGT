'use client';

import { useState, useEffect } from 'react';
import { Card, Form, Button, Row, Col, Alert, InputGroup, Badge, Modal, Container } from 'react-bootstrap';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import AppLayout from '@/components/AppLayout';
import Toast, { useToast } from '@/components/Toast';

export default function NewUserPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    otherNames: '',
    role: 'staff',
    userType: 'staff', // staff or client
    title: '',
    department: '',
    clientOrganizationIds: [],
    projectIds: [],
    sendEmail: true,
    isSupervisor: false,
    isFinance: false,
    supervisorId: ''
  });

  const [clientOrganizations, setClientOrganizations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [createdUser, setCreatedUser] = useState(null);
  const [showInstructionModal, setShowInstructionModal] = useState(true);

  // Load client organizations, projects, and supervisors on mount
  useEffect(() => {
    if (user?.isAdmin) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      // Parallel data fetching
      const [orgsRes, projectsRes, supervisorsRes] = await Promise.all([
        fetch(`/api/admin/organizations?requesterId=${user.authUser.$id}&type=client`),
        fetch(`/api/projects?organizationId=${user.organizationId}`),
        databases.listDocuments(
          DB_ID,
          COLLECTIONS.USERS,
          [
            Query.equal('isSupervisor', true),
            Query.orderAsc('firstName')
          ]
        )
      ]);

      if (orgsRes.ok) {
        const data = await orgsRes.json();
        setClientOrganizations(data.organizations || []);
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data.projects || []);
      }

      setSupervisors(supervisorsRes.documents || []);

    } catch (error) {
      console.error('Failed to load form data:', error);
      showToast('Failed to load some form data', 'warning');
    } finally {
      setLoadingData(false);
    }
  };

  // Check if user is admin
  if (!authLoading && user && !user.isAdmin) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">
          <Alert.Heading>Access Denied</Alert.Heading>
          <p>Only administrators can create user accounts.</p>
        </Alert>
      </AppLayout>
    );
  }

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

    setSubmitting(true);
    setCreatedUser(null);

    try {
      // Convert role to array matching Appwrite labels
      let roleArray = [];
      if (formData.userType === 'staff') {
        if (formData.role === 'admin') {
          roleArray = ['staff', 'admin'];
        } else {
          roleArray = ['staff'];
        }
      } else {
        roleArray = ['client'];
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          role: roleArray, // Send as array
          organizationId: user.organizationId,
          requesterId: user.authUser?.$id || user.accountId || user.id
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
        userType: 'staff',
        title: '',
        department: '',
        clientOrganizationIds: [],
        projectIds: [],
        sendEmail: true,
        isSupervisor: false,
        isFinance: false,
        supervisorId: ''
      });
      setValidationErrors({});

    } catch (error) {
      showToast(error.message, 'danger');
    } finally {
      setSubmitting(false);
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

  // Toggle selection for multi-select
  const toggleArrayItem = (array, item) => {
    if (array.includes(item)) {
      return array.filter(i => i !== item);
    } else {
      return [...array, item];
    }
  };

  if (authLoading) {
    return (
      <AppLayout user={user}>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  const isStaff = formData.userType === 'staff';
  const primaryColor = isStaff ? 'primary' : 'secondary'; // Using secondary (teal) for clients
  const primaryColorHex = isStaff ? '#054653' : '#14B8A6';

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* User Type Selection Modal */}
      <Modal
        show={showInstructionModal}
        onHide={() => setShowInstructionModal(false)}
        backdrop="static"
        centered
        size="lg"
        className="user-type-modal"
      >
        <Modal.Header className="border-0 pb-0">
          <Modal.Title className="w-100 text-center mt-3">
            <h3 className="fw-bold mb-1">Select User Type</h3>
            <p className="text-muted fw-normal fs-6">Choose the type of account to create</p>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-5 pt-3">
          <Row className="g-4">
            <Col md={6}>
              <div
                className={`p-4 border rounded-4 h-100 cursor-pointer transition-all text-center position-relative overflow-hidden ${formData.userType === 'staff'
                  ? 'border-primary shadow-sm ring-2 ring-primary ring-opacity-50'
                  : 'border-light-subtle hover-shadow-md'
                  }`}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backgroundColor: formData.userType === 'staff' ? '#eff6ff' : 'white'
                }}
                onClick={() => {
                  setFormData({
                    ...formData,
                    userType: 'staff',
                    role: 'staff',
                    clientOrganizationIds: [],
                    projectIds: []
                  });
                  setShowInstructionModal(false);
                }}
              >
                <div className={`rounded-circle d-inline-flex align-items-center justify-content-center mb-4 shadow-sm ${formData.userType === 'staff' ? 'bg-primary text-white' : 'bg-light text-primary'
                  }`} style={{ width: '80px', height: '80px' }}>
                  <i className="bi bi-briefcase-fill fs-1"></i>
                </div>
                <h4 className="fw-bold mb-3 text-dark">Staff Member</h4>
                <p className="text-muted small mb-4">
                  Internal team members who work on projects, track time, and manage tasks.
                </p>
                <ul className="list-unstyled text-start small text-muted mx-auto" style={{ maxWidth: '220px' }}>
                  <li className="mb-2"><i className="bi bi-check-circle-fill text-primary me-2"></i>Internal Access</li>
                  <li className="mb-2"><i className="bi bi-check-circle-fill text-primary me-2"></i>Timesheets & Tasks</li>
                  <li className="mb-2"><i className="bi bi-check-circle-fill text-primary me-2"></i>Team Collaboration</li>
                </ul>
                {formData.userType === 'staff' && (
                  <div className="position-absolute top-0 end-0 mt-3 me-3">
                    <Badge bg="primary" className="rounded-pill px-3 py-2">Selected</Badge>
                  </div>
                )}
              </div>
            </Col>

            <Col md={6}>
              <div
                className={`p-4 border rounded-4 h-100 cursor-pointer transition-all text-center position-relative overflow-hidden ${formData.userType === 'client'
                  ? 'border-secondary shadow-sm ring-2 ring-secondary ring-opacity-50'
                  : 'border-light-subtle hover-shadow-md'
                  }`}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backgroundColor: formData.userType === 'client' ? '#f0fdfa' : 'white'
                }}
                onClick={() => {
                  setFormData({
                    ...formData,
                    userType: 'client',
                    role: 'client',
                    department: ''
                  });
                  setShowInstructionModal(false);
                }}
              >
                <div className={`rounded-circle d-inline-flex align-items-center justify-content-center mb-4 shadow-sm ${formData.userType === 'client' ? 'bg-secondary text-white' : 'bg-light text-secondary'
                  }`} style={{ width: '80px', height: '80px' }}>
                  <i className="bi bi-person-badge-fill fs-1"></i>
                </div>
                <h4 className="fw-bold mb-3 text-dark">Client User</h4>
                <p className="text-muted small mb-4">
                  External stakeholders who need to view project progress and approve items.
                </p>
                <ul className="list-unstyled text-start small text-muted mx-auto" style={{ maxWidth: '220px' }}>
                  <li className="mb-2"><i className="bi bi-check-circle-fill text-secondary me-2"></i>External Access</li>
                  <li className="mb-2"><i className="bi bi-check-circle-fill text-secondary me-2"></i>View Progress</li>
                  <li className="mb-2"><i className="bi bi-check-circle-fill text-secondary me-2"></i>Limited Scope</li>
                </ul>
                {formData.userType === 'client' && (
                  <div className="position-absolute top-0 end-0 mt-3 me-3">
                    <Badge bg="secondary" className="rounded-pill px-3 py-2">Selected</Badge>
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="border-0 justify-content-center pb-4">
          <Button variant="link" className="text-muted text-decoration-none" onClick={() => router.push('/admin')}>
            Cancel and return to Admin Panel
          </Button>
        </Modal.Footer>
      </Modal>

      <Container fluid="md" className="py-4">
        {/* Header */}
        <div className="mb-4">
          <Button
            variant="link"
            onClick={() => router.push('/admin')}
            className="p-0 mb-3 text-decoration-none"
            style={{ color: '#054653', fontWeight: '500' }}
          >
            <i className="bi bi-arrow-left me-2"></i>
            Back to Admin Dashboard
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
                    <i className="bi bi-person-plus-fill" style={{ fontSize: '1.75rem' }}></i>
                  </div>
                  <div>
                    <h2 className="mb-1 fw-bold">Create New User</h2>
                    <p className="mb-0 opacity-90">Add a new staff member or client to your system</p>
                  </div>
                </div>
                <div className="opacity-15" style={{ fontSize: '5rem', marginTop: '-1rem', marginRight: '-1rem' }}>
                  <i className="bi bi-people-fill"></i>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>

        {createdUser && createdUser.temporaryPassword ? (
          <Card className="border-0 shadow-sm rounded-4 overflow-hidden mb-4">
            <div
              className="p-4 position-relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #198754 0%, #146c43 100%)' }}
            >
              <div className="position-absolute top-0 end-0 me-n3 mt-n3" style={{ opacity: '0.15' }}>
                <i className="bi bi-check-circle-fill" style={{ fontSize: '8rem' }}></i>
              </div>
              <div className="d-flex align-items-center position-relative">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center me-3"
                  style={{
                    width: '56px',
                    height: '56px',
                    background: 'rgba(255, 255, 255, 0.25)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <i className="bi bi-check-lg text-white" style={{ fontSize: '2rem' }}></i>
                </div>
                <div>
                  <h3 className="fw-bold text-white mb-1">User Created Successfully!</h3>
                  <p className="text-white mb-0" style={{ opacity: '0.9' }}>The account is ready to use.</p>
                </div>
              </div>
            </div>
            <Card.Body className="p-4">
              <Row className="g-4">
                <Col md={6}>
                  <div className="d-flex align-items-center mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-2"
                      style={{
                        width: '32px',
                        height: '32px',
                        background: 'linear-gradient(135deg, #054653 0%, #1d4ed8 100%)',
                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                      }}
                    >
                      <i className="bi bi-person-check-fill text-white" style={{ fontSize: '0.9rem' }}></i>
                    </div>
                    <h6 className="text-uppercase small fw-bold mb-0" style={{ color: '#054653', letterSpacing: '0.5px' }}>
                      Account Details
                    </h6>
                  </div>
                  <div
                    className="p-4 rounded-3"
                    style={{
                      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                      border: '2px solid #bfdbfe'
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                      <span className="small fw-medium" style={{ color: '#64748b' }}>Name:</span>
                      <span className="fw-semibold" style={{ color: '#1e293b' }}>{createdUser.user.name}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                      <span className="small fw-medium" style={{ color: '#64748b' }}>Email:</span>
                      <span className="fw-semibold" style={{ color: '#1e293b' }}>{createdUser.user.email}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                      <span className="small fw-medium" style={{ color: '#64748b' }}>Username:</span>
                      <span className="fw-semibold" style={{ color: '#054653' }}>@{createdUser.user.username}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="small fw-medium" style={{ color: '#64748b' }}>Role:</span>
                      <Badge
                        className="px-3 py-2"
                        style={{
                          background: createdUser.user.role === 'admin'
                            ? 'linear-gradient(135deg, #dc3545 0%, #bb2d3b 100%)'
                            : 'linear-gradient(135deg, #054653 0%, #1d4ed8 100%)',
                          border: 'none',
                          fontWeight: '600',
                          fontSize: '0.85rem',
                          textTransform: 'capitalize'
                        }}
                      >
                        <i className={`bi ${createdUser.user.role === 'admin' ? 'bi-shield-fill-check' : 'bi-person-fill'} me-1`}></i>
                        {createdUser.user.role}
                      </Badge>
                    </div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="d-flex align-items-center mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-2"
                      style={{
                        width: '32px',
                        height: '32px',
                        background: 'linear-gradient(135deg, #dc3545 0%, #bb2d3b 100%)',
                        boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)'
                      }}
                    >
                      <i className="bi bi-exclamation-triangle-fill text-white" style={{ fontSize: '0.9rem' }}></i>
                    </div>
                    <h6 className="text-uppercase small fw-bold mb-0" style={{ color: '#dc3545', letterSpacing: '0.5px' }}>
                      Action Required
                    </h6>
                  </div>
                  <div
                    className="p-4 rounded-3 position-relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%)',
                      border: '2px solid #fecaca'
                    }}
                  >
                    <div className="position-absolute top-0 end-0 me-n2 mt-n2" style={{ opacity: '0.1' }}>
                      <i className="bi bi-shield-lock-fill" style={{ fontSize: '4rem', color: '#dc3545' }}></i>
                    </div>
                    <p className="small mb-2 fw-semibold position-relative" style={{ color: '#dc3545' }}>
                      Temporary Password:
                    </p>
                    <InputGroup className="mb-3 position-relative">
                      <Form.Control
                        type="text"
                        value={createdUser.temporaryPassword}
                        readOnly
                        className="font-monospace bg-white fw-bold border-0 shadow-sm"
                        style={{
                          color: '#dc3545',
                          fontSize: '1.1rem',
                          padding: '0.75rem',
                          borderRadius: '8px 0 0 8px',
                          letterSpacing: '1px'
                        }}
                      />
                      <Button
                        className="border-0 shadow-sm px-4"
                        style={{
                          background: 'linear-gradient(135deg, #dc3545 0%, #bb2d3b 100%)',
                          color: 'white',
                          borderRadius: '0 8px 8px 0',
                          fontWeight: '500'
                        }}
                        onClick={() => copyToClipboard(createdUser.temporaryPassword)}
                      >
                        <i className="bi bi-clipboard me-2"></i>
                        Copy
                      </Button>
                    </InputGroup>
                    <div className="d-flex align-items-start position-relative">
                      <i className="bi bi-info-circle-fill me-2 mt-1" style={{ color: '#dc3545', fontSize: '0.9rem' }}></i>
                      <small style={{ color: '#dc3545', lineHeight: '1.5' }}>
                        <strong>Important:</strong> Copy this password now. It will not be shown again.
                      </small>
                    </div>
                  </div>
                </Col>
              </Row>
              <div className="d-flex justify-content-end gap-3 mt-4">
                <Button
                  variant="outline-secondary"
                  onClick={() => router.push('/admin')}
                  className="px-4 py-2"
                  style={{ fontWeight: '500', borderRadius: '8px' }}
                >
                  <i className="bi bi-arrow-left me-2"></i>
                  Back to Admin
                </Button>
                <Button
                  onClick={() => setCreatedUser(null)}
                  className="px-5 py-2 fw-semibold border-0"
                  style={{
                    background: 'linear-gradient(135deg, #054653 0%, #1d4ed8 100%)',
                    color: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(37, 99, 235, 0.4)';
                  }}
                >
                  <i className="bi bi-person-plus-fill me-2"></i>
                  Create Another User
                </Button>
              </div>
            </Card.Body>
          </Card>
        ) : (
          <Row>
            <Col lg={8}>
              <Card className="border-0 shadow-sm rounded-4 overflow-hidden">
                <div className={`p-4 border-bottom ${isStaff ? 'bg-primary' : 'bg-secondary'} bg-opacity-10`}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      <div className={`rounded-circle ${isStaff ? 'bg-primary' : 'bg-secondary'} text-white d-flex align-items-center justify-content-center me-3 shadow-sm`} style={{ width: '48px', height: '48px' }}>
                        <i className={`bi ${isStaff ? 'bi-briefcase-fill' : 'bi-person-badge-fill'} fs-5`}></i>
                      </div>
                      <div>
                        <h5 className={`fw-bold mb-1 ${isStaff ? 'text-primary' : 'text-secondary'}`}>
                          {isStaff ? 'Staff Account Details' : 'Client Account Details'}
                        </h5>
                        <p className="text-muted small mb-0">
                          {isStaff ? 'Fill in the details for the new staff member.' : 'Set up access for an external client user.'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="white"
                      size="sm"
                      className="border shadow-sm"
                      onClick={() => setShowInstructionModal(true)}
                    >
                      Change Type
                    </Button>
                  </div>
                </div>

                <Card.Body className="p-4">
                  <Form onSubmit={handleSubmit}>
                    {/* Section: Personal Info */}
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
                        <i className="bi bi-person-fill text-white" style={{ fontSize: '1rem' }}></i>
                      </div>
                      <h6 className="text-uppercase fw-bold small mb-0" style={{ color: '#054653', letterSpacing: '0.5px' }}>
                        Personal Information
                      </h6>
                    </div>
                    <Row className="g-3 mb-4">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="small fw-medium">First Name <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            required
                            placeholder="e.g. John"
                            isInvalid={!!validationErrors.firstName}
                            className="bg-light border-0"
                            style={{ padding: '0.75rem', borderRadius: '8px' }}
                          />
                          <Form.Control.Feedback type="invalid">{validationErrors.firstName}</Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="small fw-medium">Last Name <span className="text-danger">*</span></Form.Label>
                          <Form.Control
                            type="text"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            required
                            placeholder="e.g. Doe"
                            isInvalid={!!validationErrors.lastName}
                            className="bg-light border-0"
                            style={{ padding: '0.75rem', borderRadius: '8px' }}
                          />
                          <Form.Control.Feedback type="invalid">{validationErrors.lastName}</Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                      <Col md={12}>
                        <Form.Group>
                          <Form.Label className="small fw-medium">Other Names</Form.Label>
                          <Form.Control
                            type="text"
                            value={formData.otherNames}
                            onChange={(e) => setFormData({ ...formData, otherNames: e.target.value })}
                            placeholder="Middle names (optional)"
                            className="bg-light border-0"
                            style={{ padding: '0.75rem', borderRadius: '8px' }}
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    {/* Section: Account Info */}
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
                        <i className="bi bi-shield-lock-fill text-white" style={{ fontSize: '1rem' }}></i>
                      </div>
                      <h6 className="text-uppercase fw-bold small mb-0" style={{ color: '#14B8A6', letterSpacing: '0.5px' }}>
                        Account Credentials
                      </h6>
                    </div>
                    <Row className="g-3 mb-4">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="small fw-medium">Email Address <span className="text-danger">*</span></Form.Label>
                          <InputGroup>
                            <InputGroup.Text className="bg-light border-0" style={{ borderRadius: '8px 0 0 8px', padding: '0.75rem' }}>
                              <i className="bi bi-envelope text-muted"></i>
                            </InputGroup.Text>
                            <Form.Control
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              required
                              placeholder="john@company.com"
                              isInvalid={!!validationErrors.email}
                              className="bg-light border-0"
                              style={{ padding: '0.75rem', borderRadius: '0 8px 8px 0' }}
                            />
                          </InputGroup>
                          <Form.Control.Feedback type="invalid" className="d-block">{validationErrors.email}</Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="small fw-medium">Username <span className="text-danger">*</span></Form.Label>
                          <InputGroup>
                            <InputGroup.Text className="bg-light border-0" style={{ borderRadius: '8px 0 0 8px', padding: '0.75rem' }}>
                              <i className="bi bi-at text-muted"></i>
                            </InputGroup.Text>
                            <Form.Control
                              type="text"
                              value={formData.username}
                              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                              required
                              placeholder="johndoe"
                              isInvalid={!!validationErrors.username}
                              className="bg-light border-0"
                              style={{ padding: '0.75rem', borderRadius: '0 8px 8px 0' }}
                            />
                          </InputGroup>
                          <Form.Text className="text-muted small">3-30 chars, letters/numbers only</Form.Text>
                          <Form.Control.Feedback type="invalid" className="d-block">{validationErrors.username}</Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                    </Row>

                    {/* Section: Role & Details */}
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
                        <i className="bi bi-award-fill text-white" style={{ fontSize: '1rem' }}></i>
                      </div>
                      <h6 className="text-uppercase fw-bold small mb-0" style={{ color: '#f59e0b', letterSpacing: '0.5px' }}>
                        Role & Permissions
                      </h6>
                    </div>
                    <div className="p-3 bg-light rounded-3 mb-4">
                      <Row className="g-3">
                        <Col md={isStaff ? 8 : 12}>
                          <Form.Group>
                            <Form.Label className="small fw-medium">Job Title</Form.Label>
                            <Form.Control
                              type="text"
                              value={formData.title}
                              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                              placeholder="e.g. Senior Developer"
                              className="border-0 bg-white"
                            />
                          </Form.Group>
                        </Col>
                        {isStaff && (
                          <Col md={4}>
                            <Form.Group>
                              <Form.Label className="small fw-medium">Department</Form.Label>
                              <Form.Control
                                type="text"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                placeholder="e.g. Engineering"
                                className="border-0 bg-white"
                              />
                            </Form.Group>
                          </Col>
                        )}
                      </Row>

                      {isStaff && (
                        <div className="mt-3 pt-3 border-top">
                          <Form.Label className="small fw-medium d-block mb-2">System Role</Form.Label>
                          <div className="d-flex gap-3">
                            <div
                              className={`flex-fill p-3 rounded border cursor-pointer transition-all ${formData.role === 'staff' ? 'border-primary bg-white shadow-sm' : 'border-transparent'}`}
                              onClick={() => setFormData({ ...formData, role: 'staff' })}
                              style={{ cursor: 'pointer' }}
                            >
                              <Form.Check
                                type="radio"
                                id="role-staff"
                                name="role"
                                label={<span className="fw-bold">Regular Staff</span>}
                                checked={formData.role === 'staff'}
                                onChange={() => { }}
                                className="mb-1"
                              />
                              <small className="text-muted d-block ps-4">Standard access to assigned projects and tasks.</small>
                            </div>
                            <div
                              className={`flex-fill p-3 rounded border cursor-pointer transition-all ${formData.role === 'admin' ? 'border-danger bg-white shadow-sm' : 'border-transparent'}`}
                              onClick={() => setFormData({ ...formData, role: 'admin' })}
                              style={{ cursor: 'pointer' }}
                            >
                              <Form.Check
                                type="radio"
                                id="role-admin"
                                name="role"
                                label={<span className="fw-bold text-danger">Administrator</span>}
                                checked={formData.role === 'admin'}
                                onChange={() => { }}
                                className="mb-1"
                              />
                              <small className="text-muted d-block ps-4">Full system access and configuration.</small>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-top">
                            <Row className="g-3">
                              <Col md={12}>
                                <Form.Group className="mb-0">
                                  <Form.Label className="small fw-medium">Assign Supervisor</Form.Label>
                                  <Form.Select
                                    name="supervisorId"
                                    value={formData.supervisorId || ''}
                                    onChange={(e) => setFormData({ ...formData, supervisorId: e.target.value })}
                                  >
                                    <option value="">Select Supervisor</option>
                                    {supervisors.map(supervisor => (
                                      <option key={supervisor.$id} value={supervisor.accountId}>
                                        {supervisor.firstName} {supervisor.lastName}
                                      </option>
                                    ))}
                                  </Form.Select>
                                  <Form.Text className="text-muted">
                                    Optional. Assign a supervisor to manage this user's timesheets and approvals.
                                  </Form.Text>
                                </Form.Group>
                              </Col>
                            </Row>
                          </div>

                          <div className="mt-3 pt-3 border-top">
                            <Form.Label className="small fw-medium d-block mb-2">Additional Privileges</Form.Label>
                            <Row className="g-3">
                              <Col md={6}>
                                <div
                                  className={`p-3 rounded border cursor-pointer transition-all ${formData.isSupervisor ? 'border-info bg-white shadow-sm' : 'border-transparent'}`}
                                  onClick={() => setFormData({ ...formData, isSupervisor: !formData.isSupervisor })}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <Form.Check
                                    type="checkbox"
                                    id="isSupervisor"
                                    label={<span className="fw-bold text-info">Supervisor</span>}
                                    checked={formData.isSupervisor}
                                    onChange={() => { }}
                                    className="mb-1"
                                  />
                                  <small className="text-muted d-block ps-4">Can view timesheets of supervised staff.</small>
                                </div>
                              </Col>
                              <Col md={6}>
                                <div
                                  className={`p-3 rounded border cursor-pointer transition-all ${formData.isFinance ? 'border-primary bg-white shadow-sm' : 'border-transparent'}`}
                                  onClick={() => setFormData({ ...formData, isFinance: !formData.isFinance })}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <Form.Check
                                    type="checkbox"
                                    id="isFinance"
                                    label={<span className="fw-bold text-primary">Finance</span>}
                                    checked={formData.isFinance}
                                    onChange={() => { }}
                                    className="mb-1"
                                  />
                                  <small className="text-muted d-block ps-4">Can manage organization-wide finances and reports.</small>
                                </div>
                              </Col>
                            </Row>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Client Specific Fields */}
                    {!isStaff && (
                      <>
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
                            <i className="bi bi-building-fill text-white" style={{ fontSize: '1rem' }}></i>
                          </div>
                          <h6 className="text-uppercase fw-bold small mb-0" style={{ color: '#14B8A6', letterSpacing: '0.5px' }}>
                            Client Access
                          </h6>
                        </div>

                        <div
                          className="p-4 rounded-3 mb-4"
                          style={{
                            background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
                            border: '2px solid #99f6e4'
                          }}
                        >
                          <Row className="g-4">
                            {/* Organizations Section */}
                            <Col md={6}>
                              <div className="d-flex align-items-center mb-3">
                                <div
                                  className="rounded-circle d-flex align-items-center justify-content-center me-2"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    background: 'linear-gradient(135deg, #14B8A6 0%, #0f9488 100%)',
                                    boxShadow: '0 2px 8px rgba(20, 184, 166, 0.3)'
                                  }}
                                >
                                  <i className="bi bi-building text-white" style={{ fontSize: '0.9rem' }}></i>
                                </div>
                                <div>
                                  <h6 className="mb-0 fw-semibold" style={{ color: '#0f766e', fontSize: '0.9rem' }}>
                                    Organizations
                                  </h6>
                                  <small className="text-muted">Select client organizations</small>
                                </div>
                              </div>

                              <div
                                style={{
                                  maxHeight: '250px',
                                  overflowY: 'auto',
                                  overflowX: 'hidden'
                                }}
                              >
                                {clientOrganizations.length === 0 ? (
                                  <div className="text-center py-4">
                                    <i className="bi bi-inbox" style={{ fontSize: '2rem', opacity: 0.3, color: '#14B8A6' }}></i>
                                    <p className="text-muted small mb-0 mt-2">No organizations available</p>
                                  </div>
                                ) : (
                                  <div className="d-flex flex-column gap-2">
                                    {clientOrganizations.map(client => {
                                      const isSelected = formData.clientOrganizationIds.includes(client.$id);
                                      return (
                                        <div
                                          key={client.$id}
                                          onClick={() => setFormData({
                                            ...formData,
                                            clientOrganizationIds: toggleArrayItem(formData.clientOrganizationIds, client.$id)
                                          })}
                                          className="d-flex align-items-center p-3 rounded-3"
                                          style={{
                                            backgroundColor: isSelected ? 'white' : 'rgba(255, 255, 255, 0.5)',
                                            border: isSelected ? '2px solid #14B8A6' : '2px solid transparent',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            boxShadow: isSelected ? '0 2px 8px rgba(20, 184, 166, 0.2)' : 'none'
                                          }}
                                          onMouseEnter={(e) => {
                                            if (!isSelected) {
                                              e.currentTarget.style.backgroundColor = 'white';
                                              e.currentTarget.style.borderColor = '#99f6e4';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            if (!isSelected) {
                                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
                                              e.currentTarget.style.borderColor = 'transparent';
                                            }
                                          }}
                                        >
                                          <div
                                            className="rounded d-flex align-items-center justify-content-center me-3 flex-shrink-0"
                                            style={{
                                              width: '20px',
                                              height: '20px',
                                              border: isSelected ? '2px solid #14B8A6' : '2px solid #cbd5e1',
                                              backgroundColor: isSelected ? '#14B8A6' : 'white',
                                              transition: 'all 0.2s ease'
                                            }}
                                          >
                                            {isSelected && (
                                              <i className="bi bi-check text-white" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}></i>
                                            )}
                                          </div>
                                          <div className="flex-grow-1">
                                            <div className="fw-medium" style={{ color: '#0f766e', fontSize: '0.9rem' }}>
                                              {client.name}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {clientOrganizations.length > 0 && (
                                <div className="mt-3 p-2 bg-white rounded text-center">
                                  <small className="text-muted">
                                    <i className="bi bi-check-circle me-1" style={{ color: '#14B8A6' }}></i>
                                    {formData.clientOrganizationIds.length} selected
                                  </small>
                                </div>
                              )}
                            </Col>

                            {/* Projects Section */}
                            <Col md={6}>
                              <div className="d-flex align-items-center mb-3">
                                <div
                                  className="rounded-circle d-flex align-items-center justify-content-center me-2"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    background: 'linear-gradient(135deg, #14B8A6 0%, #0f9488 100%)',
                                    boxShadow: '0 2px 8px rgba(20, 184, 166, 0.3)'
                                  }}
                                >
                                  <i className="bi bi-folder text-white" style={{ fontSize: '0.9rem' }}></i>
                                </div>
                                <div>
                                  <h6 className="mb-0 fw-semibold" style={{ color: '#0f766e', fontSize: '0.9rem' }}>
                                    Projects
                                  </h6>
                                  <small className="text-muted">Select accessible projects</small>
                                </div>
                              </div>

                              <div
                                style={{
                                  maxHeight: '250px',
                                  overflowY: 'auto',
                                  overflowX: 'hidden'
                                }}
                              >
                                {projects.length === 0 ? (
                                  <div className="text-center py-4">
                                    <i className="bi bi-folder-x" style={{ fontSize: '2rem', opacity: 0.3, color: '#14B8A6' }}></i>
                                    <p className="text-muted small mb-0 mt-2">No projects available</p>
                                  </div>
                                ) : (
                                  <div className="d-flex flex-column gap-2">
                                    {projects.map(project => {
                                      const isSelected = formData.projectIds.includes(project.$id);
                                      return (
                                        <div
                                          key={project.$id}
                                          onClick={() => setFormData({
                                            ...formData,
                                            projectIds: toggleArrayItem(formData.projectIds, project.$id)
                                          })}
                                          className="d-flex align-items-center p-3 rounded-3"
                                          style={{
                                            backgroundColor: isSelected ? 'white' : 'rgba(255, 255, 255, 0.5)',
                                            border: isSelected ? '2px solid #14B8A6' : '2px solid transparent',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            boxShadow: isSelected ? '0 2px 8px rgba(20, 184, 166, 0.2)' : 'none'
                                          }}
                                          onMouseEnter={(e) => {
                                            if (!isSelected) {
                                              e.currentTarget.style.backgroundColor = 'white';
                                              e.currentTarget.style.borderColor = '#99f6e4';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            if (!isSelected) {
                                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
                                              e.currentTarget.style.borderColor = 'transparent';
                                            }
                                          }}
                                        >
                                          <div
                                            className="rounded d-flex align-items-center justify-content-center me-3 flex-shrink-0"
                                            style={{
                                              width: '20px',
                                              height: '20px',
                                              border: isSelected ? '2px solid #14B8A6' : '2px solid #cbd5e1',
                                              backgroundColor: isSelected ? '#14B8A6' : 'white',
                                              transition: 'all 0.2s ease'
                                            }}
                                          >
                                            {isSelected && (
                                              <i className="bi bi-check text-white" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}></i>
                                            )}
                                          </div>
                                          <div className="flex-grow-1">
                                            <div className="fw-semibold" style={{ color: '#14B8A6', fontSize: '0.85rem' }}>
                                              {project.code}
                                            </div>
                                            <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                                              {project.name}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {projects.length > 0 && (
                                <div className="mt-3 p-2 bg-white rounded text-center">
                                  <small className="text-muted">
                                    <i className="bi bi-check-circle me-1" style={{ color: '#14B8A6' }}></i>
                                    {formData.projectIds.length} selected
                                  </small>
                                </div>
                              )}
                            </Col>
                          </Row>
                        </div>
                      </>
                    )}

                    <div className="d-flex justify-content-between align-items-center mt-5 pt-4 border-top">
                      <Button
                        variant="link"
                        className="text-muted text-decoration-none"
                        onClick={() => router.push('/admin')}
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
                          background: isStaff
                            ? 'linear-gradient(135deg, #054653 0%, #1d4ed8 100%)'
                            : 'linear-gradient(135deg, #14B8A6 0%, #0f9488 100%)',
                          color: 'white',
                          borderRadius: '10px',
                          boxShadow: isStaff
                            ? '0 4px 15px rgba(37, 99, 235, 0.4)'
                            : '0 4px 15px rgba(20, 184, 166, 0.4)',
                          fontSize: '1rem',
                          transition: 'all 0.3s ease',
                          transform: 'translateY(0)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = isStaff
                            ? '0 6px 20px rgba(37, 99, 235, 0.5)'
                            : '0 6px 20px rgba(20, 184, 166, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = isStaff
                            ? '0 4px 15px rgba(37, 99, 235, 0.4)'
                            : '0 4px 15px rgba(20, 184, 166, 0.4)';
                        }}
                      >
                        {submitting ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Creating User Account...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-person-plus-fill me-2"></i>
                            Create User Account
                          </>
                        )}
                      </Button>
                    </div>
                  </Form>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={4}>
              <div className="sticky-top" style={{ top: '20px', zIndex: 1 }}>
                <Card
                  className="border-0 shadow-sm rounded-4 mb-4 text-white overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #dc3545 0%, #bb2d3b 100%)' }}
                >
                  <div className="p-4 position-relative">
                    <div className="position-absolute top-0 end-0 me-n3 mt-n3" style={{ opacity: '0.15' }}>
                      <i className="bi bi-shield-lock-fill" style={{ fontSize: '5rem' }}></i>
                    </div>
                    <div className="d-flex align-items-center mb-3 position-relative">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-3"
                        style={{
                          width: '40px',
                          height: '40px',
                          background: 'rgba(255, 255, 255, 0.2)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <i className="bi bi-shield-lock-fill" style={{ fontSize: '1.25rem' }}></i>
                      </div>
                      <h5 className="fw-bold mb-0">Security Note</h5>
                    </div>
                    <p className="small mb-0 position-relative" style={{ lineHeight: '1.6', opacity: '0.9' }}>
                      A temporary password will be generated automatically upon creation. You must share this with the user securely.
                    </p>
                  </div>
                </Card>

                <Card
                  className="border-0 shadow-sm rounded-4"
                  style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}
                >
                  <Card.Body className="p-4">
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
                        <i className="bi bi-lightbulb-fill text-white"></i>
                      </div>
                      <h6 className="fw-bold mb-0" style={{ color: '#054653' }}>Quick Tips</h6>
                    </div>
                    <ul className="list-unstyled small mb-0 d-flex flex-column gap-3">
                      <li className="d-flex align-items-start">
                        <i className="bi bi-check-circle-fill me-2 mt-1" style={{ color: '#054653', fontSize: '1rem' }}></i>
                        <span style={{ lineHeight: '1.5' }}>
                          <strong>Usernames</strong> must be unique and contain only letters, numbers, and underscores.
                        </span>
                      </li>
                      <li className="d-flex align-items-start">
                        <i className="bi bi-check-circle-fill me-2 mt-1" style={{ color: '#14B8A6', fontSize: '1rem' }}></i>
                        <span style={{ lineHeight: '1.5' }}>
                          <strong>Staff</strong> members can be assigned to multiple projects and track time.
                        </span>
                      </li>
                      <li className="d-flex align-items-start">
                        <i className="bi bi-check-circle-fill me-2 mt-1" style={{ color: '#f59e0b', fontSize: '1rem' }}></i>
                        <span style={{ lineHeight: '1.5' }}>
                          <strong>Clients</strong> only see projects they are explicitly assigned to.
                        </span>
                      </li>
                    </ul>
                  </Card.Body>
                </Card>
              </div>
            </Col>
          </Row>
        )}
      </Container>
    </AppLayout>
  );
}

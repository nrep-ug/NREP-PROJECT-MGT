'use client';

import { useState, useEffect } from 'react';
import { Card, Form, Button, Badge, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import AppLayout from '@/components/AppLayout';
import Toast, { useToast } from '@/components/Toast';

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const { userId } = params;
  const { user, loading: authLoading } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  // Form state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [otherNames, setOtherNames] = useState('');
  const [status, setStatus] = useState('active');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [clientOrganizationIds, setClientOrganizationIds] = useState([]);
  const [clientOrganizations, setClientOrganizations] = useState([]);
  const [userRole, setUserRole] = useState(null); // 'staff' or 'client'

  useEffect(() => {
    if (user?.isAdmin && userId) {
      loadUserData();
      loadClientOrganizations();
    }
  }, [user, userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      // Get user from database
      const userDocs = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.USERS,
        [Query.equal('accountId', userId), Query.limit(1)]
      );

      if (userDocs.documents.length === 0) {
        showToast('User not found', 'danger');
        router.push('/admin/users');
        return;
      }

      const userDoc = userDocs.documents[0];
      setUserData(userDoc);

      // Populate form fields
      setFirstName(userDoc.firstName || '');
      setLastName(userDoc.lastName || '');
      setOtherNames(userDoc.otherNames || '');
      setStatus(userDoc.status || 'active');
      setTitle(userDoc.title || '');
      setDepartment(userDoc.department || '');
      setIsAdmin(userDoc.isAdmin || false);
      setClientOrganizationIds(userDoc.clientOrganizationIds || []);

      // Determine user role from role array
      // role is now an array: ['staff'], ['staff', 'admin'], or ['client']
      const roleArray = userDoc.role || [];
      if (roleArray.includes('client')) {
        setUserRole('client');
      } else if (roleArray.includes('staff')) {
        setUserRole('staff');
      } else {
        setUserRole(null);
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
      showToast('Failed to load user data', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const loadClientOrganizations = async () => {
    try {
      const response = await fetch(`/api/admin/organizations?requesterId=${user.authUser.$id}&type=client`);
      if (response.ok) {
        const data = await response.json();
        setClientOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error('Failed to load client organizations:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      showToast('First name and last name are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        requesterId: user.authUser.$id,
        role: userRole,
        firstName,
        lastName,
        otherNames,
        status,
        title
      };

      if (userRole === 'staff') {
        updateData.department = department;
        updateData.isAdmin = isAdmin;
      } else if (userRole === 'client') {
        updateData.clientOrganizationIds = clientOrganizationIds;
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }

      showToast('User updated successfully!', 'success');

      // Wait a moment then redirect back to users list
      setTimeout(() => {
        router.push('/admin/users');
      }, 1500);
    } catch (err) {
      showToast(err.message || 'Failed to update user', 'danger');
      setSaving(false);
    }
  };

  const getStatusBadge = (statusValue) => {
    const variants = {
      active: 'success',
      inactive: 'secondary',
      invited: 'warning',
      suspended: 'danger'
    };
    return variants[statusValue] || 'secondary';
  };

  const getRoleBadge = (role) => {
    const variants = {
      staff: 'primary',
      client: 'info'
    };
    return variants[role] || 'secondary';
  };

  if (authLoading || loading) {
    return (
      <AppLayout user={user}>
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-2">Loading user data...</p>
        </div>
      </AppLayout>
    );
  }

  if (!user?.isAdmin) {
    return (
      <AppLayout user={user}>
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5">
            <i className="bi bi-shield-lock" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
            <h5 className="mt-3">Access Denied</h5>
            <p className="text-muted">You need admin privileges to access this page.</p>
          </Card.Body>
        </Card>
      </AppLayout>
    );
  }

  if (!userData) {
    return (
      <AppLayout user={user}>
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5">
            <i className="bi bi-exclamation-triangle" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
            <h5 className="mt-3">User Not Found</h5>
            <p className="text-muted">The requested user could not be found.</p>
            <Button onClick={() => router.push('/admin/users')}>
              Back to Users
            </Button>
          </Card.Body>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Hero Header */}
      <Card className="border-0 shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)' }}>
        <Card.Body className="text-white p-4">
          <Row className="align-items-center">
            <Col md={8}>
              <div className="d-flex align-items-center mb-2">
                <Button
                  variant="link"
                  className="text-white p-0 me-3"
                  style={{ textDecoration: 'none', fontSize: '1.5rem' }}
                  onClick={() => router.push('/admin/users')}
                >
                  <i className="bi bi-arrow-left-circle"></i>
                </Button>
                <h2 className="mb-0">
                  <i className="bi bi-pencil-square me-3"></i>
                  Edit User
                </h2>
              </div>
              <p className="mb-0 opacity-90 ms-5 ps-2">
                Update user details, roles, and permissions
              </p>
            </Col>
            <Col md={4} className="text-md-end">
              <div className="d-flex flex-column align-items-md-end gap-2">
                <Badge bg="light" text="dark" className="px-3 py-2">
                  <i className="bi bi-person-circle me-2"></i>
                  @{userData.username}
                </Badge>
                <Badge bg={getRoleBadge(userRole)} className="px-3 py-2">
                  <i className={`bi ${userRole === 'client' ? 'bi-person' : 'bi-briefcase'} me-2`}></i>
                  {userRole?.toUpperCase()}
                  {isAdmin && userRole === 'staff' && ' (ADMIN)'}
                </Badge>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* User Information Card */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div
                className="rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center"
                style={{
                  width: '100px',
                  height: '100px',
                  background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)',
                  color: 'white',
                  fontSize: '2rem',
                  fontWeight: '600'
                }}
              >
                {userData.firstName?.[0]}{userData.lastName?.[0]}
              </div>
              <h5 className="mb-1">{userData.firstName} {userData.lastName}</h5>
              <p className="text-muted small mb-3">@{userData.username}</p>
              <Badge bg={getStatusBadge(userData.status)} className="mb-2">
                <i
                  className={`bi ${
                    userData.status === 'active'
                      ? 'bi-check-circle'
                      : userData.status === 'invited'
                      ? 'bi-clock'
                      : userData.status === 'suspended'
                      ? 'bi-x-circle'
                      : 'bi-dash-circle'
                  } me-1`}
                ></i>
                {userData.status}
              </Badge>
              <div className="text-muted small mt-3">
                <i className="bi bi-envelope me-2"></i>
                {userData.email}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={9}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-bottom" style={{ borderBottom: '2px solid #e9ecef' }}>
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-person-lines-fill me-2" style={{ color: '#054653' }}></i>
                User Details
              </h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">
                        First Name <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        disabled={saving}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">
                        Last Name <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={saving}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">Other Names</Form.Label>
                  <Form.Control
                    type="text"
                    value={otherNames}
                    onChange={(e) => setOtherNames(e.target.value)}
                    disabled={saving}
                    placeholder="Middle names or other names"
                  />
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">Status</Form.Label>
                      <Form.Select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        disabled={saving}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="invited">Invited</option>
                        <option value="suspended">Suspended</option>
                      </Form.Select>
                      <Form.Text className="text-muted">
                        Control user's account status
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">Title</Form.Label>
                      <Form.Control
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={saving}
                        placeholder="e.g., Senior Developer, Project Manager"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                {/* Staff-specific fields */}
                {userRole === 'staff' && (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold">Department</Form.Label>
                      <Form.Control
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        disabled={saving}
                        placeholder="e.g., Engineering, Finance, HR"
                      />
                    </Form.Group>

                    <Card className="border-warning mb-3" style={{ backgroundColor: '#fff3cd' }}>
                      <Card.Body>
                        <Form.Group className="mb-0">
                          <Form.Check
                            type="checkbox"
                            id="is-admin"
                            label={
                              <span>
                                <i className="bi bi-shield-lock me-2"></i>
                                <strong>System Administrator</strong>
                              </span>
                            }
                            checked={isAdmin}
                            onChange={(e) => setIsAdmin(e.target.checked)}
                            disabled={saving}
                          />
                          <Form.Text className="text-muted d-block mt-2" style={{ marginLeft: '1.6rem' }}>
                            <i className="bi bi-info-circle me-1"></i>
                            Administrators have full access to all system features. This will add the 'admin' label
                            to the user's account while maintaining the 'staff' label. The role array will be updated
                            to {isAdmin ? "['staff']" : "['staff', 'admin']"}.
                          </Form.Text>
                        </Form.Group>
                      </Card.Body>
                    </Card>
                  </>
                )}

                {/* Client-specific fields */}
                {userRole === 'client' && (
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">Client Organizations</Form.Label>
                    <Card className="border">
                      <Card.Body style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        {clientOrganizations.length === 0 ? (
                          <div className="text-center text-muted py-3">
                            <i className="bi bi-building" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
                            <p className="mb-0 mt-2">No client organizations found</p>
                          </div>
                        ) : (
                          clientOrganizations.map(org => (
                            <Form.Check
                              key={org.$id}
                              type="checkbox"
                              id={`org-${org.$id}`}
                              label={
                                <div>
                                  <div className="fw-semibold">{org.name}</div>
                                  {org.industry && (
                                    <small className="text-muted">{org.industry}</small>
                                  )}
                                </div>
                              }
                              checked={clientOrganizationIds.includes(org.$id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setClientOrganizationIds([...clientOrganizationIds, org.$id]);
                                } else {
                                  setClientOrganizationIds(clientOrganizationIds.filter(id => id !== org.$id));
                                }
                              }}
                              disabled={saving}
                              className="mb-3 pb-3 border-bottom"
                            />
                          ))
                        )}
                      </Card.Body>
                    </Card>
                    <Form.Text className="text-muted">
                      <i className="bi bi-info-circle me-1"></i>
                      Select which client organizations this user belongs to
                    </Form.Text>
                  </Form.Group>
                )}

                {/* Action buttons */}
                <div className="d-flex gap-2 mt-4 pt-3 border-top">
                  <Button
                    variant="outline-secondary"
                    onClick={() => router.push('/admin/users')}
                    disabled={saving}
                  >
                    <i className="bi bi-x-circle me-2"></i>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={saving || !firstName.trim() || !lastName.trim()}
                    style={{
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)'
                    }}
                  >
                    {saving ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Info Alert */}
      <Alert variant="info" className="border-0 shadow-sm">
        <Alert.Heading className="h6">
          <i className="bi bi-info-circle me-2"></i>
          About User Roles and Labels
        </Alert.Heading>
        <hr />
        <p className="mb-0 small">
          <strong>Staff Users:</strong> All staff users have the 'staff' label. When you assign admin privileges,
          the 'admin' label is added (role becomes ['staff', 'admin']). When you remove admin privileges,
          only the 'admin' label is removed (role becomes ['staff']).
          <br /><br />
          <strong>Client Users:</strong> Client users have only the 'client' label (role is ['client']).
        </p>
      </Alert>
    </AppLayout>
  );
}

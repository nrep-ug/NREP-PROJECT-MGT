'use client';

import { useState } from 'react';
import { Card, Button, Alert, Row, Col, Table, Badge, Spinner, Form, InputGroup, Pagination } from 'react-bootstrap';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '@/hooks/useAdmin';
import AppLayout from '@/components/AppLayout';
import Toast, { useToast } from '@/components/Toast';

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  // Pagination and filter state
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');

  // Fetch users with TanStack Query
  const { data, isLoading: loadingUsers, refetch } = useUsers(user?.organizationId, {
    page,
    limit,
    search,
    roleFilter,
    statusFilter,
    userTypeFilter,
  });

  const users = data?.users || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  // Calculate stats from users data
  const stats = {
    totalUsers: total,
    activeUsers: users.filter(u => u.status === 'active').length,
    totalProjects: 0, // Placeholder
    activeProjects: 0, // Placeholder
  };

  // Get badge variant for user type
  const getUserTypeBadge = (userType) => {
    return userType === 'client' ? 'info' : 'primary';
  };

  // Get badge variant for user role
  const getRoleBadge = (role) => {
    const variants = {
      admin: 'danger',
      staff: 'success',
      client: 'info',
    };
    return variants[role] || 'secondary';
  };

  // Get badge variant for user status
  const getStatusBadge = (status) => {
    const variants = {
      active: 'success',
      invited: 'warning',
      inactive: 'secondary',
      suspended: 'danger',
    };
    return variants[status] || 'secondary';
  };

  // Handle search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1); // Reset to first page on new search
  };

  // Handle filter change
  const handleFilterChange = (type, value) => {
    setPage(1); // Reset to first page on filter change
    if (type === 'role') setRoleFilter(value);
    if (type === 'status') setStatusFilter(value);
    if (type === 'userType') setUserTypeFilter(value);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setUserTypeFilter('');
    setPage(1);
  };

  // Pagination controls
  const renderPaginationItems = () => {
    const items = [];
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      items.push(<Pagination.First key="first" onClick={() => setPage(1)} />);
      items.push(<Pagination.Prev key="prev" onClick={() => setPage(page - 1)} disabled={page === 1} />);
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <Pagination.Item key={i} active={i === page} onClick={() => setPage(i)}>
          {i}
        </Pagination.Item>
      );
    }

    if (endPage < totalPages) {
      items.push(<Pagination.Next key="next" onClick={() => setPage(page + 1)} disabled={page === totalPages} />);
      items.push(<Pagination.Last key="last" onClick={() => setPage(totalPages)} />);
    }

    return items;
  };

  // Check if user is admin
  if (!loading && user && !user.isAdmin) {
    return (
      <AppLayout user={user}>
        <Alert variant="danger">
          <Alert.Heading>Access Denied</Alert.Heading>
          <p>You do not have permission to access the admin panel. Only administrators can access this page.</p>
        </Alert>
      </AppLayout>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <AppLayout user={user}>
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-2">Loading...</p>
        </div>
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
              <h2 className="mb-2">
                <i className="bi bi-shield-lock-fill me-3"></i>
                Admin Dashboard
              </h2>
              <p className="mb-0 opacity-90">
                System administration, user management, and analytics
              </p>
            </Col>
            <Col md={4} className="text-md-end">
              <div className="d-flex flex-column align-items-md-end gap-2">
                <Badge bg="light" text="dark" className="px-3 py-2">
                  <i className="bi bi-person-circle me-2"></i>
                  Administrator: {user?.firstName} {user?.lastName}
                </Badge>
                <small className="opacity-75">
                  <i className="bi bi-clock me-1"></i>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </small>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Quick Stats */}
      <Row className="mb-4 g-3">
        <Col md={3}>
          <Card
            className="border-0 shadow-sm h-100 position-relative overflow-hidden"
            style={{
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(37, 99, 235, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div
              className="position-absolute top-0 end-0"
              style={{ fontSize: '5rem', marginTop: '-1rem', marginRight: '-1rem', opacity: '0.05' }}
            >
              <i className="bi bi-people"></i>
            </div>
            <Card.Body className="text-center position-relative">
              <div className="mb-3">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                  style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, #054653 0%, #1d4ed8 100%)',
                    boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <i className="bi bi-people text-white" style={{ fontSize: '1.8rem' }}></i>
                </div>
              </div>
              <h2 className="mb-1 fw-bold" style={{ color: '#054653' }}>{stats.totalUsers}</h2>
              <div className="text-muted small fw-semibold">Total Users</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card
            className="border-0 shadow-sm h-100 position-relative overflow-hidden"
            style={{
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(25, 135, 84, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div
              className="position-absolute top-0 end-0"
              style={{ fontSize: '5rem', marginTop: '-1rem', marginRight: '-1rem', opacity: '0.05' }}
            >
              <i className="bi bi-person-check"></i>
            </div>
            <Card.Body className="text-center position-relative">
              <div className="mb-3">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                  style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, #198754 0%, #146c43 100%)',
                    boxShadow: '0 4px 15px rgba(25, 135, 84, 0.3)'
                  }}
                >
                  <i className="bi bi-person-check text-white" style={{ fontSize: '1.8rem' }}></i>
                </div>
              </div>
              <h2 className="mb-1 fw-bold" style={{ color: '#198754' }}>{stats.activeUsers}</h2>
              <div className="text-muted small fw-semibold">Active Users</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card
            className="border-0 shadow-sm h-100 position-relative overflow-hidden"
            style={{
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(20, 184, 166, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div
              className="position-absolute top-0 end-0"
              style={{ fontSize: '5rem', marginTop: '-1rem', marginRight: '-1rem', opacity: '0.05' }}
            >
              <i className="bi bi-folder"></i>
            </div>
            <Card.Body className="text-center position-relative">
              <div className="mb-3">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                  style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, #14B8A6 0%, #0f9488 100%)',
                    boxShadow: '0 4px 15px rgba(20, 184, 166, 0.3)'
                  }}
                >
                  <i className="bi bi-folder text-white" style={{ fontSize: '1.8rem' }}></i>
                </div>
              </div>
              <h2 className="mb-1 fw-bold" style={{ color: '#14B8A6' }}>{stats.totalProjects}</h2>
              <div className="text-muted small fw-semibold">Total Projects</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card
            className="border-0 shadow-sm h-100 position-relative overflow-hidden"
            style={{
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(253, 126, 20, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div
              className="position-absolute top-0 end-0"
              style={{ fontSize: '5rem', marginTop: '-1rem', marginRight: '-1rem', opacity: '0.05' }}
            >
              <i className="bi bi-folder-check"></i>
            </div>
            <Card.Body className="text-center position-relative">
              <div className="mb-3">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                  style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, #fd7e14 0%, #dc6502 100%)',
                    boxShadow: '0 4px 15px rgba(253, 126, 20, 0.3)'
                  }}
                >
                  <i className="bi bi-folder-check text-white" style={{ fontSize: '1.8rem' }}></i>
                </div>
              </div>
              <h2 className="mb-1 fw-bold" style={{ color: '#fd7e14' }}>{stats.activeProjects}</h2>
              <div className="text-muted small fw-semibold">Active Projects</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Admin Actions */}
      <Row className="mb-4 g-3">
        <Col md={4}>
          <Card
            className="border-0 shadow-sm h-100 position-relative overflow-hidden"
            style={{
              transition: 'all 0.3s ease',
              borderLeft: '4px solid #dc3545'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(5px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(220, 53, 69, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div
              className="position-absolute top-0 end-0"
              style={{ fontSize: '6rem', marginTop: '-1rem', marginRight: '-1rem', opacity: '0.03' }}
            >
              <i className="bi bi-gear-fill"></i>
            </div>
            <Card.Body className="position-relative">
              <div className="d-flex align-items-start mb-3">
                <div className="me-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{
                      width: '56px',
                      height: '56px',
                      background: 'linear-gradient(135deg, #dc3545 0%, #bb2d3b 100%)',
                      boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
                    }}
                  >
                    <i className="bi bi-gear-fill text-white" style={{ fontSize: '1.5rem' }}></i>
                  </div>
                </div>
                <div className="flex-grow-1">
                  <h5 className="mb-1 fw-semibold">System Setup</h5>
                  <p className="text-muted small mb-0" style={{ lineHeight: '1.5' }}>
                    Initialize database collections, bootstrap teams, and configure system settings
                  </p>
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => router.push('/admin/system-setup')}
                className="w-100"
                style={{ fontWeight: '500' }}
              >
                <i className="bi bi-box-arrow-in-right me-2"></i>
                Access System Setup
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card
            className="border-0 shadow-sm h-100 position-relative overflow-hidden"
            style={{
              transition: 'all 0.3s ease',
              borderLeft: '4px solid #054653'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(5px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(37, 99, 235, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div
              className="position-absolute top-0 end-0"
              style={{ fontSize: '6rem', marginTop: '-1rem', marginRight: '-1rem', opacity: '0.03' }}
            >
              <i className="bi bi-person-plus-fill"></i>
            </div>
            <Card.Body className="position-relative">
              <div className="d-flex align-items-start mb-3">
                <div className="me-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{
                      width: '56px',
                      height: '56px',
                      background: 'linear-gradient(135deg, #054653 0%, #1d4ed8 100%)',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                    }}
                  >
                    <i className="bi bi-person-plus-fill text-white" style={{ fontSize: '1.5rem' }}></i>
                  </div>
                </div>
                <div className="flex-grow-1">
                  <h5 className="mb-1 fw-semibold">User Management</h5>
                  <p className="text-muted small mb-0" style={{ lineHeight: '1.5' }}>
                    View all users, edit details, manage roles, and configure permissions
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push('/admin/users')}
                className="w-100"
                style={{ fontWeight: '500' }}
              >
                <i className="bi bi-people me-2"></i>
                Manage Users
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card
            className="border-0 shadow-sm h-100 position-relative overflow-hidden"
            style={{
              transition: 'all 0.3s ease',
              borderLeft: '4px solid #0dcaf0',
              opacity: 0.7
            }}
          >
            <div
              className="position-absolute top-0 end-0"
              style={{ fontSize: '6rem', marginTop: '-1rem', marginRight: '-1rem', opacity: '0.03' }}
            >
              <i className="bi bi-file-text-fill"></i>
            </div>
            <Card.Body className="position-relative">
              <div className="d-flex align-items-start mb-3">
                <div className="me-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{
                      width: '56px',
                      height: '56px',
                      background: 'linear-gradient(135deg, #0dcaf0 0%, #0aa2c0 100%)',
                      boxShadow: '0 4px 12px rgba(13, 202, 240, 0.3)'
                    }}
                  >
                    <i className="bi bi-file-text-fill text-white" style={{ fontSize: '1.5rem' }}></i>
                  </div>
                </div>
                <div className="flex-grow-1">
                  <h5 className="mb-1 fw-semibold">Activity Logs</h5>
                  <p className="text-muted small mb-0" style={{ lineHeight: '1.5' }}>
                    View system activity, audit trails, and user actions
                  </p>
                </div>
              </div>
              <Button
                variant="info"
                size="sm"
                disabled
                className="w-100"
                style={{ fontWeight: '500' }}
              >
                <i className="bi bi-clock-history me-2"></i>
                Coming Soon
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* User Management Call-to-Action */}
      <Card className="border-0 shadow-sm">
        <Card.Body className="text-center py-5">
          <div className="mb-4">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
              style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)',
                boxShadow: '0 4px 20px rgba(5, 70, 83, 0.3)'
              }}
            >
              <i className="bi bi-people-fill text-white" style={{ fontSize: '2.5rem' }}></i>
            </div>
          </div>
          <h4 className="mb-3 fw-bold" style={{ color: '#054653' }}>
            <i className="bi bi-people-fill me-2"></i>
            User Management
          </h4>
          <p className="text-muted mb-4" style={{ maxWidth: '600px', margin: '0 auto' }}>
            Manage all system users, assign roles, control permissions, and monitor user activity from the dedicated user management interface.
          </p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push('/admin/users')}
              style={{
                fontWeight: '500',
                padding: '0.75rem 2rem',
                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.25)'
              }}
            >
              <i className="bi bi-arrow-right-circle me-2"></i>
              Go to User Management
            </Button>
            <Button
              variant="outline-primary"
              size="lg"
              onClick={() => router.push('/admin/users/new')}
              style={{
                fontWeight: '500',
                padding: '0.75rem 2rem'
              }}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Create New User
            </Button>
          </div>

          {/* Quick Stats Summary */}
          <Row className="mt-5 g-3">
            <Col md={3}>
              <div className="p-3 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                <div className="fw-semibold text-muted small mb-1">Total Users</div>
                <h3 className="mb-0 fw-bold" style={{ color: '#054653' }}>{stats.totalUsers}</h3>
              </div>
            </Col>
            <Col md={3}>
              <div className="p-3 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                <div className="fw-semibold text-muted small mb-1">Active Users</div>
                <h3 className="mb-0 fw-bold" style={{ color: '#198754' }}>{stats.activeUsers}</h3>
              </div>
            </Col>
            <Col md={3}>
              <div className="p-3 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                <div className="fw-semibold text-muted small mb-1">Staff Members</div>
                <h3 className="mb-0 fw-bold" style={{ color: '#054653' }}>
                  {users.filter(u => Array.isArray(u.role) ? u.role.includes('staff') : u.role === 'staff').length}
                </h3>
              </div>
            </Col>
            <Col md={3}>
              <div className="p-3 rounded" style={{ backgroundColor: '#f8f9fa' }}>
                <div className="fw-semibold text-muted small mb-1">Clients</div>
                <h3 className="mb-0 fw-bold" style={{ color: '#0dcaf0' }}>
                  {users.filter(u => Array.isArray(u.role) ? u.role.includes('client') : u.role === 'client').length}
                </h3>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </AppLayout>
  );
}

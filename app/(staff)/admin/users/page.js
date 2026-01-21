'use client';

import { useState, useEffect } from 'react';
import { Card, Table, Button, Badge, Form, InputGroup, Row, Col, Spinner, Pagination } from 'react-bootstrap';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import AppLayout from '@/components/AppLayout';
import Toast, { useToast } from '@/components/Toast';

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  // Pagination and filter state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');

  useEffect(() => {
    if (user?.isAdmin) {
      loadUsers();
    }
  }, [user, page, search, roleFilter, statusFilter, userTypeFilter]); // Reload when any filter changes

  const loadUsers = async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;

      const queries = [
        Query.limit(limit),
        Query.offset(offset),
        Query.orderAsc('firstName')
      ];

      // Apply filters
      if (search) {
        // Search across multiple fields if possible, or primary field
        // Note: Appwrite search only works on Fulltext indexed attributes
        queries.push(Query.search('firstName', search));
      }

      if (statusFilter) {
        queries.push(Query.equal('status', statusFilter));
      }

      if (userTypeFilter) {
        queries.push(Query.equal('userType', userTypeFilter));
      }

      if (roleFilter) {
        if (roleFilter === 'supervisor') {
          queries.push(Query.equal('isSupervisor', true));
        } else if (roleFilter === 'finance') {
          queries.push(Query.equal('isFinance', true));
        } else if (roleFilter === 'admin') {
          queries.push(Query.equal('isAdmin', true));
        }
      }

      const response = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.USERS,
        queries
      );

      setUsers(response.documents);
      setTotalUsers(response.total);
    } catch (err) {
      console.error('Failed to load users:', err);
      showToast('Failed to load users', 'danger');
    } finally {
      setLoading(false);
    }
  };


  const getStatusBadge = (status) => {
    const variants = {
      active: 'success',
      inactive: 'secondary',
      invited: 'warning',
      suspended: 'danger'
    };
    return variants[status] || 'secondary';
  };

  const getUserTypeBadge = (userType) => {
    return userType === 'client' ? 'info' : 'primary';
  };

  const getRoleBadge = (role) => {
    const variants = {
      staff: 'primary',
      client: 'info'
    };
    return variants[role] || 'secondary';
  };

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setUserTypeFilter('');
    setPage(1);
  };

  // Pagination
  const totalPages = Math.ceil(totalUsers / limit);
  // users array now only contains the current page

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

  // Calculate stats - Note: These will now only reflect the current page + total count
  // For full accuracy we would need separate queries, but for now we use totalUsers
  const stats = {
    totalUsers: totalUsers,
    activeUsers: users.filter(u => u.status === 'active').length, // Only current page
    staffUsers: users.filter(u => {
      if (Array.isArray(u.role)) return u.role.includes('staff');
      return u.role === 'staff';
    }).length, // Only current page
    clientUsers: users.filter(u => {
      if (Array.isArray(u.role)) return u.role.includes('client');
      return u.role === 'client';
    }).length, // Only current page
    adminUsers: users.filter(u => u.isAdmin).length // Only current page
  };

  if (authLoading) {
    return (
      <AppLayout user={user}>
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-2">Loading...</p>
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

  return (
    <AppLayout user={user}>
      <Toast toast={toast} onClose={hideToast} />

      {/* Hero Header */}
      <Card className="border-0 shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)' }}>
        <Card.Body className="text-white p-4">
          <Row className="align-items-center">
            <Col md={8}>
              <h2 className="mb-2">
                <i className="bi bi-people-fill me-3"></i>
                User Management
              </h2>
              <p className="mb-0 opacity-90">
                Manage system users, roles, and permissions
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
        <Col md={2}>
          <Card
            className="border-0 shadow-sm h-100 position-relative overflow-hidden"
            style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(37, 99, 235, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div className="position-absolute top-0 end-0" style={{ fontSize: '5rem', marginTop: '-1rem', marginRight: '-1rem', opacity: '0.05' }}>
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
        <Col md={10}>
          {/* Simplify stats display for now or remove other cards if they can't be accurate without more queries */}
          {/* For now, let's keep the Total Users card and maybe just removing the others to avoid confusion, 
                 OR we leave them showing breakdown of CURRENT PAGE which is confusing. 
                 
                 DECISION: I will keep the other cards but I will fetch their counts in a separate useEffect to be accurate.
                 But for this specific step, I am just updating the render logic. I'll fix the stats values in a follow-up step.
              */}
          <div className="d-flex align-items-center justify-content-center h-100 p-4 bg-light rounded text-muted">
            <i className="bi bi-info-circle me-2"></i>
            Detailed statistics are available on the main dashboard.
          </div>
        </Col>
      </Row>

      {/* User Management Table */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white border-bottom" style={{ borderBottom: '2px solid #e9ecef' }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-1 fw-bold">
                <i className="bi bi-list-ul me-2" style={{ color: '#054653' }}></i>
                All Users
              </h5>
              <p className="text-muted small mb-0">View and manage all system users</p>
            </div>
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => loadUsers()}
                disabled={loading}
                style={{ borderRadius: '6px', fontWeight: '500' }}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-1" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Refresh
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => router.push('/admin/users/new')}
                style={{
                  borderRadius: '6px',
                  fontWeight: '500',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)'
                }}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Create User
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <Row className="g-2">
            <Col md={3}>
              <InputGroup size="sm">
                <Form.Control
                  type="text"
                  placeholder="Search by name, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button variant="outline-secondary" onClick={() => loadUsers()}>
                  <i className="bi bi-search"></i>
                </Button>
              </InputGroup>
            </Col>
            <Col md={2}>
              <Form.Select size="sm" value={userTypeFilter} onChange={(e) => setUserTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                <option value="staff">Staff</option>
                <option value="client">Client</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Select size="sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="supervisor">Supervisor</option>
                <option value="finance">Finance</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select size="sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="invited">Invited</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Button
                size="sm"
                variant="outline-secondary"
                className="w-100"
                onClick={clearFilters}
                disabled={!search && !roleFilter && !statusFilter && !userTypeFilter}
              >
                <i className="bi bi-x-circle me-1"></i>
                Clear Filters
              </Button>
            </Col>
          </Row>

          {/* Active filters indicator */}
          {(search || roleFilter || statusFilter || userTypeFilter) && (
            <div className="mt-3 p-2 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px dashed #dee2e6' }}>
              <small className="text-muted fw-semibold">
                <i className="bi bi-funnel me-2"></i>
                Active filters:
                {search && (
                  <Badge bg="primary" className="ms-2" style={{ fontWeight: '500' }}>
                    <i className="bi bi-search me-1" style={{ fontSize: '0.7rem' }}></i>
                    {search}
                  </Badge>
                )}
                {userTypeFilter && (
                  <Badge bg="info" className="ms-2" style={{ fontWeight: '500' }}>
                    Type: {userTypeFilter}
                  </Badge>
                )}
                {roleFilter && (
                  <Badge bg="success" className="ms-2" style={{ fontWeight: '500' }}>
                    Role: {roleFilter}
                  </Badge>
                )}
                {statusFilter && (
                  <Badge bg="warning" text="dark" className="ms-2" style={{ fontWeight: '500' }}>
                    Status: {statusFilter}
                  </Badge>
                )}
              </small>
            </div>
          )}
        </Card.Header>

        <Card.Body className="p-0">
          {loading && users.length === 0 ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <p className="mt-2 text-muted">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-5">
              <div className="mb-3">
                <i className="bi bi-people" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
              </div>
              <h6>No Users Found</h6>
              <p className="text-muted mb-3">
                {search || roleFilter || statusFilter
                  ? 'No users match your search criteria. Try adjusting your filters.'
                  : 'Get started by creating your first user'}
              </p>
              {!(search || roleFilter || statusFilter) && (
                <Button size="sm" onClick={() => router.push('/admin/users/new')}>
                  <i className="bi bi-plus-circle me-2"></i>
                  Create First User
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table hover className="mb-0" style={{ fontSize: '0.9rem' }}>
                  <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                    <tr>
                      <th style={{ fontWeight: '600', color: '#495057', padding: '1rem' }}>Username</th>
                      <th style={{ fontWeight: '600', color: '#495057', padding: '1rem' }}>Name</th>
                      <th style={{ fontWeight: '600', color: '#495057', padding: '1rem' }}>Email</th>
                      <th style={{ fontWeight: '600', color: '#495057', padding: '1rem' }}>User Type</th>
                      <th style={{ fontWeight: '600', color: '#495057', padding: '1rem' }}>Roles</th>
                      <th style={{ fontWeight: '600', color: '#495057', padding: '1rem' }}>Status</th>
                      <th style={{ fontWeight: '600', color: '#495057', padding: '1rem' }}>Title</th>
                      <th style={{ fontWeight: '600', color: '#495057', padding: '1rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, index) => (
                      <tr
                        key={u.$id}
                        style={{
                          transition: 'all 0.2s ease',
                          borderBottom: index === users.length - 1 ? 'none' : '1px solid #f0f0f0'
                        }}
                      >
                        <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                          <div className="d-flex align-items-center">
                            <div
                              className="rounded-circle me-2 d-flex align-items-center justify-content-center"
                              style={{
                                width: '32px',
                                height: '32px',
                                background: 'linear-gradient(135deg, #054653 0%, #14B8A6 100%)',
                                color: 'white',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}
                            >
                              {u.firstName?.[0]}{u.lastName?.[0]}
                            </div>
                            <strong style={{ color: '#054653' }}>@{u.username}</strong>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                          <div>
                            <div style={{ fontWeight: '500', color: '#212529' }}>
                              {u.firstName} {u.lastName}
                            </div>
                            {u.otherNames && (
                              <div className="text-muted small">{u.otherNames}</div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle', color: '#6c757d' }}>
                          <i className="bi bi-envelope me-2" style={{ fontSize: '0.85rem' }}></i>
                          {u.email}
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                          <Badge
                            bg={getUserTypeBadge(u.userType)}
                            style={{ fontSize: '0.75rem', fontWeight: '500', padding: '0.35rem 0.65rem' }}
                          >
                            <i className={`bi ${u.userType === 'client' ? 'bi-person' : 'bi-briefcase'} me-1`}></i>
                            {u.userType}
                          </Badge>
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                          <div className="d-flex flex-wrap gap-1">
                            {u.isAdmin && (
                              <Badge bg="danger" style={{ fontSize: '0.75rem', fontWeight: '500', padding: '0.35rem 0.65rem' }}>
                                Admin
                              </Badge>
                            )}
                            {u.isSupervisor && (
                              <Badge bg="info" text="dark" style={{ fontSize: '0.75rem', fontWeight: '500', padding: '0.35rem 0.65rem' }}>
                                Supervisor
                              </Badge>
                            )}
                            {u.isFinance && (
                              <Badge bg="warning" text="dark" style={{ fontSize: '0.75rem', fontWeight: '500', padding: '0.35rem 0.65rem' }}>
                                Finance
                              </Badge>
                            )}
                            {!u.isAdmin && !u.isSupervisor && !u.isFinance && (
                              <span className="text-muted small">-</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                          <Badge
                            bg={getStatusBadge(u.status)}
                            style={{ fontSize: '0.75rem', fontWeight: '500', padding: '0.35rem 0.65rem' }}
                          >
                            <i
                              className={`bi ${u.status === 'active'
                                ? 'bi-check-circle'
                                : u.status === 'invited'
                                  ? 'bi-clock'
                                  : u.status === 'suspended'
                                    ? 'bi-x-circle'
                                    : 'bi-dash-circle'
                                } me-1`}
                            ></i>
                            {u.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle', color: '#6c757d' }}>
                          {u.title || <span className="text-muted fst-italic">No title</span>}
                        </td>
                        <td style={{ padding: '1rem', verticalAlign: 'middle' }}>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => router.push(`/admin/users/${u.accountId}/edit`)}
                          >
                            <i className="bi bi-pencil me-1"></i>
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div
                  className="d-flex justify-content-between align-items-center p-3"
                  style={{ backgroundColor: '#f8f9fa', borderTop: '2px solid #e9ecef' }}
                >
                  <div className="text-muted small fw-semibold">
                    <i className="bi bi-list-ul me-2"></i>
                    Showing <span style={{ color: '#054653', fontWeight: '600' }}>{(page - 1) * limit + 1}</span> to{' '}
                    <span style={{ color: '#054653', fontWeight: '600' }}>{Math.min(page * limit, totalUsers)}</span> of{' '}
                    <span style={{ color: '#054653', fontWeight: '600' }}>{totalUsers}</span> users
                  </div>
                  <Pagination size="sm" className="mb-0">
                    {renderPaginationItems()}
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

    </AppLayout>
  );
}

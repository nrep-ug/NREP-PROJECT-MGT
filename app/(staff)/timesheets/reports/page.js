'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Row, Col, Card, Button, Form, Table, Badge, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import moment from 'moment-timezone';

// Lazy load chart wrapper components to reduce initial bundle size
const ProjectBarChart = lazy(() => import('@/components/charts/ProjectBarChart'));
const UserBarChart = lazy(() => import('@/components/charts/UserBarChart'));

const TrendsLineChart = lazy(() => import('@/components/charts/TrendsLineChart'));

// Chart loading fallback component
const ChartLoader = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
    <Spinner animation="border" variant="primary" />
  </div>
);

/**
 * Timesheet Reports & Analytics Dashboard
 *
 * Role-based access (per RBAC_ARCHITECTURE.md):
 * - Admin (label: 'admin'): See all timesheets from all projects and all staff
 * - Manager (project team role: 'manager'): See timesheets from projects they manage + their own
 * - Staff (label: 'staff'): See only their own timesheets
 *
 * Note: Manager role is determined by the API by checking project team memberships.
 *       The userRole returned from API will be 'admin', 'manager', or 'staff'.
 */
export default function TimesheetReportsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  const [roleInfo, setRoleInfo] = useState(null); // Store isAdmin, isManager, managedProjectsCount
  const [initialLoad, setInitialLoad] = useState(true);

  // Filter state (for UI controls)
  const [startDate, setStartDate] = useState(
    moment().subtract(30, 'days').format('YYYY-MM-DD')
  );
  const [endDate, setEndDate] = useState(moment().format('YYYY-MM-DD'));
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedUser, setSelectedUser] = useState('');

  // Applied filters state (what's actually being used for the query)
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    endDate: moment().format('YYYY-MM-DD'),
    selectedProject: '',
    selectedUser: ''
  });

  // Data state
  const [summaryData, setSummaryData] = useState(null);
  const [projectData, setProjectData] = useState([]);
  const [userData, setUserData] = useState([]);
  const [trendsData, setTrendsData] = useState([]);
  const [projects, setProjects] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

  // Role detection:
  // - isAdmin comes from labels (user.isAdmin checks if 'admin' is in labels)
  // - Manager role is NOT in labels - it's determined by the API by checking project team memberships
  // - API returns the effective role: 'admin', 'manager', or 'staff' in the response
  const isAdmin = user?.isAdmin || false;
  const isManager = roleInfo?.isManager || false;

  useEffect(() => {
    if (user?.organizationId && user?.authUser?.$id) {
      loadProjects();
      loadAccounts();
      // Load reports with default filters on initial load only
      if (initialLoad) {
        loadReports();
        setInitialLoad(false);
      }
    }
  }, [user]);

  const loadProjects = async () => {
    try {
      const response = await fetch(`/api/projects?organizationId=${user.organizationId}`);
      const data = await response.json();
      if (response.ok) {
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await fetch(`/api/accounts?organizationId=${user.organizationId}`);
      const data = await response.json();
      if (response.ok) {
        setAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error('Error loading accounts:', err);
    }
  };

  const loadReports = async (filters = appliedFilters) => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        accountId: user.authUser.$id,
        organizationId: user.organizationId,
        labels: JSON.stringify(user.labels || []),
        startDate: filters.startDate,
        endDate: filters.endDate
      });

      if (filters.selectedProject) params.append('projectId', filters.selectedProject);
      if (filters.selectedUser) params.append('userId', filters.selectedUser);

      // Load summary
      const summaryRes = await fetch(`/api/timesheets/reports?${params.toString()}&type=summary`);
      const summaryJson = await summaryRes.json();
      if (!summaryRes.ok) throw new Error(summaryJson.error);
      setSummaryData(summaryJson.data);
      const apiRole = summaryJson.role; // 'admin', 'manager', or 'staff'
      setUserRole(apiRole);

      // Store additional role information
      setRoleInfo({
        isAdmin: summaryJson.isAdmin || false,
        isManager: summaryJson.isManager || false,
        managedProjectsCount: summaryJson.managedProjectsCount || 0,
        managedProjects: summaryJson.managedProjects || []
      });

      // Load by-project data
      const projectRes = await fetch(`/api/timesheets/reports?${params.toString()}&type=by-project`);
      const projectJson = await projectRes.json();
      if (!projectRes.ok) throw new Error(projectJson.error);
      setProjectData(projectJson.data);

      // Load by-user data (only for admin and manager, determined by API)
      if (apiRole === 'admin' || apiRole === 'manager') {
        const userRes = await fetch(`/api/timesheets/reports?${params.toString()}&type=by-user`);
        const userJson = await userRes.json();
        if (!userRes.ok) throw new Error(userJson.error);
        setUserData(userJson.data);
      }

      // Load trends
      const trendsRes = await fetch(`/api/timesheets/reports?${params.toString()}&type=trends`);
      const trendsJson = await trendsRes.json();
      if (!trendsRes.ok) throw new Error(trendsJson.error);
      setTrendsData(trendsJson.data);

    } catch (err) {
      console.error('Error loading reports:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = async () => {
    // Update applied filters and trigger report reload with new filters
    const newFilters = {
      startDate,
      endDate,
      selectedProject,
      selectedUser
    };
    setAppliedFilters(newFilters);
    setLoading(true); // Show loading spinner
    await loadReports(newFilters);
  };

  const handleExport = async (type) => {
    try {
      const params = new URLSearchParams({
        accountId: user.authUser.$id,
        organizationId: user.organizationId,
        labels: JSON.stringify(user.labels || []),
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
        type,
        export: 'csv'
      });

      if (appliedFilters.selectedProject) params.append('projectId', appliedFilters.selectedProject);
      if (appliedFilters.selectedUser) params.append('userId', appliedFilters.selectedUser);

      const response = await fetch(`/api/timesheets/reports?${params.toString()}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timesheet-report-${type}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting:', err);
      alert('Failed to export report');
    }
  };

  const handleResetFilters = async () => {
    const defaultStartDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
    const defaultEndDate = moment().format('YYYY-MM-DD');

    // Reset UI state
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    setSelectedProject('');
    setSelectedUser('');

    // Apply the reset filters immediately
    const resetFilters = {
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      selectedProject: '',
      selectedUser: ''
    };
    setAppliedFilters(resetFilters);
    setLoading(true); // Show loading spinner
    await loadReports(resetFilters);
  };

  if (authLoading || (loading && !summaryData)) {
    return (
      <AppLayout user={user}>
        <Container className="py-4">
          <div className="text-center">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </Container>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user}>
      <Container fluid className="py-4 px-3 px-md-4">
        {/* Header */}
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <h2>Timesheet Reports & Analytics</h2>
                <p className="text-muted mb-0">
                  {userRole === 'admin' && 'Viewing all organization timesheets'}
                  {userRole === 'manager' && 'Viewing managed projects and your timesheets'}
                  {userRole === 'staff' && 'Viewing your timesheets'}
                  {userRole && (
                    <Badge bg="info" className="ms-2">
                      {userRole.toUpperCase()}
                    </Badge>
                  )}
                  {roleInfo?.isAdmin && roleInfo?.isManager && roleInfo?.managedProjectsCount > 0 && (
                    <Badge bg="success" className="ms-2">
                      Managing {roleInfo.managedProjectsCount} {roleInfo.managedProjectsCount === 1 ? 'Project' : 'Projects'}
                    </Badge>
                  )}
                </p>
              </div>
              <div className="d-flex gap-2">
                <Button variant="outline-info" size="sm" onClick={() => router.push('/timesheets/templates')}>
                  <i className="bi bi-lightning-charge me-2"></i>
                  Templates
                </Button>
                <Button variant="outline-secondary" onClick={() => router.push('/timesheets')}>
                  <i className="bi bi-arrow-left me-2"></i>
                  Back to Timesheets
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Filters */}
        <Card className="mb-4">
          <Card.Body>
            <Row className="g-3 align-items-end">
              <Col xs={12} md={6} lg={3}>
                <Form.Group>
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Form.Group>
              </Col>

              <Col xs={12} md={6} lg={3}>
                <Form.Group>
                  <Form.Label>End Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </Form.Group>
              </Col>

              <Col xs={12} md={6} lg={2}>
                <Form.Group>
                  <Form.Label>Project</Form.Label>
                  <Form.Select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                  >
                    <option value="">All Projects</option>
                    {projects.map(project => (
                      <option key={project.$id} value={project.$id}>
                        {project.code}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              {(userRole === 'admin' || userRole === 'manager') && (
                <Col xs={12} md={6} lg={2}>
                  <Form.Group>
                    <Form.Label>User</Form.Label>
                    <Form.Select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                    >
                      <option value="">All Users</option>
                      {accounts.map(account => (
                        <option key={account.$id} value={account.accountId}>
                          {account.firstName} {account.lastName}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              )}

              <Col xs={12} md={6} lg={2}>
                <Button
                  variant="primary"
                  onClick={handleApplyFilters}
                  className="w-100"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Loading...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-funnel-fill me-2"></i>
                      Apply Filters
                    </>
                  )}
                </Button>
              </Col>

              <Col xs={12} md={6} lg={2}>
                <Button
                  variant="outline-secondary"
                  onClick={handleResetFilters}
                  className="w-100"
                  disabled={loading}
                >
                  <i className="bi bi-arrow-counterclockwise me-2"></i>
                  Reset
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Active Filters Info */}
        {(appliedFilters.selectedUser || appliedFilters.selectedProject) && (
          <Alert variant="info" className="mb-3">
            <div className="d-flex align-items-center">
              <i className="bi bi-funnel me-2"></i>
              <div>
                <strong>Active Filters:</strong>
                {appliedFilters.selectedUser && (
                  <span className="ms-2">
                    <Badge bg="primary" className="me-1">
                      User: {(() => {
                        const user = accounts.find(a => a.accountId === appliedFilters.selectedUser);
                        return user ? `${user.firstName} ${user.lastName}` : 'Selected User';
                      })()}
                    </Badge>
                  </span>
                )}
                {appliedFilters.selectedProject && (
                  <span className="ms-2">
                    <Badge bg="secondary">
                      Project: {projects.find(p => p.$id === appliedFilters.selectedProject)?.code || 'Selected Project'}
                    </Badge>
                  </span>
                )}
              </div>
            </div>
          </Alert>
        )}

        {/* Loading Overlay */}
        {loading && summaryData && (
          <div className="position-relative mb-3">
            <Alert variant="light" className="text-center py-4">
              <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span className="text-muted">Applying filters...</span>
            </Alert>
          </div>
        )}

        {summaryData && !loading && (
          <>
            {/* User-Specific View - Show when user filter is active */}
            {appliedFilters.selectedUser && userData.length > 0 && (
              <Card className="mb-4 border-primary">
                <Card.Header className="bg-primary text-white">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <i className="bi bi-person-circle me-2"></i>
                      <strong>User Report: {userData[0].userName}</strong>
                    </div>
                    <Button
                      variant="light"
                      size="sm"
                      onClick={() => handleExport('by-user')}
                    >
                      <i className="bi bi-download me-1"></i>
                      Export
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col xs={6} md={3}>
                      <div className="text-center">
                        <div className="text-muted small mb-1">Total Hours</div>
                        <h4 className="mb-0 text-primary">{userData[0].totalHours}h</h4>
                      </div>
                    </Col>
                    <Col xs={6} md={3}>
                      <div className="text-center">
                        <div className="text-muted small mb-1">Billable Hours</div>
                        <h4 className="mb-0 text-success">{userData[0].billableHours}h</h4>
                      </div>
                    </Col>
                    <Col xs={6} md={3}>
                      <div className="text-center">
                        <div className="text-muted small mb-1">Projects Worked</div>
                        <h4 className="mb-0 text-info">{userData[0].projects}</h4>
                      </div>
                    </Col>
                    <Col xs={6} md={3}>
                      <div className="text-center">
                        <div className="text-muted small mb-1">Total Entries</div>
                        <h4 className="mb-0 text-secondary">{userData[0].entries}</h4>
                      </div>
                    </Col>
                  </Row>
                  <div className="mt-3 text-center">
                    <Badge bg="success" className="px-3 py-2">
                      {userData[0].billablePercentage}% Billable
                    </Badge>
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Summary Cards */}
            <Row className="g-3 mb-4">
              <Col xs={6} md={3}>
                <Card className="h-100">
                  <Card.Body>
                    <div className="text-muted small mb-1">Total Hours</div>
                    <h3 className="mb-0">{summaryData.summary.totalHours}h</h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={6} md={3}>
                <Card className="h-100">
                  <Card.Body>
                    <div className="text-muted small mb-1">Billable %</div>
                    <h3 className="mb-0 text-success">
                      {summaryData.summary.billablePercentage}%
                    </h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={6} md={3}>
                <Card className="h-100">
                  <Card.Body>
                    <div className="text-muted small mb-1">
                      {userRole === 'staff' ? 'Projects' : 'Team Members'}
                    </div>
                    <h3 className="mb-0">
                      {userRole === 'staff' ? summaryData.summary.uniqueProjects : summaryData.summary.uniqueUsers}
                    </h3>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={6} md={3}>
                <Card className="h-100">
                  <Card.Body>
                    <div className="text-muted small mb-1">
                      {userRole === 'staff' ? 'Total Entries' : 'Projects'}
                    </div>
                    <h3 className="mb-0">
                      {userRole === 'staff' ? summaryData.summary.totalEntries : summaryData.summary.uniqueProjects}
                    </h3>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Additional Stats */}
            <Row className="g-3 mb-4">
              <Col xs={6} md={3}>
                <Card className="h-100">
                  <Card.Body>
                    <div className="text-muted small mb-1">Billable Hours</div>
                    <div className="h5 mb-0 text-success">
                      {summaryData.summary.billableHours}h
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={6} md={3}>
                <Card className="h-100">
                  <Card.Body>
                    <div className="text-muted small mb-1">Non-Billable Hours</div>
                    <div className="h5 mb-0 text-secondary">
                      {summaryData.summary.nonBillableHours}h
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={6} md={3}>
                <Card className="h-100">
                  <Card.Body>
                    <div className="text-muted small mb-1">This Week</div>
                    <div className="h5 mb-0">{summaryData.summary.thisWeekHours}h</div>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={6} md={3}>
                <Card className="h-100">
                  <Card.Body>
                    <div className="text-muted small mb-1">This Month</div>
                    <div className="h5 mb-0">{summaryData.summary.thisMonthHours}h</div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Charts */}
            <Row className="g-3 mb-4">
              {/* Hours by Project - Bar Chart */}
              <Col xs={12} lg={6}>
                <Card>
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <strong>Hours by Project</strong>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => handleExport('by-project')}
                    >
                      Export CSV
                    </Button>
                  </Card.Header>
                  <Card.Body>
                    {projectData.length > 0 ? (
                      <Suspense fallback={<ChartLoader />}>
                        <ProjectBarChart data={projectData} />
                      </Suspense>
                    ) : (
                      <div className="text-center text-muted py-5">No data available</div>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              {/* Hours by User - Bar Chart (Admin and Manager only) */}
              {(isAdmin || isManager) && (
                <Col xs={12} lg={6}>
                  <Card>
                    <Card.Header className="d-flex justify-content-between align-items-center">
                      <strong>Hours by User</strong>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleExport('by-user')}
                      >
                        Export CSV
                      </Button>
                    </Card.Header>
                    <Card.Body>
                      {userData.length > 0 ? (
                        <Suspense fallback={<ChartLoader />}>
                          <UserBarChart data={userData} />
                        </Suspense>
                      ) : (
                        <div className="text-center text-muted py-5">No data available</div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              )}

              {/* Billable vs Non-Billable - Pie Chart */}


              {/* Weekly Trends - Line Chart */}
              <Col xs={12}>
                <Card>
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <strong>Weekly Trends</strong>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => handleExport('trends')}
                    >
                      Export CSV
                    </Button>
                  </Card.Header>
                  <Card.Body>
                    {trendsData.length > 0 ? (
                      <Suspense fallback={<ChartLoader />}>
                        <TrendsLineChart data={trendsData} />
                      </Suspense>
                    ) : (
                      <div className="text-center text-muted py-5">No data available</div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Top Lists */}
            <Row className="g-3 mb-4">
              {/* Top Projects */}
              <Col xs={12} md={6}>
                <Card>
                  <Card.Header>
                    <strong>Top Projects by Hours</strong>
                  </Card.Header>
                  <Card.Body>
                    {summaryData.topProjects.length > 0 ? (
                      <Table hover size="sm">
                        <thead>
                          <tr>
                            <th>Project</th>
                            <th className="text-end">Hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryData.topProjects.map((proj, idx) => (
                            <tr key={idx}>
                              <td>{proj.projectName}</td>
                              <td className="text-end">
                                <Badge bg="primary">{proj.hours}h</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <div className="text-center text-muted py-3">No data available</div>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              {/* Top Users (Admin and Manager only) */}
              {(isAdmin || isManager) && (
                <Col xs={12} md={6}>
                  <Card>
                    <Card.Header>
                      <strong>Top Users by Hours</strong>
                    </Card.Header>
                    <Card.Body>
                      {summaryData.topUsers.length > 0 ? (
                        <Table hover size="sm">
                          <thead>
                            <tr>
                              <th>User</th>
                              <th className="text-end">Hours</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaryData.topUsers.map((usr, idx) => (
                              <tr key={idx}>
                                <td>{usr.userName}</td>
                                <td className="text-end">
                                  <Badge bg="info">{usr.hours}h</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      ) : (
                        <div className="text-center text-muted py-3">No data available</div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              )}
            </Row>

            {/* Detailed Tables */}
            <Row className="g-3">
              {/* Project Details Table */}
              <Col xs={12}>
                <Card>
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <strong>Project Details</strong>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => handleExport('by-project')}
                    >
                      Export CSV
                    </Button>
                  </Card.Header>
                  <Card.Body>
                    {projectData.length > 0 ? (
                      <div className="table-responsive">
                        <Table hover size="sm">
                          <thead>
                            <tr>
                              <th>Project</th>
                              <th className="text-end">Total Hours</th>
                              <th className="text-end">Billable Hours</th>
                              <th className="text-end">Non-Billable</th>
                              <th className="text-end">Billable %</th>
                              <th className="text-end">Entries</th>
                              {(isAdmin || isManager) && <th className="text-end">Users</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {projectData.map((proj, idx) => (
                              <tr key={idx}>
                                <td>{proj.projectName}</td>
                                <td className="text-end">{proj.totalHours}h</td>
                                <td className="text-end text-success">{proj.billableHours}h</td>
                                <td className="text-end text-secondary">{proj.nonBillableHours}h</td>
                                <td className="text-end">{proj.billablePercentage}%</td>
                                <td className="text-end">{proj.entries}</td>
                                {(isAdmin || isManager) && <td className="text-end">{proj.users}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center text-muted py-3">No data available</div>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              {/* User Details Table (Admin and Manager only) */}
              {(isAdmin || isManager) && (
                <Col xs={12}>
                  <Card>
                    <Card.Header className="d-flex justify-content-between align-items-center">
                      <strong>User Details</strong>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleExport('by-user')}
                      >
                        Export CSV
                      </Button>
                    </Card.Header>
                    <Card.Body>
                      {userData.length > 0 ? (
                        <div className="table-responsive">
                          <Table hover size="sm">
                            <thead>
                              <tr>
                                <th>User</th>
                                <th className="text-end">Total Hours</th>
                                <th className="text-end">Billable Hours</th>
                                <th className="text-end">Non-Billable</th>
                                <th className="text-end">Billable %</th>
                                <th className="text-end">Entries</th>
                                <th className="text-end">Projects</th>
                              </tr>
                            </thead>
                            <tbody>
                              {userData.map((usr, idx) => (
                                <tr key={idx}>
                                  <td>{usr.userName}</td>
                                  <td className="text-end">{usr.totalHours}h</td>
                                  <td className="text-end text-success">{usr.billableHours}h</td>
                                  <td className="text-end text-secondary">{usr.nonBillableHours}h</td>
                                  <td className="text-end">{usr.billablePercentage}%</td>
                                  <td className="text-end">{usr.entries}</td>
                                  <td className="text-end">{usr.projects}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center text-muted py-3">No data available</div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              )}
            </Row>
          </>
        )}
      </Container>
    </AppLayout>
  );
}

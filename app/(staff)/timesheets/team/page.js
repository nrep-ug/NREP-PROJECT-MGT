'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card,
    Table,
    Button,
    Badge,
    Alert,
    Row,
    Col,
    Form,
    InputGroup,
    ButtonGroup,
    Modal
} from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatHours } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function AllStaffTimesheetsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { toast, showToast, hideToast } = useToast();

    const [staff, setStaff] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [accessType, setAccessType] = useState('');
    const [supervisedCount, setSupervisedCount] = useState(0);
    const [currentWeekStart, setCurrentWeekStart] = useState('');
    const [availableViews, setAvailableViews] = useState([]);
    const [currentView, setCurrentView] = useState('');

    // Filters
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [weekFilter, setWeekFilter] = useState('');

    // CSV Export
    const [exporting, setExporting] = useState(false);

    // Bulk Reminders
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [sendingReminders, setSendingReminders] = useState(false);

    // Access control check
    useEffect(() => {
        if (!authLoading && user) {
            if (!user.isAdmin && !user.isFinance && !user.isSupervisor) {
                showToast('Access denied - you do not have permission to view this page', 'danger');
                router.push('/timesheets');
            }
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user?.organizationId) {
            loadStaffTimesheets();
        }
    }, [user, statusFilter, weekFilter, departmentFilter, searchQuery, currentView]);

    const loadStaffTimesheets = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                organizationId: user.organizationId,
                requesterId: user.authUser.$id,
                ...(currentView && { viewAs: currentView }),
                ...(statusFilter && { status: statusFilter }),
                ...(weekFilter && { weekStart: weekFilter }),
                ...(departmentFilter && { department: departmentFilter }),
                ...(searchQuery && { search: searchQuery })
            });

            const response = await fetch(`/api/timesheets/team?${params}`);
            const data = await response.json();

            if (response.ok) {
                setStaff(data.staff || []);
                setStatistics(data.statistics || null);
                setAccessType(data.accessType || '');
                setSupervisedCount(data.supervisedCount || 0);
                setCurrentWeekStart(data.weekStart || '');
                setAvailableViews(data.availableViews || []);

                // Set current view if not already set
                if (!currentView && data.availableViews && data.availableViews.length > 0) {
                    setCurrentView(data.accessType);
                }
            } else {
                showToast(data.error || 'Failed to load staff timesheets', 'danger');
            }
        } catch (err) {
            console.error('Failed to load staff timesheets:', err);
            showToast('Failed to load staff timesheets', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const handleViewChange = (newView) => {
        setCurrentView(newView);
    };

    const handleViewTimesheet = (staffMember) => {
        // Navigate to staff-specific timesheet page
        router.push(`/timesheets/staff/${staffMember.user.accountId}`);
    };

    const handleExportCSV = () => {
        try {
            setExporting(true);

            // Create CSV content
            const headers = [
                'Name',
                'Username',
                'Email',
                'Department',
                'Title',
                'Week',
                'Status',
                'Total Hours',
                'Billable Hours',
                'Non-Billable Hours',
                'Entries Count',
                'Submitted At'
            ];

            const rows = staff.map(s => [
                `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim(),
                s.user.username || '',
                s.user.email || '',
                s.user.department || '',
                s.user.title || '',
                currentWeekStart,
                s.currentWeekTimesheet?.status || 'none',
                s.currentWeekTimesheet?.totalHours?.toFixed(2) || '0',
                s.currentWeekTimesheet?.billableHours?.toFixed(2) || '0',
                s.currentWeekTimesheet?.nonBillableHours?.toFixed(2) || '0',
                s.currentWeekTimesheet?.entriesCount || '0',
                s.currentWeekTimesheet?.submittedAt || ''
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            // Create download link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `staff-timesheets-${currentWeekStart}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('CSV exported successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            showToast('Failed to export CSV', 'danger');
        } finally {
            setExporting(false);
        }
    };

    const handleSendReminders = async () => {
        try {
            setSendingReminders(true);

            // Get staff members without timesheets
            const staffWithoutTimesheets = staff.filter(s => !s.currentWeekTimesheet);

            if (staffWithoutTimesheets.length === 0) {
                showToast('All staff members have created timesheets!', 'info');
                setShowReminderModal(false);
                return;
            }

            // Send reminder request
            const response = await fetch('/api/timesheets/reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    weekStart: currentWeekStart,
                    staffIds: staffWithoutTimesheets.map(s => s.user.accountId),
                    organizationId: user.organizationId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send reminders');
            }

            showToast(
                `Reminder emails sent to ${staffWithoutTimesheets.length} staff member(s)!`,
                'success'
            );
            setShowReminderModal(false);
        } catch (error) {
            console.error('Reminder error:', error);
            showToast(error.message || 'Failed to send reminders', 'danger');
        } finally {
            setSendingReminders(false);
        }
    };

    const getStatusBadge = (status) => {
        const variants = {
            draft: 'secondary',
            submitted: 'warning',
            approved: 'success',
            rejected: 'danger',
            none: 'light'
        };
        const displayText = status === 'none' ? 'NO TIMESHEET' : status?.toUpperCase();
        return (
            <Badge bg={variants[status] || 'secondary'} text={status === 'none' ? 'dark' : 'white'}>
                {displayText}
            </Badge>
        );
    };

    const getAccessBadge = () => {
        // Use currentView if available, otherwise fall back to accessType
        const viewToCheck = currentView || accessType;

        if (viewToCheck === 'admin') {
            return <Badge bg="danger">Admin View - All Staff</Badge>;
        } else if (viewToCheck === 'finance') {
            return <Badge bg="info">Finance View - All Staff</Badge>;
        } else if (viewToCheck === 'supervisor') {
            return <Badge bg="primary">Supervisor View - {supervisedCount} Supervised Staff</Badge>;
        }
        return null;
    };

    if (authLoading || loading) {
        return (
            <AppLayout user={user}>
                <LoadingSpinner message="Loading staff timesheets..." />
            </AppLayout>
        );
    }

    // Get unique departments for filter
    const departments = [...new Set(staff.map(s => s.user.department).filter(Boolean))];

    const staffWithoutTimesheets = staff.filter(s => !s.currentWeekTimesheet);

    return (
        <AppLayout user={user}>
            <Toast toast={toast} onClose={hideToast} />

            {/* Header */}
            <div className="mb-4">
                <div className="d-flex justify-content-between align-items-start">
                    <div>
                        <h2>All Staff Timesheets</h2>
                        <p className="text-muted mb-2">
                            Monitor and manage timesheet submissions across your team
                        </p>
                        {getAccessBadge()}
                    </div>
                    <Button variant="outline-secondary" onClick={() => router.push('/timesheets')}>
                        <i className="bi bi-arrow-left me-2"></i>
                        Back to Dashboard
                    </Button>
                </div>
            </div>

            {/* View Switcher - Show if user has multiple views available */}
            {availableViews.length > 1 && (
                <Card className="mb-4 border-0 shadow-sm">
                    <Card.Body>
                        <Row className="align-items-center">
                            <Col md={4}>
                                <div className="d-flex align-items-center">
                                    <i className="bi bi-eye me-2 text-primary"></i>
                                    <strong>View As:</strong>
                                </div>
                            </Col>
                            <Col md={8}>
                                <ButtonGroup size="sm" className="w-100">
                                    {availableViews.map((view) => (
                                        <Button
                                            key={view.value}
                                            variant={currentView === view.value ? 'primary' : 'outline-primary'}
                                            onClick={() => handleViewChange(view.value)}
                                            className="flex-grow-1"
                                        >
                                            {view.label}
                                        </Button>
                                    ))}
                                </ButtonGroup>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
            )}

            {/* Statistics Dashboard */}
            {statistics && (
                <Row className="mb-4">
                    <Col md={3} className="mb-3">
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body className="text-center">
                                <div className="mb-2">
                                    <i className="bi bi-people text-primary" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                                <h3 className="mb-1">{statistics.totalStaff}</h3>
                                <div className="text-muted small">Total Staff</div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3} className="mb-3">
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body className="text-center">
                                <div className="mb-2">
                                    <i className="bi bi-check-circle text-success" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                                <h3 className="mb-1">{statistics.completionRate}%</h3>
                                <div className="text-muted small">Completion Rate</div>
                                <div className="small text-muted mt-1">
                                    {statistics.withTimesheets} of {statistics.totalStaff}
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3} className="mb-3">
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body className="text-center">
                                <div className="mb-2">
                                    <i className="bi bi-clock-history text-info" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                                <h3 className="mb-1">{formatHours(statistics.totalHours)}</h3>
                                <div className="text-muted small">Total Hours</div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3} className="mb-3">
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body className="text-center">
                                <div className="mb-2">
                                    <i className="bi bi-currency-dollar text-success" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                                <h3 className="mb-1">{formatHours(statistics.totalBillableHours)}</h3>
                                <div className="text-muted small">Billable Hours</div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Filters and Actions */}
            <Card className="mb-3 border-0 shadow-sm">
                <Card.Body>
                    <Row className="align-items-center g-3">
                        <Col md={3}>
                            <InputGroup size="sm">
                                <InputGroup.Text>
                                    <i className="bi bi-search"></i>
                                </InputGroup.Text>
                                <Form.Control
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </InputGroup>
                        </Col>
                        <Col md={2}>
                            <Form.Select
                                size="sm"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="none">No Timesheet</option>
                                <option value="draft">Draft</option>
                                <option value="submitted">Submitted</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </Form.Select>
                        </Col>
                        {departments.length > 0 && (
                            <Col md={2}>
                                <Form.Select
                                    size="sm"
                                    value={departmentFilter}
                                    onChange={(e) => setDepartmentFilter(e.target.value)}
                                >
                                    <option value="">All Departments</option>
                                    {departments.map(dept => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </Form.Select>
                            </Col>
                        )}
                        <Col md={2}>
                            <Form.Control
                                type="date"
                                size="sm"
                                value={weekFilter}
                                onChange={(e) => setWeekFilter(e.target.value)}
                                title="Filter by week start date"
                            />
                        </Col>
                        <Col md={3} className="text-end">
                            <ButtonGroup size="sm">
                                <Button variant="outline-success" onClick={handleExportCSV} disabled={exporting}>
                                    <i className="bi bi-download me-2"></i>
                                    {exporting ? 'Exporting...' : 'Export CSV'}
                                </Button>
                                <Button
                                    variant="outline-primary"
                                    onClick={() => setShowReminderModal(true)}
                                    disabled={staffWithoutTimesheets.length === 0}
                                >
                                    <i className="bi bi-bell me-2"></i>
                                    Send Reminders ({staffWithoutTimesheets.length})
                                </Button>
                            </ButtonGroup>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Staff Table */}
            <Card className="border-0 shadow-sm">
                <Card.Body>
                    {staff.length === 0 ? (
                        <div className="text-center py-5">
                            <div className="mb-3">
                                <i className="bi bi-inbox" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
                            </div>
                            <h5>No Staff Found</h5>
                            <p className="text-muted">
                                {searchQuery
                                    ? 'No staff match your search criteria'
                                    : 'No staff members to display'}
                            </p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover>
                                <thead className="table-light">
                                    <tr>
                                        <th>Staff Member</th>
                                        <th>Department</th>
                                        <th>Week</th>
                                        <th>Status</th>
                                        <th>Total Hours</th>
                                        <th>Billable</th>
                                        <th>Entries</th>
                                        <th>Submitted</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staff.map((staffMember) => (
                                        <tr key={staffMember.user.accountId}>
                                            <td>
                                                <div>
                                                    <strong>
                                                        {staffMember.user.firstName} {staffMember.user.lastName}
                                                    </strong>
                                                </div>
                                                <small className="text-muted">@{staffMember.user.username}</small>
                                                {staffMember.user.title && (
                                                    <div className="small text-muted">{staffMember.user.title}</div>
                                                )}
                                            </td>
                                            <td>{staffMember.user.department || '-'}</td>
                                            <td>
                                                <div>{formatDate(currentWeekStart)}</div>
                                                <small className="text-muted">
                                                    Week of {new Date(currentWeekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </small>
                                            </td>
                                            <td>
                                                {getStatusBadge(
                                                    staffMember.currentWeekTimesheet?.status || 'none'
                                                )}
                                            </td>
                                            <td>
                                                {staffMember.currentWeekTimesheet ? (
                                                    <Badge bg="primary" className="fs-6">
                                                        {formatHours(staffMember.currentWeekTimesheet.totalHours)}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted">-</span>
                                                )}
                                            </td>
                                            <td>
                                                {staffMember.currentWeekTimesheet ? (
                                                    <Badge bg="success" className="fs-6">
                                                        {formatHours(staffMember.currentWeekTimesheet.billableHours)}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted">-</span>
                                                )}
                                            </td>
                                            <td>
                                                {staffMember.currentWeekTimesheet?.entriesCount || '-'}
                                            </td>
                                            <td>
                                                <small className="text-muted">
                                                    {staffMember.currentWeekTimesheet?.submittedAt
                                                        ? new Date(staffMember.currentWeekTimesheet.submittedAt).toLocaleDateString()
                                                        : '-'}
                                                </small>
                                            </td>
                                            <td>
                                                <Button
                                                    size="sm"
                                                    variant="outline-primary"
                                                    onClick={() => handleViewTimesheet(staffMember)}
                                                    title="View all timesheets for this staff member"
                                                >
                                                    <i className="bi bi-eye"></i>
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* Bulk Reminder Modal */}
            <Modal show={showReminderModal} onHide={() => setShowReminderModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Send Reminder Emails</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Alert variant="info">
                        <strong>Reminder:</strong> You are about to send reminder emails to{' '}
                        <strong>{staffWithoutTimesheets.length}</strong> staff member(s) who have not
                        submitted timesheets for the week of {formatDate(currentWeekStart)}.
                    </Alert>
                    <p className="mb-0">
                        The following staff will receive reminder emails:
                    </p>
                    <ul className="mt-2">
                        {staffWithoutTimesheets.slice(0, 10).map(s => (
                            <li key={s.user.accountId}>
                                {s.user.firstName} {s.user.lastName} ({s.user.email})
                            </li>
                        ))}
                        {staffWithoutTimesheets.length > 10 && (
                            <li className="text-muted">
                                ...and {staffWithoutTimesheets.length - 10} more
                            </li>
                        )}
                    </ul>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        variant="secondary"
                        onClick={() => setShowReminderModal(false)}
                        disabled={sendingReminders}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSendReminders}
                        disabled={sendingReminders}
                    >
                        {sendingReminders ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                Sending...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-send me-2"></i>
                                Send Reminders
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </AppLayout>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
    Accordion,
    Spinner
} from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatHours } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';

export default function StaffTimesheetsPage() {
    const router = useRouter();
    const params = useParams();
    const staffAccountId = params.accountId;
    const { user, loading: authLoading } = useAuth();
    const { toast, showToast, hideToast } = useToast();

    const [staffMember, setStaffMember] = useState(null);
    const [timesheets, setTimesheets] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [accessType, setAccessType] = useState('');
    const [accessDenied, setAccessDenied] = useState(false);

    // Filter inputs (what user is typing/selecting)
    const [startDateInput, setStartDateInput] = useState('');
    const [endDateInput, setEndDateInput] = useState('');
    const [statusInput, setStatusInput] = useState('');

    // Applied filters (what's actually being used in the API call)
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    const [appliedStatus, setAppliedStatus] = useState('');

    // Export
    const [exporting, setExporting] = useState(false);

    // Initialize default date range to current month
    useEffect(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const startDate = firstDay.toISOString().split('T')[0];
        const endDate = lastDay.toISOString().split('T')[0];

        setStartDateInput(startDate);
        setEndDateInput(endDate);
        setAppliedStartDate(startDate);
        setAppliedEndDate(endDate);
    }, []);

    // Access control check
    useEffect(() => {
        if (!authLoading && user) {
            if (!user.isAdmin && !user.isFinance && !user.isSupervisor) {
                setAccessDenied(true);
                showToast('Access denied - you do not have permission to view this page', 'danger');
            }
        }
    }, [authLoading, user]);

    useEffect(() => {
        if (user?.organizationId && staffAccountId && !accessDenied) {
            loadStaffTimesheets();
        }
    }, [user, staffAccountId, appliedStartDate, appliedEndDate, appliedStatus, accessDenied]);

    const loadStaffTimesheets = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                organizationId: user.organizationId,
                requesterId: user.authUser.$id,
                ...(appliedStartDate && { startDate: appliedStartDate }),
                ...(appliedEndDate && { endDate: appliedEndDate }),
                ...(appliedStatus && { status: appliedStatus })
            });

            const response = await fetch(`/api/timesheets/staff/${staffAccountId}?${params}`);
            const data = await response.json();

            if (response.ok) {
                setStaffMember(data.staffMember || null);
                setTimesheets(data.timesheets || []);
                setStatistics(data.statistics || null);
                setAccessType(data.accessType || '');
            } else if (response.status === 403) {
                setAccessDenied(true);
                showToast(data.error || 'Access denied', 'danger');
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

    const handleApplyFilters = () => {
        setAppliedStartDate(startDateInput);
        setAppliedEndDate(endDateInput);
        setAppliedStatus(statusInput);
    };

    const clearFilters = () => {
        // Reset to current month defaults
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const startDate = firstDay.toISOString().split('T')[0];
        const endDate = lastDay.toISOString().split('T')[0];

        setStartDateInput(startDate);
        setEndDateInput(endDate);
        setStatusInput('');

        // Apply the cleared filters
        setAppliedStartDate(startDate);
        setAppliedEndDate(endDate);
        setAppliedStatus('');
    };

    const handleExportCSV = () => {
        try {
            setExporting(true);

            // Build CSV content
            const headers = [
                'Week Start',
                'Work Date',
                'Day',
                'Project',
                'Task',
                'Hours',
                'Billable',
                'Status',
                'Description',
                'Submitted At',
                'Approved At'
            ];

            const rows = [];
            timesheets.forEach((ts) => {
                ts.entries.forEach((entry) => {
                    const workDate = new Date(entry.workDate);
                    const dayName = workDate.toLocaleDateString('en-US', { weekday: 'long' });

                    rows.push([
                        ts.weekStart,
                        entry.workDate,
                        dayName,
                        entry.projectName || '',
                        entry.taskName || '',
                        entry.hours?.toFixed(2) || '0',
                        entry.billable ? 'Yes' : 'No',
                        ts.status || 'draft',
                        (entry.description || '').replace(/"/g, '""'),
                        ts.submittedAt || '',
                        ts.approvedAt || ''
                    ]);
                });
            });

            const csvContent = [
                headers.join(','),
                ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
            ].join('\n');

            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            const fileName = `${staffMember?.firstName || 'staff'}-${staffMember?.lastName || ''}-timesheets${appliedStartDate ? `-from-${appliedStartDate}` : ''}${appliedEndDate ? `-to-${appliedEndDate}` : ''}.csv`;
            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
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



    const getStatusBadge = (status) => {
        const variants = {
            draft: 'secondary',
            submitted: 'warning',
            approved: 'success',
            rejected: 'danger'
        };
        return (
            <Badge bg={variants[status] || 'secondary'}>
                {status?.toUpperCase()}
            </Badge>
        );
    };

    const getAccessBadge = () => {
        if (accessType === 'admin') {
            return <Badge bg="danger">Admin View</Badge>;
        } else if (accessType === 'finance') {
            return <Badge bg="info">Finance View</Badge>;
        } else if (accessType === 'supervisor') {
            return <Badge bg="primary">Supervisor View</Badge>;
        }
        return null;
    };

    if (authLoading || (loading && !accessDenied)) {
        return (
            <AppLayout user={user}>
                <LoadingSpinner message="Loading staff timesheets..." />
            </AppLayout>
        );
    }

    if (accessDenied) {
        return (
            <AppLayout user={user}>
                <Alert variant="danger" className="mt-4">
                    <Alert.Heading>Access Denied</Alert.Heading>
                    <p>You do not have permission to view this staff member's timesheets.</p>
                    <Button variant="outline-danger" onClick={() => router.push('/timesheets/team')}>
                        <i className="bi bi-arrow-left me-2"></i>
                        Back to Team Timesheets
                    </Button>
                </Alert>
            </AppLayout>
        );
    }

    return (
        <AppLayout user={user}>
            <Toast toast={toast} onClose={hideToast} />

            {/* Header */}
            <div className="mb-4">
                <div className="d-flex justify-content-between align-items-start">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-2">
                            <h2 className="mb-0">
                                {staffMember?.firstName} {staffMember?.lastName}'s Timesheets
                            </h2>
                            {getAccessBadge()}
                        </div>
                        <p className="text-muted mb-1">
                            <i className="bi bi-person me-1"></i>
                            @{staffMember?.username}
                            {staffMember?.email && (
                                <span className="ms-3">
                                    <i className="bi bi-envelope me-1"></i>
                                    {staffMember.email}
                                </span>
                            )}
                        </p>
                        {(staffMember?.title || staffMember?.department) && (
                            <p className="text-muted mb-0">
                                {staffMember.title && <span className="me-3">{staffMember.title}</span>}
                                {staffMember.department && (
                                    <Badge bg="light" text="dark">
                                        {staffMember.department}
                                    </Badge>
                                )}
                            </p>
                        )}
                    </div>
                    <Button variant="outline-secondary" onClick={() => router.push('/timesheets/team')}>
                        <i className="bi bi-arrow-left me-2"></i>
                        Back to Team
                    </Button>
                </div>
            </div>

            {/* Filters & Actions */}
            <Card className="mb-4 border-0 shadow-sm">
                <Card.Body>
                    <Row className="align-items-end g-3">
                        <Col md={3}>
                            <Form.Label className="small text-muted mb-1">From Date</Form.Label>
                            <Form.Control
                                type="date"
                                size="sm"
                                value={startDateInput}
                                onChange={(e) => setStartDateInput(e.target.value)}
                            />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="small text-muted mb-1">To Date</Form.Label>
                            <Form.Control
                                type="date"
                                size="sm"
                                value={endDateInput}
                                onChange={(e) => setEndDateInput(e.target.value)}
                            />
                        </Col>
                        <Col md={2}>
                            <Form.Label className="small text-muted mb-1">Status</Form.Label>
                            <Form.Select
                                size="sm"
                                value={statusInput}
                                onChange={(e) => setStatusInput(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="draft">Draft</option>
                                <option value="submitted">Submitted</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </Form.Select>
                        </Col>
                        <Col md={4} className="text-end">
                            <Button
                                variant="primary"
                                size="sm"
                                className="me-2"
                                onClick={handleApplyFilters}
                            >
                                <i className="bi bi-funnel me-1"></i>
                                Apply Filters
                            </Button>
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                className="me-2"
                                onClick={clearFilters}
                            >
                                <i className="bi bi-x-circle me-1"></i>
                                Clear
                            </Button>
                            <Button
                                variant="success"
                                size="sm"
                                onClick={handleExportCSV}
                                disabled={exporting || timesheets.length === 0}
                            >
                                {exporting ? (
                                    <>
                                        <Spinner size="sm" className="me-2" />
                                        Exporting...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-download me-2"></i>
                                        Export CSV
                                    </>
                                )}
                            </Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Statistics */}
            {statistics && (
                <Row className="mb-4">
                    <Col md={3} className="mb-3">
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body className="text-center">
                                <div className="mb-2">
                                    <i className="bi bi-calendar-week text-primary" style={{ fontSize: '2rem' }}></i>
                                </div>
                                <h4 className="mb-1">{statistics.totalTimesheets}</h4>
                                <div className="text-muted small">Total Timesheets</div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3} className="mb-3">
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body className="text-center">
                                <div className="mb-2">
                                    <i className="bi bi-clock-history text-info" style={{ fontSize: '2rem' }}></i>
                                </div>
                                <h4 className="mb-1">{formatHours(statistics.totalHours)}</h4>
                                <div className="text-muted small">Total Hours</div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3} className="mb-3">
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body className="text-center">
                                <div className="mb-2">
                                    <i className="bi bi-graph-up text-success" style={{ fontSize: '2rem' }}></i>
                                </div>
                                <h4 className="mb-1">{statistics.averageHoursPerWeek}</h4>
                                <div className="text-muted small">Avg Hours/Week</div>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={3} className="mb-3">
                        <Card className="border-0 shadow-sm h-100">
                            <Card.Body className="text-center">
                                <div className="mb-2">
                                    <i className="bi bi-currency-dollar text-success" style={{ fontSize: '2rem' }}></i>
                                </div>
                                <h4 className="mb-1">{formatHours(statistics.totalBillableHours)}</h4>
                                <div className="text-muted small">Billable Hours</div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Timesheets List */}
            <Card className="border-0 shadow-sm">
                <Card.Body>
                    {timesheets.length === 0 ? (
                        <div className="text-center py-5">
                            <div className="mb-3">
                                <i className="bi bi-inbox" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
                            </div>
                            <h5>No Timesheets Found</h5>
                            <p className="text-muted">
                                {appliedStartDate || appliedEndDate || appliedStatus
                                    ? 'No timesheets match your filter criteria'
                                    : 'This staff member has not created any timesheets yet'}
                            </p>
                        </div>
                    ) : (
                        <Accordion defaultActiveKey="0">
                            {timesheets.map((timesheet, index) => (
                                <Accordion.Item eventKey={index.toString()} key={timesheet.$id}>
                                    <Accordion.Header>
                                        <div className="d-flex justify-content-between align-items-center w-100 me-3">
                                            <div>
                                                <strong>Week of {formatDate(timesheet.weekStart)}</strong>
                                                <span className="ms-3">
                                                    {getStatusBadge(timesheet.status)}
                                                </span>
                                            </div>
                                            <div className="text-muted small">
                                                <span className="me-3">
                                                    <i className="bi bi-clock me-1"></i>
                                                    {formatHours(timesheet.totalHours)} hrs
                                                </span>
                                                <span className="me-3">
                                                    <i className="bi bi-currency-dollar me-1"></i>
                                                    {formatHours(timesheet.billableHours)} billable
                                                </span>
                                                <span>
                                                    <i className="bi bi-list-check me-1"></i>
                                                    {timesheet.entriesCount} entries
                                                </span>
                                            </div>
                                        </div>
                                    </Accordion.Header>
                                    <Accordion.Body>
                                        {timesheet.submittedAt && (
                                            <p className="small text-muted mb-2">
                                                <i className="bi bi-send me-1"></i>
                                                Submitted: {new Date(timesheet.submittedAt).toLocaleString()}
                                                {timesheet.approvedAt && (
                                                    <span className="ms-3">
                                                        <i className="bi bi-check-circle me-1"></i>
                                                        Approved: {new Date(timesheet.approvedAt).toLocaleString()}
                                                    </span>
                                                )}
                                            </p>
                                        )}

                                        {timesheet.entries.length === 0 ? (
                                            <Alert variant="light" className="mb-0">
                                                No entries in this timesheet.
                                            </Alert>
                                        ) : (
                                            <div className="table-responsive">
                                                <Table size="sm" hover className="mb-0">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>Date</th>
                                                            <th>Project</th>
                                                            <th>Task</th>
                                                            <th>Hours</th>
                                                            <th>Billable</th>
                                                            <th>Description</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {timesheet.entries.map((entry) => (
                                                            <tr key={entry.$id}>
                                                                <td>
                                                                    <div>{formatDate(entry.workDate)}</div>
                                                                    <small className="text-muted">
                                                                        {new Date(entry.workDate).toLocaleDateString('en-US', { weekday: 'short' })}
                                                                    </small>
                                                                </td>
                                                                <td>{entry.projectName}</td>
                                                                <td>{entry.taskName || '-'}</td>
                                                                <td>
                                                                    <Badge bg="primary">
                                                                        {formatHours(entry.hours)}
                                                                    </Badge>
                                                                </td>
                                                                <td>
                                                                    {entry.billable ? (
                                                                        <i className="bi bi-check-circle-fill text-success"></i>
                                                                    ) : (
                                                                        <i className="bi bi-x-circle text-muted"></i>
                                                                    )}
                                                                </td>
                                                                <td className="text-truncate" style={{ maxWidth: '200px' }}>
                                                                    {entry.description || '-'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            </div>
                                        )}
                                    </Accordion.Body>
                                </Accordion.Item>
                            ))}
                        </Accordion>
                    )}
                </Card.Body>
            </Card>
        </AppLayout>
    );
}

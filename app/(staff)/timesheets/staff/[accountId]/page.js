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
    Spinner,
    Dropdown
} from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatHours } from '@/lib/date';
import AppLayout from '@/components/AppLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import Toast, { useToast } from '@/components/Toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

    const [projects, setProjects] = useState([]);

    // Filter inputs (what user is typing/selecting)
    const [startDateInput, setStartDateInput] = useState('');
    const [endDateInput, setEndDateInput] = useState('');
    const [statusInput, setStatusInput] = useState('');
    const [projectInput, setProjectInput] = useState('');

    // Applied filters (what's actually being used in the API call/filtering)
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    const [appliedStatus, setAppliedStatus] = useState('');
    const [appliedProject, setAppliedProject] = useState('');

    // Export
    const [exporting, setExporting] = useState(false);
    const [exportingPDF, setExportingPDF] = useState(false);

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
            } else {
                loadProjects();
            }
        }
    }, [authLoading, user]);

    useEffect(() => {
        if (user?.organizationId && staffAccountId && !accessDenied) {
            loadStaffTimesheets();
        }
    }, [user, staffAccountId, appliedStartDate, appliedEndDate, appliedStatus, accessDenied]);

    const loadProjects = async () => {
        try {
            const response = await fetch(`/api/projects?organizationId=${user.organizationId}`);
            const data = await response.json();
            if (response.ok) {
                const projectList = data.projects || [];
                setProjects(projectList.sort((a, b) => a.name.localeCompare(b.name)));
            }
        } catch (err) {
            console.error('Failed to load projects:', err);
        }
    };

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
        setAppliedProject(projectInput);
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
        setProjectInput('');

        // Apply the cleared filters
        setAppliedStartDate(startDate);
        setAppliedEndDate(endDate);
        setAppliedStatus('');
        setAppliedProject('');
    };



    // Filter timesheets based on project
    const filteredTimesheets = timesheets.map(ts => {
        if (!appliedProject) return ts;

        const filteredEntries = ts.entries.filter(entry => entry.projectId === appliedProject);

        // If we're filtering by project, we need to recalculate the totals for this timesheet
        if (filteredEntries.length !== ts.entries.length) {
            const totalHours = filteredEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
            const billableHours = filteredEntries.reduce((sum, entry) => sum + (entry.billable ? (entry.hours || 0) : 0), 0);

            return {
                ...ts,
                entries: filteredEntries,
                totalHours,
                billableHours,
                // Don't change status or other meta info as that belongs to the whole timesheet
            };
        }

        return ts;
    }).filter(ts => ts.entries.length > 0); // Only show timesheets that have matching entries

    // Calculate statistics based on filtered data
    const getFilteredStatistics = () => {
        if (!appliedProject) return statistics;

        const totalTimesheets = filteredTimesheets.length;
        const totalHours = filteredTimesheets.reduce((sum, ts) => sum + ts.totalHours, 0);
        const totalBillable = filteredTimesheets.reduce((sum, ts) => sum + ts.billableHours, 0);

        // Calculate weeks span roughly
        const weeksCount = totalTimesheets || 1;
        const avgHours = weeksCount > 0 ? (totalHours / weeksCount).toFixed(1) : 0;

        return {
            totalTimesheets,
            totalHours,
            totalBillableHours: totalBillable,
            averageHoursPerWeek: avgHours
        };
    };

    const displayStatistics = getFilteredStatistics();

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
            filteredTimesheets.forEach((ts) => {
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
            const fileName = `${staffMember?.firstName || 'staff'}-${staffMember?.lastName || ''}-timesheets${appliedStartDate ? `-from-${appliedStartDate}` : ''}${appliedEndDate ? `-to-${appliedEndDate}` : ''}${appliedProject ? '-filtered' : ''}.csv`;
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

    const handleExportPDF = () => {
        try {
            setExportingPDF(true);

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let yPos = 20;

            const colors = {
                primary: [41, 128, 185],
                success: [39, 174, 96],
                warning: [243, 156, 18],
                danger: [231, 76, 60],
                gray: [149, 165, 166],
                lightGray: [236, 240, 241],
                darkGray: [52, 73, 94]
            };

            const getStatusColor = (status) => {
                switch (status) {
                    case 'approved': return colors.success;
                    case 'submitted': return colors.warning;
                    case 'rejected': return colors.danger;
                    default: return colors.gray;
                }
            };

            // Header
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colors.primary);
            doc.text('Timesheet Report', pageWidth / 2, yPos, { align: 'center' });

            yPos += 10;
            doc.setFontSize(14);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(`${staffMember?.firstName || ''} ${staffMember?.lastName || ''}`, pageWidth / 2, yPos, { align: 'center' });

            yPos += 7;
            doc.setFontSize(10);
            doc.setTextColor(...colors.darkGray);
            const staffInfo = [


                staffMember?.username ? `@${staffMember.username}` : '',
                staffMember?.title || '',
                staffMember?.department || ''
            ].filter(Boolean).join('  |  ');
            doc.text(staffInfo, pageWidth / 2, yPos, { align: 'center' });

            yPos += 10;
            doc.setDrawColor(...colors.lightGray);
            doc.line(20, yPos, pageWidth - 20, yPos);
            yPos += 10;

            // Filter Summary
            doc.setFillColor(...colors.lightGray);
            doc.roundedRect(20, yPos, pageWidth - 40, 22, 2, 2, 'F');

            yPos += 7;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colors.darkGray);
            doc.text('Filters Applied:', 25, yPos);

            yPos += 5;
            doc.setFont('helvetica', 'normal');
            const filterText = [
                appliedStartDate && appliedEndDate ? `Date Range: ${appliedStartDate} to ${appliedEndDate}` : 'Date Range: All',
                appliedStatus ? `Status: ${appliedStatus.toUpperCase()}` : 'Status: All',
                appliedProject ? 'Project: Filtered' : 'Project: All',
                `View: ${accessType.charAt(0).toUpperCase() + accessType.slice(1)}`
            ].join('  |  ');
            doc.text(filterText, 25, yPos);

            yPos += 5;
            doc.setFontSize(8);
            doc.setTextColor(...colors.gray);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 25, yPos);

            yPos += 15;

            // Statistics
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text('Summary Statistics', 20, yPos);
            yPos += 8;

            const stats = [
                { label: 'Total Timesheets', value: statistics?.totalTimesheets || 0 },
                { label: 'Total Hours', value: formatHours(statistics?.totalHours || 0) },
                { label: 'Avg Hours/Week', value: statistics?.averageHoursPerWeek || 0 },
                { label: 'Billable Hours', value: formatHours(statistics?.totalBillableHours || 0) }
            ];

            const statBoxWidth = (pageWidth - 50) / 4;
            stats.forEach((stat, index) => {
                const xPos = 20 + (index * statBoxWidth) + (index * 2.5);

                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(...colors.lightGray);
                doc.roundedRect(xPos, yPos, statBoxWidth, 18, 1, 1, 'FD');

                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...colors.primary);
                doc.text(String(stat.value), xPos + statBoxWidth / 2, yPos + 8, { align: 'center' });

                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...colors.darkGray);
                doc.text(stat.label, xPos + statBoxWidth / 2, yPos + 14, { align: 'center' });
            });

            yPos += 25;

            // Timesheets
            if (timesheets.length === 0) {
                doc.setFontSize(10);
                doc.setTextColor(...colors.gray);
                doc.setFont('helvetica', 'italic');
                doc.text('No timesheets found', pageWidth / 2, yPos + 20, { align: 'center' });
            } else {
                timesheets.forEach((timesheet) => {
                    if (yPos > pageHeight - 60) {
                        doc.addPage();
                        yPos = 20;
                    }

                    const weekStartDate = new Date(timesheet.weekStart);
                    const weekEndDate = new Date(weekStartDate);
                    weekEndDate.setDate(weekEndDate.getDate() + 6);

                    doc.setFillColor(...getStatusColor(timesheet.status));
                    doc.rect(20, yPos, pageWidth - 40, 10, 'F');

                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(255, 255, 255);
                    doc.text(`Week: ${formatDate(timesheet.weekStart)} - ${formatDate(weekEndDate.toISOString())}`, 25, yPos + 6.5);
                    doc.text(`Status: ${timesheet.status?.toUpperCase() || 'DRAFT'}`, pageWidth / 2 + 10, yPos + 6.5);
                    doc.text(`${formatHours(timesheet.totalHours)} hrs (${formatHours(timesheet.billableHours)} billable)`, pageWidth - 25, yPos + 6.5, { align: 'right' });

                    yPos += 12;

                    if (timesheet.entries && timesheet.entries.length > 0) {
                        const tableData = timesheet.entries.map(entry => {
                            const workDate = new Date(entry.workDate);
                            const dayName = workDate.toLocaleDateString('en-US', { weekday: 'short' });

                            return [
                                `${formatDate(entry.workDate)}\n${dayName}`,
                                entry.projectName || '-',
                                entry.taskName || '-',
                                formatHours(entry.hours),
                                entry.billable ? '✓' : '✗',
                                entry.description || '-'
                            ];
                        });

                        autoTable(doc, {
                            startY: yPos,
                            head: [['Date', 'Project', 'Task', 'Hours', 'Bill', 'Description']],
                            body: tableData,
                            theme: 'striped',
                            headStyles: { fillColor: colors.darkGray, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'left' },
                            bodyStyles: { fontSize: 8, textColor: colors.darkGray },
                            columnStyles: {
                                0: { cellWidth: 25, halign: 'left' },
                                1: { cellWidth: 45, halign: 'left' },
                                2: { cellWidth: 35, halign: 'left' },
                                3: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
                                4: { cellWidth: 12, halign: 'center' },
                                5: { cellWidth: 'auto', halign: 'left' }
                            },
                            alternateRowStyles: { fillColor: [250, 250, 250] },
                            margin: { left: 20, right: 20 },
                            didDrawPage: () => {
                                const pageCount = doc.internal.getNumberOfPages();
                                const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
                                doc.setFontSize(8);
                                doc.setTextColor(...colors.gray);
                                doc.text(`Page ${currentPage} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
                            }
                        });

                        yPos = doc.lastAutoTable.finalY + 5;
                    } else {
                        doc.setFontSize(9);
                        doc.setTextColor(...colors.gray);
                        doc.setFont('helvetica', 'italic');
                        doc.text('No entries for this timesheet', 25, yPos + 5);
                        yPos += 15;
                    }

                    yPos += 5;
                });
            }

            const fileName = `${staffMember?.firstName || 'staff'}-${staffMember?.lastName || ''}-timesheets${appliedStartDate ? `-from-${appliedStartDate}` : ''}${appliedEndDate ? `-to-${appliedEndDate}` : ''}.pdf`;
            doc.save(fileName);

            showToast('PDF exported successfully!', 'success');
        } catch (error) {
            console.error('PDF export error:', error);
            showToast('Failed to export PDF', 'danger');
        } finally {
            setExportingPDF(false);
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
                    <p>You do not have permission to view this staff member&apos;s timesheets.</p>
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
                                {staffMember?.firstName} {staffMember?.lastName}&apos;s Timesheets
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
                        <Col md={3}>
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
                        <Col md={3}>
                            <Form.Label className="small text-muted mb-1">Project</Form.Label>
                            <Form.Select
                                size="sm"
                                value={projectInput}
                                onChange={(e) => setProjectInput(e.target.value)}
                            >
                                <option value="">All Projects</option>
                                {projects.map(p => (
                                    <option key={p.$id} value={p.$id}>{p.name}</option>
                                ))}
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
                            <Dropdown className="d-inline-block ms-2">
                                <Dropdown.Toggle variant="success" size="sm" id="export-dropdown" disabled={exporting || exportingPDF || filteredTimesheets.length === 0}>
                                    {(exporting || exportingPDF) ? (
                                        <>
                                            <Spinner size="sm" className="me-2" />
                                            Exporting...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-download me-2"></i>
                                            Export
                                        </>
                                    )}
                                </Dropdown.Toggle>

                                <Dropdown.Menu align="end">
                                    <Dropdown.Item onClick={handleExportCSV}>
                                        <i className="bi bi-filetype-csv me-2"></i>
                                        Export CSV
                                    </Dropdown.Item>
                                    <Dropdown.Item onClick={handleExportPDF}>
                                        <i className="bi bi-file-pdf me-2"></i>
                                        Export PDF
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
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
                                <h4 className="mb-1">{displayStatistics?.totalTimesheets || 0}</h4>
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
                                <h4 className="mb-1">{formatHours(displayStatistics?.totalHours || 0)}</h4>
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
                                <h4 className="mb-1">{displayStatistics?.averageHoursPerWeek || 0}</h4>
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
                                <h4 className="mb-1">{formatHours(displayStatistics?.totalBillableHours || 0)}</h4>
                                <div className="text-muted small">Billable Hours</div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Timesheets List */}
            <Card className="border-0 shadow-sm">
                <Card.Body>
                    {filteredTimesheets.length === 0 ? (
                        <div className="text-center py-5">
                            <div className="mb-3">
                                <i className="bi bi-inbox" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
                            </div>
                            <h5>No Timesheets Found</h5>
                            <p className="text-muted">
                                {appliedStartDate || appliedEndDate || appliedStatus || appliedProject
                                    ? 'No timesheets match your filter criteria'
                                    : 'This staff member has not created any timesheets yet'}
                            </p>
                        </div>
                    ) : (
                        <Accordion defaultActiveKey="0">
                            {filteredTimesheets.map((timesheet, index) => (
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

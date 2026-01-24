/**
 * Individual Staff Timesheet API
 * GET: Fetch a specific staff member's timesheets with role-based access control
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, Query, DB_ID } from '@/lib/appwriteAdmin';

export const dynamic = 'force-dynamic';

const COL_TIMESHEETS = 'pms_timesheets';
const COL_ENTRIES = 'pms_timesheet_entries';
const COL_USERS = 'pms_users';
const COL_PROJECTS = 'pms_projects';
const COL_TASKS = 'pms_tasks';

/**
 * GET /api/timesheets/staff/[accountId]
 * Fetch timesheets for a specific staff member
 *
 * Query params:
 * - organizationId: Required
 * - requesterId: Required (account ID of requester)
 * - startDate: Optional filter (from this date)
 * - endDate: Optional filter (to this date)
 * - status: Optional filter (draft, submitted, approved, rejected)
 * - limit: Optional (default 50)
 */
export async function GET(request, { params }) {
    try {
        const { accountId } = await params;
        const { searchParams } = new URL(request.url);
        const organizationId = searchParams.get('organizationId');
        const requesterId = searchParams.get('requesterId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const statusFilter = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        if (!organizationId || !requesterId || !accountId) {
            return NextResponse.json(
                { error: 'organizationId, requesterId, and accountId are required' },
                { status: 400 }
            );
        }

        // Step 1: Check requester's access permissions
        const requester = await adminUsers.get(requesterId);
        const isAdmin = requester.labels?.includes('admin');
        const isFinance = requester.labels?.includes('finance');

        let hasAccess = false;
        let accessType = 'none';

        if (isAdmin) {
            hasAccess = true;
            accessType = 'admin';
        } else if (isFinance) {
            hasAccess = true;
            accessType = 'finance';
        } else {
            // Check if requester is a supervisor of this staff member
            const staffProfiles = await adminDatabases.listDocuments(
                DB_ID,
                COL_USERS,
                [
                    Query.equal('accountId', accountId),
                    Query.equal('organizationId', organizationId),
                    Query.limit(1)
                ]
            );

            if (staffProfiles.documents.length === 0) {
                return NextResponse.json(
                    { error: 'Staff member not found' },
                    { status: 404 }
                );
            }

            const staffProfile = staffProfiles.documents[0];

            // Check if this staff is supervised by the requester
            if (staffProfile.supervisorId === requesterId) {
                hasAccess = true;
                accessType = 'supervisor';
            }
        }

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'Unauthorized - you do not have permission to view this staff member\'s timesheets' },
                { status: 403 }
            );
        }

        // Step 2: Fetch staff member profile
        const staffProfiles = await adminDatabases.listDocuments(
            DB_ID,
            COL_USERS,
            [
                Query.equal('accountId', accountId),
                Query.equal('organizationId', organizationId),
                Query.limit(1)
            ]
        );

        if (staffProfiles.documents.length === 0) {
            return NextResponse.json(
                { error: 'Staff member not found' },
                { status: 404 }
            );
        }

        const staffMember = staffProfiles.documents[0];

        // Step 3: Build queries for timesheets
        const timesheetQueries = [
            Query.equal('accountId', accountId),
            Query.equal('organizationId', organizationId),
            Query.orderDesc('weekStart'),
            Query.limit(limit)
        ];

        if (startDate) {
            timesheetQueries.push(Query.greaterThanEqual('weekStart', startDate));
        }

        if (endDate) {
            timesheetQueries.push(Query.lessThanEqual('weekStart', endDate));
        }

        if (statusFilter) {
            timesheetQueries.push(Query.equal('status', statusFilter));
        }

        // Step 4: Fetch timesheets
        const timesheetsResponse = await adminDatabases.listDocuments(
            DB_ID,
            COL_TIMESHEETS,
            timesheetQueries
        );

        // Step 5: Enrich timesheets with entries and project/task details
        const enrichedTimesheets = await Promise.all(
            timesheetsResponse.documents.map(async (timesheet) => {
                try {
                    // Fetch entries
                    const entriesResponse = await adminDatabases.listDocuments(
                        DB_ID,
                        COL_ENTRIES,
                        [
                            Query.equal('timesheetId', timesheet.$id),
                            Query.orderAsc('workDate'),
                            Query.limit(500)
                        ]
                    );

                    // Enrich entries with project and task names
                    const enrichedEntries = await Promise.all(
                        entriesResponse.documents.map(async (entry) => {
                            let projectName = 'Unknown Project';
                            let taskName = entry.taskId ? 'Unknown Task' : null;

                            try {
                                if (entry.projectId) {
                                    const project = await adminDatabases.getDocument(
                                        DB_ID,
                                        COL_PROJECTS,
                                        entry.projectId
                                    );
                                    projectName = project.name || projectName;
                                }

                                if (entry.taskId) {
                                    const task = await adminDatabases.getDocument(
                                        DB_ID,
                                        COL_TASKS,
                                        entry.taskId
                                    );
                                    taskName = task.title || taskName; // Use 'title' not 'name'
                                }
                            } catch (err) {
                                console.error('Error fetching project/task details:', err);
                            }

                            return {
                                $id: entry.$id,
                                workDate: entry.workDate,
                                startTime: entry.startTime,
                                endTime: entry.endTime,
                                hours: entry.hours,
                                billable: entry.billable,
                                description: entry.notes || entry.title || '', // Use 'notes' field for description
                                projectId: entry.projectId,
                                projectName,
                                taskId: entry.taskId,
                                taskName
                            };
                        })
                    );

                    // Calculate totals
                    const totalHours = enrichedEntries.reduce((sum, e) => sum + e.hours, 0);
                    const billableHours = enrichedEntries.reduce(
                        (sum, e) => (e.billable ? sum + e.hours : sum),
                        0
                    );

                    return {
                        $id: timesheet.$id,
                        weekStart: timesheet.weekStart,
                        status: timesheet.status || 'draft',
                        totalHours,
                        billableHours,
                        nonBillableHours: totalHours - billableHours,
                        entriesCount: enrichedEntries.length,
                        submittedAt: timesheet.submittedAt || null,
                        approvedAt: timesheet.approvedAt || null,
                        approvedBy: timesheet.approvedBy || null,
                        rejectedAt: timesheet.rejectedAt || null,
                        rejectedBy: timesheet.rejectedBy || null,
                        entries: enrichedEntries
                    };
                } catch (error) {
                    console.error(`Failed to enrich timesheet ${timesheet.$id}:`, error);
                    return {
                        ...timesheet,
                        entries: [],
                        totalHours: 0,
                        billableHours: 0,
                        entriesCount: 0
                    };
                }
            })
        );

        // Step 6: Calculate statistics
        const statistics = {
            totalTimesheets: enrichedTimesheets.length,
            totalHours: 0,
            totalBillableHours: 0,
            averageHoursPerWeek: 0,
            statusBreakdown: {
                draft: 0,
                submitted: 0,
                approved: 0,
                rejected: 0
            }
        };

        enrichedTimesheets.forEach((ts) => {
            statistics.totalHours += ts.totalHours || 0;
            statistics.totalBillableHours += ts.billableHours || 0;
            const status = ts.status || 'draft';
            statistics.statusBreakdown[status] = (statistics.statusBreakdown[status] || 0) + 1;
        });

        if (enrichedTimesheets.length > 0) {
            statistics.averageHoursPerWeek = parseFloat(
                (statistics.totalHours / enrichedTimesheets.length).toFixed(2)
            );
        }

        return NextResponse.json(
            {
                staffMember: {
                    accountId: staffMember.accountId,
                    firstName: staffMember.firstName,
                    lastName: staffMember.lastName,
                    username: staffMember.username,
                    email: staffMember.email,
                    department: staffMember.department,
                    title: staffMember.title,
                    supervisorId: staffMember.supervisorId
                },
                timesheets: enrichedTimesheets,
                statistics,
                accessType
            },
            {
                headers: {
                    'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
                }
            }
        );
    } catch (error) {
        console.error('[API /timesheets/staff/[accountId] GET]', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch staff timesheets' },
            { status: 500 }
        );
    }
}

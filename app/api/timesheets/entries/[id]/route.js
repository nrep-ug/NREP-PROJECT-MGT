/**
 * Timesheet Entry API - Get, Update and Delete individual entries
 * GET: Fetch a single timesheet entry
 * PUT: Update a single timesheet entry
 * DELETE: Delete a single timesheet entry
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, Query, DB_ID } from '@/lib/appwriteAdmin';

const COL_ENTRIES = 'pms_timesheet_entries';
const COL_TIMESHEETS = 'pms_timesheets';

/**
 * GET /api/timesheets/entries/[id]
 * Fetch a single timesheet entry
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;

    // Get the entry
    const entry = await adminDatabases.getDocument(DB_ID, COL_ENTRIES, id);

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('[API /timesheets/entries/[id] GET]', error);

    if (error.code === 404) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch entry' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/timesheets/entries/[id]
 * Update a single timesheet entry
 */
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { projectId, taskId, workDate, hours, notes, billable, requesterId } = body;

    if (!requesterId) {
      return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
    }

    // Get the entry to check ownership and timesheet status
    const entry = await adminDatabases.getDocument(DB_ID, COL_ENTRIES, id);

    // Get the timesheet to check status
    const timesheet = await adminDatabases.getDocument(DB_ID, COL_TIMESHEETS, entry.timesheetId);

    // Check if timesheet is locked (submitted, approved, or rejected)
    if (timesheet.status !== 'draft' && timesheet.status !== 'rejected') {
      return NextResponse.json(
        { error: 'Cannot modify entry - timesheet is locked' },
        { status: 403 }
      );
    }

    // Check authorization - must be the owner or an admin
    const requesterUser = await adminUsers.get(requesterId);
    const isAdmin = requesterUser.labels?.includes('admin');
    const isOwner = timesheet.accountId === requesterId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Unauthorized - you can only edit your own entries' },
        { status: 403 }
      );
    }

    // Validate hours
    if (hours !== undefined) {
      if (hours <= 0 || hours > 24) {
        return NextResponse.json(
          { error: 'Hours must be between 0.1 and 24' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData = {};
    if (projectId !== undefined) updateData.projectId = projectId;
    if (taskId !== undefined) updateData.taskId = taskId || null;
    if (workDate !== undefined) updateData.workDate = workDate;
    if (hours !== undefined) updateData.hours = hours;
    if (notes !== undefined) updateData.notes = notes || null;
    if (billable !== undefined) updateData.billable = billable;

    // Update the entry
    const updatedEntry = await adminDatabases.updateDocument(
      DB_ID,
      COL_ENTRIES,
      id,
      updateData
    );

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error('[API /timesheets/entries/[id] PUT]', error);

    if (error.code === 404) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update entry' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/timesheets/entries/[id]
 * Delete a single timesheet entry
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');

    if (!requesterId) {
      return NextResponse.json({ error: 'requesterId is required' }, { status: 401 });
    }

    // Get the entry to check ownership and timesheet status
    const entry = await adminDatabases.getDocument(DB_ID, COL_ENTRIES, id);

    // Get the timesheet to check status
    const timesheet = await adminDatabases.getDocument(DB_ID, COL_TIMESHEETS, entry.timesheetId);

    // Check if timesheet is locked
    if (timesheet.status !== 'draft' && timesheet.status !== 'rejected') {
      return NextResponse.json(
        { error: 'Cannot delete entry - timesheet is locked' },
        { status: 403 }
      );
    }

    // Check authorization - must be the owner or an admin
    const requesterUser = await adminUsers.get(requesterId);
    const isAdmin = requesterUser.labels?.includes('admin');
    const isOwner = timesheet.accountId === requesterId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Unauthorized - you can only delete your own entries' },
        { status: 403 }
      );
    }

    // Delete the entry
    await adminDatabases.deleteDocument(DB_ID, COL_ENTRIES, id);

    return NextResponse.json({ success: true, message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('[API /timesheets/entries/[id] DELETE]', error);

    if (error.code === 404) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to delete entry' },
      { status: 500 }
    );
  }
}

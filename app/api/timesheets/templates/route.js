/**
 * Timesheet Templates API
 * GET: Fetch user's templates
 * POST: Create a new template
 * DELETE: Delete a template
 */

import { NextResponse } from 'next/server';
import { adminDatabases, ID, Query, DB_ID } from '@/lib/appwriteAdmin';
import { getTimesheetPermissions } from '@/lib/rbac';

const COL_TEMPLATES = 'pms_timesheet_templates';
const COL_PROJECTS = 'pms_projects';

/**
 * GET /api/timesheets/templates
 * Fetch all templates for a user
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const organizationId = searchParams.get('organizationId');

    if (!accountId || !organizationId) {
      return NextResponse.json(
        { error: 'accountId and organizationId are required' },
        { status: 400 }
      );
    }

    // Fetch user's templates
    const templatesResponse = await adminDatabases.listDocuments(
      DB_ID,
      COL_TEMPLATES,
      [
        Query.equal('accountId', accountId),
        Query.orderDesc('$createdAt'),
        Query.limit(100)
      ]
    );

    // Enrich with project details
    const enrichedTemplates = await Promise.all(
      templatesResponse.documents.map(async (template) => {
        try {
          const project = await adminDatabases.getDocument(DB_ID, COL_PROJECTS, template.projectId);
          return {
            ...template,
            project: {
              $id: project.$id,
              name: project.name,
              code: project.code,
              status: project.status
            }
          };
        } catch (err) {
          console.error(`Failed to fetch project ${template.projectId}:`, err);
          return {
            ...template,
            project: null
          };
        }
      })
    );

    return NextResponse.json({
      templates: enrichedTemplates,
      total: enrichedTemplates.length
    });
  } catch (error) {
    console.error('[API /timesheets/templates GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/timesheets/templates
 * Create a new template
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { accountId, organizationId, name, projectId, taskId, hours, notes, billable } = body;

    if (!accountId || !organizationId || !name || !projectId || !hours) {
      return NextResponse.json(
        { error: 'accountId, organizationId, name, projectId, and hours are required' },
        { status: 400 }
      );
    }

    // Validate hours
    if (hours <= 0 || hours > 24) {
      return NextResponse.json(
        { error: 'Hours must be between 0.1 and 24' },
        { status: 400 }
      );
    }

    // Verify project exists and user has access
    try {
      await adminDatabases.getDocument(DB_ID, COL_PROJECTS, projectId);
    } catch (err) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Create template
    const permissions = getTimesheetPermissions(accountId, organizationId);
    const template = await adminDatabases.createDocument(
      DB_ID,
      COL_TEMPLATES,
      ID.unique(),
      {
        accountId,
        name,
        projectId,
        taskId: taskId || null,
        hours,
        notes: notes || null,
        billable: billable !== undefined ? billable : true
      },
      permissions
    );

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('[API /timesheets/templates POST]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/timesheets/templates
 * Delete a template
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    const accountId = searchParams.get('accountId');

    if (!templateId || !accountId) {
      return NextResponse.json(
        { error: 'templateId and accountId are required' },
        { status: 400 }
      );
    }

    // Get template to verify ownership
    const template = await adminDatabases.getDocument(DB_ID, COL_TEMPLATES, templateId);

    if (template.accountId !== accountId) {
      return NextResponse.json(
        { error: 'Unauthorized - you can only delete your own templates' },
        { status: 403 }
      );
    }

    // Delete the template
    await adminDatabases.deleteDocument(DB_ID, COL_TEMPLATES, templateId);

    return NextResponse.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('[API /timesheets/templates DELETE]', error);

    if (error.code === 404) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}

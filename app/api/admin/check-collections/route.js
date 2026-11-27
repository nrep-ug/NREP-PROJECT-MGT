/**
 * Check Collections API - Verify if database collections exist
 * GET: Check if all required collections have been created
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, DB_ID } from '@/lib/appwriteAdmin';
import { apiErrorResponse, requireAdmin, requireAuthenticatedContext } from '@/lib/serverAuth';

export async function GET(request) {
  try {
    const context = await requireAuthenticatedContext(request);
    requireAdmin(context);
    // Try to list a few key collections to see if they exist
    const collectionsToCheck = [
      COLLECTIONS.PROJECTS,
      COLLECTIONS.TASKS,
      COLLECTIONS.USERS,
      COLLECTIONS.MILESTONES,
    ];

    let allExist = true;

    for (const collectionId of collectionsToCheck) {
      try {
        // Try to list documents with a limit of 1
        // If the collection doesn't exist, this will throw an error
        await adminDatabases.listDocuments(DB_ID, collectionId, []);
      } catch (error) {
        // Collection doesn't exist
        allExist = false;
        break;
      }
    }

    return NextResponse.json({
      exist: allExist,
      checked: collectionsToCheck,
    });
  } catch (error) {
    console.error('[API /admin/check-collections]', error);
    const response = apiErrorResponse(error);
    return NextResponse.json({ ...response.body, exist: false }, { status: response.status });
  }
}

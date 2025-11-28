/**
 * Check Collections API - Verify if database collections exist
 * GET: Check if all required collections have been created
 */

import { NextResponse } from 'next/server';
import { adminDatabases, DB_ID } from '@/lib/appwriteAdmin';

export async function GET(request) {
  try {
    // Try to list a few key collections to see if they exist
    const collectionsToCheck = [
      'pms_projects',
      'pms_tasks',
      'pms_users',
      'pms_milestones',
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
    return NextResponse.json(
      { error: error.message || 'Failed to check collections', exist: false },
      { status: 500 }
    );
  }
}

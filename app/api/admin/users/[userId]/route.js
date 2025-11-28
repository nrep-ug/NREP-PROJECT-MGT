/**
 * Admin User Management API
 * Update user details, labels, and roles
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, DB_ID } from '@/lib/appwriteAdmin';

const COL_USERS = 'pms_users';

/**
 * PATCH /api/admin/users/[userId]
 * Update user details in both Appwrite Account and database
 */
export async function PATCH(request, { params }) {
  try {
    const { userId } = params;
    const body = await request.json();
    const {
      requesterId,
      role, // 'staff' or 'client'
      // Common fields
      firstName,
      lastName,
      otherNames,
      status,
      title,
      // Staff-specific
      department,
      isAdmin, // boolean - whether user should have admin role
      // Client-specific
      clientOrganizationIds
    } = body;

    if (!requesterId) {
      return NextResponse.json(
        { error: 'requesterId is required' },
        { status: 400 }
      );
    }

    // Verify requester is admin
    const requester = await adminUsers.get(requesterId);
    if (!requester.labels?.includes('admin')) {
      return NextResponse.json(
        { error: 'Only admins can update users' },
        { status: 403 }
      );
    }

    // Get current user from Appwrite
    const user = await adminUsers.get(userId);

    // Handle role and label updates for staff users
    // role field in database is now an array matching Appwrite labels
    // Staff users: ['staff'] or ['staff', 'admin']
    // Client users: ['client']
    let newRoleArray = null;

    if (role === 'staff' && isAdmin !== undefined) {
      const currentLabels = user.labels || [];
      let newLabels = [...currentLabels];

      // Ensure 'staff' label is always present for staff users
      if (!newLabels.includes('staff')) {
        newLabels.push('staff');
      }

      if (isAdmin) {
        // Add admin label if not present
        if (!newLabels.includes('admin')) {
          newLabels.push('admin');
        }
        newRoleArray = ['staff', 'admin'];
      } else {
        // Remove admin label but keep staff label
        newLabels = newLabels.filter(label => label !== 'admin');
        newRoleArray = ['staff'];
      }

      // Update Appwrite labels if changed
      if (JSON.stringify(newLabels.sort()) !== JSON.stringify(currentLabels.sort())) {
        await adminUsers.updateLabels(userId, newLabels);
      }
    }

    // Update user name in Appwrite Account if firstName or lastName changed
    if (firstName || lastName) {
      const newName = `${firstName || user.name.split(' ')[0]} ${lastName || user.name.split(' ')[1] || ''}`.trim();
      await adminUsers.updateName(userId, newName);
    }

    // Build database updates
    const dbUpdates = {};
    if (firstName !== undefined) dbUpdates.firstName = firstName;
    if (lastName !== undefined) dbUpdates.lastName = lastName;
    if (otherNames !== undefined) dbUpdates.otherNames = otherNames;
    if (status !== undefined) dbUpdates.status = status;
    if (title !== undefined) dbUpdates.title = title;

    // Update role array and isAdmin flag
    if (newRoleArray) {
      dbUpdates.role = newRoleArray;
      dbUpdates.isAdmin = newRoleArray.includes('admin');
    }

    if (role === 'staff') {
      if (department !== undefined) dbUpdates.department = department;
    } else if (role === 'client') {
      if (clientOrganizationIds !== undefined) dbUpdates.clientOrganizationIds = clientOrganizationIds;
    }

    // Get user document from database
    const userDocs = await adminDatabases.listDocuments(
      DB_ID,
      COL_USERS,
      []
    );
    const userDoc = userDocs.documents.find(doc => doc.accountId === userId);

    if (!userDoc) {
      return NextResponse.json(
        { error: 'User document not found in database' },
        { status: 404 }
      );
    }

    // Update database record
    const updatedUser = await adminDatabases.updateDocument(
      DB_ID,
      COL_USERS,
      userDoc.$id,
      dbUpdates
    );

    // Get updated Appwrite account info
    const updatedAccount = await adminUsers.get(userId);

    return NextResponse.json({
      success: true,
      user: updatedUser,
      account: {
        $id: updatedAccount.$id,
        name: updatedAccount.name,
        email: updatedAccount.email,
        labels: updatedAccount.labels
      }
    });
  } catch (error) {
    console.error('[API /admin/users/[userId] PATCH]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}

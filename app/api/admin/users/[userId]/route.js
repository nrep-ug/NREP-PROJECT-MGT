/**
 * Admin User Management API
 * Update user details, labels, and roles
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, adminTeams, Query, DB_ID } from '@/lib/appwriteAdmin';

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
      isSupervisor, // boolean - whether user should have supervisor role
      isFinance, // boolean - whether user should have finance role
      // Client-specific
      clientOrganizationIds,
      supervisorId // ID of the supervisor user
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

    // Get user document from database (Moved up to be available for Project logic)
    const existingUserDocs = await adminDatabases.listDocuments(
      DB_ID,
      COL_USERS,
      [Query.equal('accountId', userId), Query.limit(1)]
    );

    if (existingUserDocs.documents.length === 0) {
      return NextResponse.json(
        { error: 'User document not found in database' },
        { status: 404 }
      );
    }
    const userDoc = existingUserDocs.documents[0];

    // Handle role and label updates for staff users
    // role field in database is now an array matching Appwrite labels
    // Staff users: ['staff'] or ['staff', 'admin']
    // Client users: ['client']
    let newRoleArray = null;

    if (role === 'staff') {
      const currentLabels = user.labels || [];
      let newLabels = [...currentLabels];

      // Ensure 'staff' label is always present for staff users
      if (!newLabels.includes('staff')) {
        newLabels.push('staff');
      }

      // Handle Admin
      if (isAdmin !== undefined) {
        if (isAdmin) {
          if (!newLabels.includes('admin')) newLabels.push('admin');
        } else {
          newLabels = newLabels.filter(label => label !== 'admin');
        }
      }

      // Handle Supervisor
      if (isSupervisor !== undefined) {
        if (isSupervisor) {
          if (!newLabels.includes('supervisor')) newLabels.push('supervisor');
        } else {
          newLabels = newLabels.filter(label => label !== 'supervisor');
        }
      }

      // Handle Finance
      if (isFinance !== undefined) {
        if (isFinance) {
          if (!newLabels.includes('finance')) newLabels.push('finance');
        } else {
          newLabels = newLabels.filter(label => label !== 'finance');
        }
      }

      // Update role array based on final labels
      newRoleArray = [...newLabels];

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

    // Update role array and role flags
    if (newRoleArray) {
      dbUpdates.role = newRoleArray;
      dbUpdates.isAdmin = newRoleArray.includes('admin');
    }

    if (isSupervisor !== undefined) dbUpdates.isSupervisor = isSupervisor;
    if (isFinance !== undefined) dbUpdates.isFinance = isFinance;

    // Update supervisorId
    // If supervisorId is explicitly passed (even as empty string), update it
    // Convert empty string to null for storage
    if (supervisorId !== undefined) {
      dbUpdates.supervisorId = supervisorId || null;
    }

    if (role === 'staff') {
      if (department !== undefined) dbUpdates.department = department;
    } else if (role === 'client') {
      if (clientOrganizationIds !== undefined) dbUpdates.clientOrganizationIds = clientOrganizationIds;

      // Handle Project Assignments (for Client Users)
      if (body.projectIds !== undefined) {
        dbUpdates.projectIds = body.projectIds;

        // Sync Project Team Memberships
        const currentProjectIds = userDoc.projectIds || [];
        const newProjectIds = body.projectIds || [];

        // Projects to Add
        const projectsToAdd = newProjectIds.filter(id => !currentProjectIds.includes(id));
        for (const projectId of projectsToAdd) {
          try {
            const project = await adminDatabases.getDocument(DB_ID, 'pms_projects', projectId);
            if (project.projectTeamId) {
              await adminTeams.createMembership(
                project.projectTeamId,
                ['client_rep'],
                undefined,
                userId
              );
            }
          } catch (err) {
            console.error(`Failed to add user to project ${projectId}:`, err);
            // Continue even if fail
          }
        }

        // Projects to Remove
        const projectsToRemove = currentProjectIds.filter(id => !newProjectIds.includes(id));
        for (const projectId of projectsToRemove) {
          try {
            const project = await adminDatabases.getDocument(DB_ID, 'pms_projects', projectId);
            // Need to find membership ID first to delete it
            // This is tricky without listing memberships.
            // Alternative: List memberships of the team and find the user.
            if (project.projectTeamId) {
              const memberships = await adminTeams.listMemberships(project.projectTeamId, [
                Query.equal('userId', userId)
              ]);
              if (memberships.memberships.length > 0) {
                await adminTeams.deleteMembership(project.projectTeamId, memberships.memberships[0].$id);
              }
            }
          } catch (err) {
            console.error(`Failed to remove user from project ${projectId}:`, err);
          }
        }
      }
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

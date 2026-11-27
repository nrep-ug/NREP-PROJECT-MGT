/**
 * Admin User Management API
 * Update user details, labels, and roles
 */

import { NextResponse } from 'next/server';
import { COLLECTIONS, adminDatabases, adminUsers, adminTeams, Query, DB_ID } from '@/lib/appwriteAdmin';
import { apiErrorResponse, requireAdmin, requireAuthenticatedContext } from '@/lib/serverAuth';
import { validateClientAssignments, validateSupervisorAssignment } from '@/lib/adminUserValidation';

const COL_USERS = COLLECTIONS.USERS;
const FINANCE_MEMBERSHIP_ROLES = Object.freeze([
  'finance_officer',
  'finance_reviewer',
  'finance_budget_approver',
  'finance_admin',
]);
const FINANCE_PROFILE_TO_MEMBERSHIP = Object.freeze({
  preparer: 'finance_officer',
  approver: 'finance_reviewer',
});
const FINANCE_MEMBERSHIP_TO_PROFILE = Object.freeze({
  finance_officer: 'preparer',
  finance_reviewer: 'approver',
});

/**
 * PATCH /api/admin/users/[userId]
 * Update user details in both Appwrite Account and database
 */
export async function PATCH(request, { params }) {
  try {
    const context = await requireAuthenticatedContext(request);
    requireAdmin(context);
    const { userId } = await params;
    const body = await request.json();
    const {
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
      financeRole, // 'preparer' | 'approver' | null - which finance role, if isFinance
      financeBudgetApprover, // boolean - independent Budget Approver toggle (Section Y/S)
      // Client-specific
      clientOrganizationIds,
      supervisorId // ID of the supervisor user
    } = body;

    if (role !== undefined && !['staff', 'client'].includes(role)) {
      return NextResponse.json({ error: 'Role must be staff or client.' }, { status: 400 });
    }
    if (status !== undefined && !['active', 'inactive', 'invited', 'suspended'].includes(status)) {
      return NextResponse.json({ error: 'Invalid account status.' }, { status: 400 });
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
    if (userDoc.organizationId !== context.organizationId) {
      return NextResponse.json({ error: 'You can only manage users in your organization.' }, { status: 403 });
    }
    const organizationMemberships = await adminTeams.listMemberships(context.organizationId, [
      Query.equal('userId', userId),
      Query.limit(2),
    ]);
    const organizationMembership = organizationMemberships.memberships.find(
      (membership) => membership.userId === userId
    );
    if (!organizationMembership) {
      return NextResponse.json({ error: 'The user has no active membership in this organization.' }, { status: 409 });
    }
    const currentMembershipRoles = organizationMembership.roles || [];
    const currentFinanceMembershipRole = currentMembershipRoles.find(
      (membershipRole) => ['finance_officer', 'finance_reviewer'].includes(membershipRole)
    );
    const effectiveRole = role || (userDoc.userType === 'client' ? 'client' : 'staff');
    const requestedFinanceEnabled = isFinance !== undefined
      ? Boolean(isFinance)
      : financeRole !== undefined
        ? Boolean(financeRole)
        : Boolean(currentFinanceMembershipRole);
    const effectiveIsFinance = effectiveRole === 'staff' && requestedFinanceEnabled;
    const effectiveFinanceRole = effectiveIsFinance
      ? (financeRole !== undefined
          ? financeRole
          : FINANCE_MEMBERSHIP_TO_PROFILE[currentFinanceMembershipRole] || userDoc.financeRole)
      : null;

    if (effectiveIsFinance && !['preparer', 'approver'].includes(effectiveFinanceRole)) {
      return NextResponse.json({ error: 'Choose either Finance Officer or Finance Reviewer.' }, { status: 400 });
    }

    // Budget Approver is a separate, independently-toggled organization role
    // (it can coexist with Finance Reviewer, but never with Finance Officer —
    // the preparer/validator can never also be the approver).
    const hasBudgetApproverKey = Object.prototype.hasOwnProperty.call(body, 'financeBudgetApprover');
    const currentHasBudgetApprover = currentMembershipRoles.includes('finance_budget_approver');
    const effectiveBudgetApprover = effectiveRole === 'client'
      ? false
      : (hasBudgetApproverKey ? Boolean(financeBudgetApprover) : currentHasBudgetApprover);
    if (effectiveBudgetApprover && effectiveIsFinance && effectiveFinanceRole === 'preparer') {
      return NextResponse.json({ error: 'A Finance Officer cannot also be a Budget Approver — segregation of duties requires a different person.' }, { status: 400 });
    }

    if (effectiveRole === 'client' && (isAdmin === true || isSupervisor === true || isFinance === true || financeRole || financeBudgetApprover === true)) {
      return NextResponse.json({ error: 'Client accounts cannot hold staff privilege roles.' }, { status: 400 });
    }
    if (effectiveRole === 'staff' && (
      (clientOrganizationIds !== undefined && (!Array.isArray(clientOrganizationIds) || clientOrganizationIds.length > 0)) ||
      (body.projectIds !== undefined && (!Array.isArray(body.projectIds) || body.projectIds.length > 0))
    )) {
      return NextResponse.json({ error: 'Staff accounts cannot hold client or project assignments.' }, { status: 400 });
    }
    const financeAssignmentChanged = role !== undefined || isFinance !== undefined || financeRole !== undefined || hasBudgetApproverKey;
    const nextOrganizationRoles = financeAssignmentChanged
      ? [
          ...currentMembershipRoles.filter((membershipRole) => !FINANCE_MEMBERSHIP_ROLES.includes(membershipRole)),
          ...(effectiveIsFinance ? [FINANCE_PROFILE_TO_MEMBERSHIP[effectiveFinanceRole]] : []),
          ...(effectiveBudgetApprover ? ['finance_budget_approver'] : []),
        ]
      : currentMembershipRoles;

    const assignments = effectiveRole === 'client'
      ? await validateClientAssignments(
        context.organizationId,
        clientOrganizationIds !== undefined ? clientOrganizationIds : (userDoc.clientOrganizationIds || []),
        body.projectIds !== undefined ? body.projectIds : (userDoc.projectIds || [])
      )
      : { clientOrganizationIds: [], projectIds: [], projects: [] };
    const validatedSupervisorId = effectiveRole === 'staff' && supervisorId !== undefined
      ? await validateSupervisorAssignment(context.organizationId, supervisorId, userId)
      : effectiveRole === 'client'
        ? null
        : userDoc.supervisorId || null;

    // Rebuild account-wide labels while preserving unrelated labels. Finance
    // roles are removed from legacy labels and maintained on the organization
    // membership below.
    let newRoleArray = null;
    if ([role, isAdmin, isSupervisor, isFinance, financeRole].some((value) => value !== undefined)) {
      const currentLabels = user.labels || [];
      const financeLabels = ['finance', ...FINANCE_MEMBERSHIP_ROLES];
      let newLabels = [...currentLabels];

      if (effectiveRole === 'client') {
        newLabels = newLabels.filter((label) => ![
          'staff', 'admin', 'supervisor', 'manager', ...financeLabels,
        ].includes(label));
        if (!newLabels.includes('client')) newLabels.push('client');
      } else {
        newLabels = newLabels.filter((label) => label !== 'client');
        if (!newLabels.includes('staff')) newLabels.push('staff');

        if (isAdmin === true && !newLabels.includes('admin')) newLabels.push('admin');
        if (isAdmin === false) newLabels = newLabels.filter((label) => label !== 'admin');
        if (isSupervisor === true && !newLabels.includes('supervisor')) newLabels.push('supervisor');
        if (isSupervisor === false) newLabels = newLabels.filter((label) => label !== 'supervisor');

        if (role !== undefined || isFinance !== undefined || financeRole !== undefined) {
          newLabels = newLabels.filter((label) => !financeLabels.includes(label));
        }
      }

      newLabels = [...new Set(newLabels)];
      newRoleArray = [...newLabels];
      const normalizedCurrent = [...currentLabels].sort();
      const normalizedNext = [...newLabels].sort();
      if (JSON.stringify(normalizedNext) !== JSON.stringify(normalizedCurrent)) {
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
    if (role !== undefined) dbUpdates.userType = role;
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

    if (effectiveRole === 'client') {
      dbUpdates.isAdmin = false;
      dbUpdates.isSupervisor = false;
      dbUpdates.isFinance = false;
      dbUpdates.financeRole = null;
    } else {
      if (isSupervisor !== undefined) dbUpdates.isSupervisor = isSupervisor;
      if (isFinance !== undefined || financeRole !== undefined) {
        dbUpdates.isFinance = effectiveIsFinance;
        dbUpdates.financeRole = effectiveFinanceRole;
      }
    }

    // Update supervisorId
    // If supervisorId is explicitly passed (even as empty string), update it
    // Convert empty string to null for storage
    if (supervisorId !== undefined || effectiveRole === 'client') {
      dbUpdates.supervisorId = validatedSupervisorId;
    }

    if (effectiveRole === 'staff') {
      if (department !== undefined) dbUpdates.department = department;
      if (role !== undefined && userDoc.userType === 'client') {
        dbUpdates.clientOrganizationIds = [];
        dbUpdates.projectIds = [];
      }
    } else if (effectiveRole === 'client') {
      dbUpdates.clientOrganizationIds = assignments.clientOrganizationIds;
      dbUpdates.projectIds = assignments.projectIds;
    }

    // Update the scoped membership first, then the compatibility profile. If
    // profile persistence fails, restore the exact membership role set.
    if (financeAssignmentChanged) {
      await adminTeams.updateMembership(
        context.organizationId,
        organizationMembership.$id,
        [...new Set(nextOrganizationRoles)]
      );
    }
    let updatedUser;
    try {
      updatedUser = await adminDatabases.updateDocument(
        DB_ID,
        COL_USERS,
        userDoc.$id,
        dbUpdates
      );
    } catch (profileError) {
      if (financeAssignmentChanged) {
        try {
          await adminTeams.updateMembership(
            context.organizationId,
            organizationMembership.$id,
            currentMembershipRoles
          );
        } catch {}
      }
      throw profileError;
    }

    if (status !== undefined) {
      await adminUsers.updateStatus(userId, !['inactive', 'suspended'].includes(status));
    }

    // Synchronize client project-team memberships after the profile update. The
    // profile change is the primary application access control; team sync keeps
    // Appwrite membership views aligned and never crosses the authenticated org.
    const assignmentsChanged = role !== undefined || clientOrganizationIds !== undefined || body.projectIds !== undefined;
    if (assignmentsChanged) {
      const currentProjectIds = Array.isArray(userDoc.projectIds) ? userDoc.projectIds : [];
      const newProjectIds = effectiveRole === 'client' ? assignments.projectIds : [];
      const projectsById = new Map(assignments.projects.map((project) => [project.$id, project]));

      for (const projectId of newProjectIds.filter((id) => !currentProjectIds.includes(id))) {
        const project = projectsById.get(projectId);
        if (!project?.projectTeamId) continue;
        try {
          await adminTeams.createMembership(project.projectTeamId, ['client_rep'], undefined, userId);
        } catch (error) {
          console.error(`Failed to add user to project ${projectId}:`, error.message);
        }
      }

      for (const projectId of currentProjectIds.filter((id) => !newProjectIds.includes(id))) {
        try {
          const project = await adminDatabases.getDocument(DB_ID, COLLECTIONS.PROJECTS, projectId);
          if (project.organizationId !== context.organizationId || !project.projectTeamId) continue;
          const memberships = await adminTeams.listMemberships(project.projectTeamId, [
            Query.equal('userId', userId),
            Query.limit(10),
          ]);
          await Promise.all(memberships.memberships.map((membership) => (
            adminTeams.deleteMembership(project.projectTeamId, membership.$id)
          )));
        } catch (error) {
          console.error(`Failed to remove user from project ${projectId}:`, error.message);
        }
      }
    }

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
    const response = apiErrorResponse(error);
    return NextResponse.json(
      response.status < 500 ? response.body : { error: error.message || 'Failed to update user' },
      { status: response.status }
    );
  }
}

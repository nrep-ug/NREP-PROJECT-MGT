import { NextResponse } from 'next/server';
import { sendAccountCreatedEmail } from '@/lib/nodemailer';
import { COLLECTIONS, adminDatabases, adminTeams, adminUsers, ID, Query } from '@/lib/appwriteAdmin';
import crypto from 'crypto';
import { getUserProfilePermissions } from '@/lib/rbac';
import { apiErrorResponse, requireAdmin, requireAuthenticatedContext } from '@/lib/serverAuth';
import { validateClientAssignments, validateSupervisorAssignment } from '@/lib/adminUserValidation';

const DB_ID = process.env.APPWRITE_DATABASE_ID || 'pms_db';
const COL_USERS = COLLECTIONS.USERS;
const FINANCE_MEMBERSHIP_ROLE = Object.freeze({
  preparer: 'finance_officer',
  approver: 'finance_reviewer',
});

/**
 * Generate a random password
 * @param {number} length
 * @returns {string}
 */
function generatePassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const bytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

/**
 * POST /api/admin/users
 * Create a new user account (admin only)
 */
export async function POST(request) {
  try {
    const context = await requireAuthenticatedContext(request);
    requireAdmin(context);
    const body = await request.json();
    const {
      email,
      username,
      firstName,
      lastName,
      otherNames,
      role, // 'admin', 'staff', or 'client'
      userType = 'staff', // 'staff' or 'client' - defaults to 'staff'
      organizationId,
      title,
      department,
      clientOrganizationIds = [], // Array of client organization IDs (for client users)
      projectIds = [],            // Array of project IDs to assign user to (for client users)
      sendEmail = true,
      isSupervisor = false,
      isFinance = false,
      financeRole = null
    } = body;

    // Validate required fields
    if (!email || !username || !firstName || !lastName || !role || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields: email, username, firstName, lastName, role, organizationId' },
        { status: 400 }
      );
    }

    if (organizationId !== context.organizationId) {
      return NextResponse.json({ error: 'Users can only be created in your organization.' }, { status: 403 });
    }
    if (isFinance && !['preparer', 'approver'].includes(financeRole)) {
      return NextResponse.json(
        { error: 'Choose either Finance Officer or Finance Reviewer.' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['admin', 'staff', 'client'];
    const rolesToCheck = Array.isArray(role) ? role : [role];
    const hasInvalidRole = rolesToCheck.some(r => !validRoles.includes(r));

    if (hasInvalidRole) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }
    if (rolesToCheck.includes('client') && rolesToCheck.some((item) => item !== 'client')) {
      return NextResponse.json(
        { error: 'Client accounts cannot also hold staff or administrator roles.' },
        { status: 400 }
      );
    }
    if (isFinance && (userType !== 'staff' || rolesToCheck.includes('client'))) {
      return NextResponse.json({ error: 'Finance roles can only be assigned to staff accounts.' }, { status: 400 });
    }

    // Validate userType
    const validUserTypes = ['staff', 'client'];
    if (!validUserTypes.includes(userType)) {
      return NextResponse.json(
        { error: `Invalid userType. Must be one of: ${validUserTypes.join(', ')}` },
        { status: 400 }
      );
    }
    const accountType = rolesToCheck.includes('client') ? 'client' : 'staff';
    if (userType !== accountType) {
      return NextResponse.json(
        { error: `userType must be ${accountType} for the selected role.` },
        { status: 400 }
      );
    }
    if (accountType === 'client' && isSupervisor) {
      return NextResponse.json({ error: 'Client accounts cannot be supervisors.' }, { status: 400 });
    }

    // Validate client-specific fields
    if (rolesToCheck.includes('client')) {
      // Ensure clientOrganizationIds is an array
      if (!Array.isArray(clientOrganizationIds)) {
        return NextResponse.json(
          { error: 'clientOrganizationIds must be an array' },
          { status: 400 }
        );
      }

      // Ensure projectIds is an array
      if (!Array.isArray(projectIds)) {
        return NextResponse.json(
          { error: 'projectIds must be an array' },
          { status: 400 }
        );
      }
    }

    // Validate every relationship before creating the Auth account so a bad
    // cross-organization identifier cannot leave a partially-created user.
    const assignments = accountType === 'client'
      ? await validateClientAssignments(organizationId, clientOrganizationIds, projectIds)
      : { clientOrganizationIds: [], projectIds: [], projects: [] };
    const validatedSupervisorId = accountType === 'staff'
      ? await validateSupervisorAssignment(organizationId, body.supervisorId)
      : null;

    // Account labels remain application-wide. Finance authority is stored on
    // the organization team membership so it cannot leak across organizations.
    let labels = accountType === 'client' ? ['client'] : ['staff'];
    if (accountType === 'staff' && rolesToCheck.includes('admin')) labels.push('admin');
    let roleArray = [...labels];

    // Add additional privilege labels
    if (isSupervisor) {
      labels.push('supervisor');
      if (!roleArray.includes('supervisor')) roleArray.push('supervisor');
    }

    // Ensure unique labels
    labels = [...new Set(labels)];
    roleArray = [...new Set(roleArray)];

    // Create the account and its access graph as one compensated operation.
    // Controlled account labels are applied last. Finance is scoped to the
    // organization membership created below.
    const password = generatePassword(12);
    let user;
    let organizationMembership;
    let userProfile;
    const projectMemberships = [];
    try {
      user = await adminUsers.create(
        ID.unique(),
        email,
        undefined,
        password,
        `${firstName} ${lastName}`
      );

      organizationMembership = await adminTeams.createMembership(
        organizationId,
        isFinance ? [FINANCE_MEMBERSHIP_ROLE[financeRole]] : [],
        undefined,
        user.$id
      );

      for (const project of assignments.projects) {
        const membership = await adminTeams.createMembership(
          project.projectTeamId,
          ['client_rep'],
          undefined,
          user.$id,
          undefined,
          undefined,
          `${firstName} ${lastName}`
        );
        projectMemberships.push({ teamId: project.projectTeamId, membershipId: membership.$id });
      }

      const permissions = getUserProfilePermissions(user.$id, organizationId);
      userProfile = await adminDatabases.createDocument(
        DB_ID,
        COL_USERS,
        ID.unique(),
        {
          accountId: user.$id,
          organizationId,
          email,
          username,
          firstName,
          lastName,
          otherNames: otherNames || null,
          role: roleArray,
          userType: accountType,
          status: 'active',
          title: title || null,
          department: department || null,
          timezone: 'Africa/Kampala',
          isAdmin: roleArray.includes('admin'),
          isSupervisor: Boolean(isSupervisor),
          isFinance: Boolean(isFinance),
          financeRole: isFinance ? financeRole : null,
          supervisorId: validatedSupervisorId,
          clientOrganizationIds: assignments.clientOrganizationIds,
          projectIds: assignments.projectIds,
        },
        permissions
      );

      await adminUsers.updateLabels(user.$id, labels);
    } catch (creationError) {
      if (userProfile?.$id) {
        try { await adminDatabases.deleteDocument(DB_ID, COL_USERS, userProfile.$id); } catch {}
      }
      for (const membership of projectMemberships.reverse()) {
        try { await adminTeams.deleteMembership(membership.teamId, membership.membershipId); } catch {}
      }
      if (organizationMembership?.$id) {
        try { await adminTeams.deleteMembership(organizationId, organizationMembership.$id); } catch {}
      }
      if (user?.$id) {
        try { await adminUsers.delete(user.$id); } catch {}
      }
      throw creationError;
    }

    // Send welcome email (if enabled)
    // Note: Appwrite doesn't have built-in email sending from server SDK
    // You would need to integrate with an email service like SendGrid, AWS SES, etc.
    let emailSent = false;
    if (sendEmail) {
      try {
        await sendAccountCreatedEmail({
          to: email,
          name: `${firstName} ${lastName}`,
          username: username, // Using email/username as login
          password: password,
          organizationName: 'NREP',
          loginUrl: process.env.NEXT_PUBLIC_APP_URL + '/login'
        });

        emailSent = true;
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        // We don't fail the request if email fails, but we'll return the password so admin can share it manually
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.$id,
        email: user.email,
        username: username,
        name: `${firstName} ${lastName}`,
        role: roleArray, // Return as array
        profileId: userProfile.$id
      },
      // Only return password if email wasn't sent (for manual delivery)
      ...((!emailSent && sendEmail) ? { temporaryPassword: password } : {})
    });

  } catch (error) {
    console.error('Error creating user:', error);

    let errorMessage = 'Failed to create user';
    let statusCode = 500;

    if (error.code === 409) {
      errorMessage = 'User with this email already exists';
      statusCode = 409;
    } else if (error.code === 404) {
      errorMessage = 'Organization or collection not found';
      statusCode = 404;
    } else if (error.message) {
      errorMessage = error.message;
    }

    const authError = apiErrorResponse(error);
    if (authError.status < 500) return NextResponse.json(authError.body, { status: authError.status });
    return NextResponse.json({ error: errorMessage, code: error.code, type: error.type }, { status: statusCode });
  }
}

/**
 * GET /api/admin/users
 * List all users in an organization (admin only)
 */
export async function GET(request) {
  try {
    const context = await requireAuthenticatedContext(request);
    requireAdmin(context);
    const { searchParams } = new URL(request.url);
    const requestedOrganizationId = searchParams.get('organizationId');
    const organizationId = context.organizationId;
    const clientOrganizationId = searchParams.get('clientOrganizationId');
    if (requestedOrganizationId && requestedOrganizationId !== organizationId) {
      return NextResponse.json({ error: 'Users can only be listed for your organization.' }, { status: 403 });
    }

    const queries = [Query.equal('organizationId', organizationId)];

    // Filter users belonging to a specific client organization
    // For array attributes, use Query.contains to check if the array contains the value
    if (clientOrganizationId) {
      queries.push(Query.contains('clientOrganizationIds', clientOrganizationId));
    }

    // Fetch all users in the organization
    const users = await adminDatabases.listDocuments(
      DB_ID,
      COL_USERS,
      queries
    );

    const organizationMemberships = await adminTeams.listMemberships(organizationId, [Query.limit(100)]);
    const membershipByUserId = new Map(
      organizationMemberships.memberships.map((membership) => [membership.userId, membership])
    );

    // Fetch account-wide labels for non-Finance roles and merge the exact
    // organization-scoped Finance roles for administration/display.
    const usersWithLabels = await Promise.all(
      users.documents.map(async (user) => {
        try {
          const authUser = await adminUsers.get(user.accountId);
          const financeRoles = (membershipByUserId.get(user.accountId)?.roles || [])
            .filter((role) => role.startsWith('finance_'));
          const scopedFinanceRole = financeRoles.includes('finance_reviewer')
            ? 'approver'
            : financeRoles.includes('finance_officer')
              ? 'preparer'
              : user.financeRole || null;
          return {
            ...user,
            isFinance: financeRoles.length > 0,
            financeRole: scopedFinanceRole,
            financeRoles,
            roles: [...(authUser.labels || []), ...financeRoles],
            labels: authUser.labels || []
          };
        } catch (error) {
          console.error(`Failed to fetch auth user for ${user.email}:`, error);
          return {
            ...user,
            roles: [],
            labels: []
          };
        }
      })
    );

    return NextResponse.json({
      users: usersWithLabels,
      total: users.total
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    const response = apiErrorResponse(error);
    return NextResponse.json(
      response.status < 500 ? response.body : { error: 'Failed to fetch users' },
      { status: response.status }
    );
  }
}

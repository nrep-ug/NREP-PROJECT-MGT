import { NextResponse } from 'next/server';
import { sendAccountCreatedEmail } from '@/lib/nodemailer';
import { adminDatabases, adminTeams, adminUsers, ID, Query } from '@/lib/appwriteAdmin';
import { verifyAdminAccess } from '@/lib/authHelpers';
import { getUserProfilePermissions } from '@/lib/rbac';

const DB_ID = process.env.APPWRITE_DATABASE_ID || 'pms_db';
const COL_USERS = 'pms_users';

/**
 * Generate a random password
 * @param {number} length
 * @returns {string}
 */
function generatePassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * POST /api/admin/users
 * Create a new user account (admin only)
 */
export async function POST(request) {
  try {
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
      requesterId, // ID of the user making the request (for authorization)
      isSupervisor = false,
      isFinance = false
    } = body;

    // Validate required fields
    if (!email || !username || !firstName || !lastName || !role || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields: email, username, firstName, lastName, role, organizationId' },
        { status: 400 }
      );
    }

    // Verify requester has admin access
    if (!requesterId) {
      return NextResponse.json(
        { error: 'Unauthorized: requesterId is required' },
        { status: 401 }
      );
    }

    const isAdmin = await verifyAdminAccess(requesterId);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create users' },
        { status: 403 }
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

    // Validate userType
    const validUserTypes = ['staff', 'client'];
    if (!validUserTypes.includes(userType)) {
      return NextResponse.json(
        { error: `Invalid userType. Must be one of: ${validUserTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate client-specific fields
    if (role === 'client') {
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

    // Generate random password
    const password = generatePassword(12);

    // Step 1: Create user account in Appwrite Auth
    const user = await adminUsers.create(
      ID.unique(),
      email,
      undefined, // phone
      password,
      `${firstName} ${lastName}`
    );

    // Step 2: Determine labels based on role and admin status
    // role can be a string or array, normalize it
    let labels = [];
    let roleArray = [];

    if (Array.isArray(role)) {
      // Role is already an array
      labels = [...role];
      roleArray = [...role];
    } else {
      // Role is a string, convert to array matching Appwrite labels
      if (role === 'admin') {
        labels = ['staff', 'admin'];
        roleArray = ['staff', 'admin'];
      } else if (role === 'staff') {
        labels = ['staff'];
        roleArray = ['staff'];
      } else if (role === 'client') {
        labels = ['client'];
        roleArray = ['client'];
      } else {
        labels = [role];
        roleArray = [role];
      }
    }

    // Add additional privilege labels
    if (isSupervisor) {
      labels.push('supervisor');
      if (!roleArray.includes('supervisor')) roleArray.push('supervisor');
    }

    if (isFinance) {
      labels.push('finance');
      if (!roleArray.includes('finance')) roleArray.push('finance');
    }

    // Ensure unique labels
    labels = [...new Set(labels)];
    roleArray = [...new Set(roleArray)];

    try {
      await adminUsers.updateLabels(user.$id, labels);
    } catch (e) {
      console.error(`Failed to add label to user. Full error:`, {
        message: e.message,
        code: e.code,
        type: e.type,
        response: e.response
      });
      throw new Error(`Failed to assign role: ${e.message}`);
    }

    // Step 3: Add user to organization team (for membership only, not role)
    try {
      const membership = await adminTeams.createMembership(
        organizationId,
        [], // No roles - just membership
        user.email, // email directly used to add user to the team
      );
    } catch (e) {
      console.error(`Failed to add user to team. Full error:`, {
        message: e.message,
        code: e.code,
        type: e.type,
        response: e.response
      });
      // Continue even if team membership fails - user can be added later
    }

    // Step 4: Create user profile document with permissions
    const permissions = getUserProfilePermissions(user.$id, organizationId);
    const userProfile = await adminDatabases.createDocument(
      DB_ID,
      COL_USERS,
      ID.unique(),
      {
        accountId: user.$id,
        organizationId: organizationId,
        email: email,
        username: username,
        firstName: firstName,
        lastName: lastName,
        otherNames: otherNames || null,
        role: roleArray, // Store as array matching Appwrite labels
        userType: userType,
        status: 'active',
        title: title || null,
        department: department || null,
        timezone: 'Africa/Kampala',
        isAdmin: roleArray.includes('admin'), // For easy querying
        isSupervisor: !!isSupervisor,
        isFinance: !!isFinance,
        supervisorId: body.supervisorId || null,
        clientOrganizationIds: roleArray.includes('client') ? clientOrganizationIds : []
      },
      permissions
    );

    // Step 5: Assign client user to projects (if projectIds provided)
    if (roleArray.includes('client') && projectIds.length > 0) {
      for (const projectId of projectIds) {
        try {
          // Get project to find its team ID
          const project = await adminDatabases.getDocument(DB_ID, 'pms_projects', projectId);

          // Add user to project team with client_rep role
          await adminTeams.createMembership(
            project.projectTeamId,
            ['client_rep'], // Role in the project team
            undefined,      // email (undefined since we're using userId)
            user.$id,       // userId
            undefined,      // phone
            undefined,             // url (empty string for no redirect)
            `${firstName} ${lastName}`
          );
        } catch (error) {
          console.error(`  ✗ Failed to add to project ${projectId}:`, error.message);
          // Continue with other projects even if one fails
        }
      }
    }

    // Step 6: Send welcome email (if enabled)
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

    return NextResponse.json(
      { error: errorMessage, code: error.code, type: error.type },
      { status: statusCode }
    );
  }
}

/**
 * GET /api/admin/users
 * List all users in an organization (admin only)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const clientOrganizationId = searchParams.get('clientOrganizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const queries = [Query.equal('organizationId', organizationId)];

    // Filter users belonging to a specific client organization
    // For array attributes, Query.equal checks if the array contains the value
    if (clientOrganizationId) {
      queries.push(Query.equal('clientOrganizationIds', clientOrganizationId));
    }

    // Fetch all users in the organization
    const users = await adminDatabases.listDocuments(
      DB_ID,
      COL_USERS,
      queries
    );

    // Fetch auth user details for each user to get their labels
    const usersWithLabels = await Promise.all(
      users.documents.map(async (user) => {
        try {
          // Get auth user to retrieve labels
          const authUser = await adminUsers.get(user.accountId);
          return {
            ...user,
            roles: authUser.labels || [], // Use labels as roles for display
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
    return NextResponse.json(
      { error: 'Failed to fetch users', message: error.message },
      { status: 500 }
    );
  }
}

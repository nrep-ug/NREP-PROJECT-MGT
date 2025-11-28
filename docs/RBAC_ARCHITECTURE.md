# RBAC Architecture - Role-Based Access Control

## Overview

The NREP Project Management System uses a two-tiered role-based access control (RBAC) system:

1. **Organization-level roles** (Appwrite Labels) - Define who a user is within the organization
2. **Project-level roles** (Appwrite Team Roles) - Define what a user can do within specific projects

This separation provides flexibility and scalability, allowing users to have different responsibilities across different projects.

---

## Organization-Level Roles (Appwrite Labels)

These roles are assigned as **Appwrite user labels** and define organization-wide permissions and identity.

### Role Definitions

#### 1. **Admin** (`admin` label)
- **Description**: Organization administrator with full system access
- **Labels assigned**: `["admin", "staff"]` (admins automatically get both labels)
- **Permissions**:
  - Create and manage users
  - Create and manage client organizations
  - Create and manage projects
  - Access admin panel
  - Perform all staff functions
  - Modify any project in the organization
- **Typical Users**: System administrators, directors

#### 2. **Staff** (`staff` label)
- **Description**: Organization employees who can be assigned to projects
- **Labels assigned**: `["staff"]`
- **Permissions**:
  - Can be assigned to projects with various project roles
  - View projects they're assigned to
  - Log time on assigned tasks
  - Access their profile and settings
- **Typical Users**: Project managers, developers, designers, QA testers, team leads

#### 3. **Client** (`client` label)
- **Description**: External users representing client organizations
- **Labels assigned**: `["client"]`
- **Permissions**:
  - Linked to one or more client organizations
  - Can be assigned to specific projects as client representatives
  - View-only access to assigned projects
  - View reports and progress
- **Typical Users**: Client stakeholders, project sponsors

---

## Project-Level Roles (Appwrite Team Roles)

These roles are assigned within **Appwrite project teams** and define what a user can do within that specific project. A user can have different roles in different projects.

### Role Definitions

See `lib/projectRoles.js` for complete role definitions and permissions.

#### 1. **Project Manager** (`manager`)
- Can modify project settings and team
- Can create, assign, and delete tasks
- Can approve timesheets and manage budgets
- Full project management capabilities

#### 2. **Team Lead** (`lead`)
- Can assign tasks and coordinate team members
- Can review work and timesheets
- Cannot modify project settings

#### 3. **Developer** (`developer`)
- Can work on assigned development tasks
- Can log time and update task status
- View-only access to other areas

#### 4. **Designer** (`designer`)
- Can work on assigned design tasks
- Can log time and update task status
- Similar permissions to Developer

#### 5. **QA / Tester** (`qa`)
- Can test functionality and report issues
- Can work on assigned QA tasks
- Can create issues and log time

#### 6. **Team Member** (`member`)
- General team member with basic access
- Can work on assigned tasks
- Can log time

#### 7. **Client Representative** (`client_rep`)
- **Only for client users**
- View-only access to project
- Can view tasks, reports, and documents
- Cannot modify anything

---

## Permission Matrix

| Action | Admin | Staff (Project Manager) | Staff (Other Roles) | Client |
|--------|-------|-------------------------|---------------------|--------|
| Create/Delete Users | ✅ | ❌ | ❌ | ❌ |
| Create/Edit Client Orgs | ✅ | ❌ | ❌ | ❌ |
| Create Projects | ✅ | ❌ | ❌ | ❌ |
| Modify Any Project | ✅ | Only if PM on project | ❌ | ❌ |
| Assign Team Members | ✅ | ✅ (if PM) | ✅ (if Lead) | ❌ |
| Create Tasks | ✅ | ✅ (if PM/Lead) | ❌ | ❌ |
| Work on Tasks | ✅ | ✅ | ✅ (if assigned) | ❌ |
| Approve Timesheets | ✅ | ✅ (if PM) | ❌ | ❌ |
| View Projects | ✅ (all) | ✅ (assigned) | ✅ (assigned) | ✅ (assigned) |

---

## Implementation Details

### User Creation Flow

When creating a user via `/api/admin/users`:

1. **Admin role selected**:
   ```javascript
   labels = ['admin', 'staff'] // Both labels assigned
   ```

2. **Staff role selected**:
   ```javascript
   labels = ['staff']
   ```

3. **Client role selected**:
   ```javascript
   labels = ['client']
   // Can be linked to multiple client organizations via clientOrganizationIds array
   ```

### Project Team Assignment

When assigning users to projects:

1. **Organization admins**: Automatically have full access to all projects
2. **Staff members**: Assigned to project team with specific role (manager, developer, etc.)
3. **Client users**: Assigned to project team with `client_rep` role

Example:
```javascript
// Adding a staff member as project manager
await adminTeams.createMembership(
  projectTeamId,
  ['manager'], // Project role
  email,
  userId
);

// Adding a client user
await adminTeams.createMembership(
  projectTeamId,
  ['client_rep'], // Project role
  email,
  userId
);
```

### Authorization Checks

#### Organization-Level Check (in components)
```javascript
const { user } = useAuth();

// Admin-only feature
if (user?.isAdmin) {
  // Show admin features
}

// Staff features (includes admins since they also have staff label)
if (user?.isStaff) {
  // Show staff features
}
```

#### Project-Level Check
```javascript
import { hasPermission } from '@/lib/projectRoles';

// Check if user can modify project based on their project role
const userProjectRoles = ['manager', 'lead'];
const canEdit = hasPermission('manager', 'project.update');
```

#### Combined Check (Admin + Project Manager)
```javascript
// Both org admins and project managers can modify project
const canModifyProject = user.isAdmin || hasPermission(userProjectRole, 'project.update');
```

---

## Database Schema

### User Labels (Appwrite Auth)
Stored in Appwrite's auth user labels:
```javascript
user.labels = ['admin', 'staff'] // Admin
user.labels = ['staff']          // Staff
user.labels = ['client']         // Client
```

### User Profile (pms_users collection)
```javascript
{
  accountId: string,
  organizationId: string,
  email: string,
  username: string,
  firstName: string,
  lastName: string,
  otherNames: string?,
  title: string?,
  department: string?,
  status: 'active' | 'invited' | 'inactive' | 'suspended',
  clientOrganizationIds: string[], // Array of client org IDs (for client users)
  timezone: string,
  avatarUrl: string?
}
```

### Project Teams (Appwrite Teams)
Each project has an associated team where members are assigned project-specific roles.

---

## Migration Notes

### Changes from Previous Architecture

**Before:**
- "Manager" was an organization-wide label
- Managers could edit all client organizations
- No distinction between org-level and project-level roles

**After:**
- "Manager" is now a project-specific role
- Only admins can edit client organizations
- Clear separation between organization membership and project responsibilities

### Required Actions

1. **Run database setup**:
   ```bash
   node scripts/collections-setup.js
   ```

2. **Update existing manager users**:
   - Users with "manager" label should be converted to "staff" label
   - Assign them "manager" role in their respective projects

3. **Review client management permissions**:
   - Only admins can now create/edit client organizations
   - Update any workflows that assumed managers could do this

---

## Best Practices

### 1. Assigning Roles

- **Default new employees to "staff"** unless they need admin access
- **Assign project roles when adding to projects**, not at user creation
- **Use "manager" role sparingly** - only for those truly managing a project
- **Client users should only have "client_rep" role** in projects

### 2. Permission Checks

- **Always check organization-level permissions** before project-level
- **For project modifications**: Check `isAdmin OR hasProjectRole('manager')`
- **For client features**: Check `isClient AND hasProjectRole('client_rep')`

### 3. UI Guidelines

- **Show all labels in admin panel** (admins will have multiple badges)
- **Show only highest priority project role** in project views
- **Disable features** based on permissions, don't just hide them

---

## Examples

### Example 1: Creating an Admin User
```javascript
POST /api/admin/users
{
  "email": "john@nrep.com",
  "username": "johndoe",
  "firstName": "John",
  "lastName": "Doe",
  "role": "admin", // Will receive ['admin', 'staff'] labels
  "organizationId": "org_12345",
  "requesterId": "admin_user_id"
}
```

### Example 2: Creating a Staff User
```javascript
POST /api/admin/users
{
  "email": "jane@nrep.com",
  "username": "janesmith",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "staff", // Will receive ['staff'] label
  "organizationId": "org_12345",
  "requesterId": "admin_user_id"
}
```

### Example 3: Creating a Client User and Assigning to Projects
```javascript
POST /api/admin/users
{
  "email": "client@example.com",
  "username": "clientuser",
  "firstName": "Client",
  "lastName": "User",
  "role": "client", // Will receive ['client'] label
  "clientOrganizationIds": ["client_org_1", "client_org_2"], // Linked to 2 orgs
  "projectIds": ["project_1", "project_2"], // Added to 2 projects with client_rep role
  "organizationId": "org_12345",
  "requesterId": "admin_user_id"
}
```

### Example 4: Assigning Project Manager Role
```javascript
// When creating/updating a project, assign a staff member as manager
await adminTeams.createMembership(
  projectTeamId,
  ['manager'], // Project-specific role
  'jane@nrep.com',
  'user_jane_id'
);
```

---

## Troubleshooting

### Issue: User can't access projects
**Check:**
1. Is user's status "active"?
2. Is user a member of the project team?
3. Does user have appropriate project role?

### Issue: Admin can't edit project
**Check:**
1. Does user have 'admin' label?
2. Is `isAdmin` field true in session?

### Issue: Client can edit things they shouldn't
**Check:**
1. Is user properly labeled as 'client'?
2. Is project role set to 'client_rep' (not another role)?
3. Are permission checks in place on the API?

---

## Related Files

- `lib/auth.js` - Session and authentication logic
- `lib/projectRoles.js` - Project role definitions and helpers
- `contexts/SessionContext.js` - Session state management
- `hooks/useAuth.js` - Authentication hook
- `app/api/admin/users/route.js` - User creation/management
- `app/admin/users/new/page.js` - User creation UI

---

## Future Enhancements

1. **Custom project roles**: Allow admins to create custom roles per project
2. **Fine-grained permissions**: More granular permission system
3. **Role inheritance**: Hierarchical role structures
4. **Temporary roles**: Time-limited project access
5. **Audit logging**: Track role changes and permission usage

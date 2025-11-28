# Client Management Redesign

## Overview

Redesigning the client management system to transform contact persons from static data fields into actual user accounts with proper relationships to client organizations and projects.

## Current Architecture (Problems)

**pms_clients:**
```javascript
{
  organizationId: "org_nrep",
  name: "Acme Corporation",
  contactName: "John Doe",        // Static text - can't log in
  contactEmail: "john@acme.com",  // Separate from user accounts
  contactPhone: "+256...",        // Not linked to user
  address: "...",
  website: "...",
  notes: "...",
  status: "active"
}
```

**Issues:**
- Contact persons can't log in to view projects
- Duplicate data if contact person is also a user
- Can't have multiple contact persons per client
- No relationship to projects
- Contact info gets stale

## New Architecture (Solution)

### 1. Database Schema Changes

#### **pms_users** (Modifications)

**Add New Attributes:**
```javascript
{
  // Existing fields...
  accountId: "user123",
  organizationId: "org_nrep",        // NREP organization (unchanged)
  email: "john@acme.com",
  username: "johndoe",
  firstName: "John",
  lastName: "Doe",
  role: "client",                    // User label/role

  // NEW FIELDS:
  clientOrganizationId: "client123", // Which client org they represent (nullable)
  // If user is a client, this links them to their client organization
  // For staff/admin/manager users, this is null
}
```

**Purpose:** Link client users to their client organizations

#### **pms_clients** (Modifications)

**Update Schema:**
```javascript
{
  organizationId: "org_nrep",
  name: "Acme Corporation",

  // NEW/MODIFIED FIELDS:
  primaryContactId: "user123",      // Reference to user account (nullable)

  // DEPRECATED (keep for backward compatibility, but optional):
  contactName: null,                // Legacy field
  contactEmail: null,               // Legacy field
  contactPhone: null,               // Legacy field

  // UNCHANGED:
  address: "...",
  website: "...",
  notes: "...",
  status: "active"
}
```

**Purpose:** Link to primary contact user, deprecate static contact fields

### 2. Relationship Model

```
┌─────────────────┐
│  NREP Org       │
│  (org_nrep)     │
└────────┬────────┘
         │
         ├──────────────────────────────────────┐
         │                                      │
         ▼                                      ▼
┌─────────────────┐                   ┌─────────────────┐
│  pms_users      │                   │  pms_clients    │
│  (Staff/Admin)  │                   │                 │
│                 │                   │  name: "Acme"   │
│  role: staff    │◄──────┐           │  primaryContact │
│  clientOrgId:   │       │           │  Id: "user456"  │
│  null           │       │           └────────┬────────┘
└─────────────────┘       │                    │
                          │                    │
                          │                    │
┌─────────────────┐       │                    │
│  pms_users      │       │                    │
│  (Clients)      │       └────────────────────┤
│                 │                            │
│  role: client   │◄───────────────────────────┘
│  clientOrgId:   │
│  "client123"    │
└────────┬────────┘
         │
         │ (via project teams)
         ▼
┌─────────────────┐
│  pms_projects   │
│                 │
│  clientId:      │
│  "client123"    │
│  projectTeamId  │
└─────────────────┘
```

### 3. User Flows

#### **Flow 1: Create Client Organization**

**Page:** `/clients/new` (new dedicated page)

**Steps:**
1. Admin fills in client organization details:
   - Name (required)
   - Address
   - Website
   - Notes

2. Admin selects primary contact person (optional):
   - Dropdown shows users with role="client" who:
     - Have no `clientOrganizationId` (unassigned)
     - OR already have this `clientOrganizationId` (if editing)
   - OR skip (leave primaryContactId as null)

3. System creates client organization
4. If contact selected, link them via primaryContactId

**API:** `POST /api/clients`
```javascript
{
  name: "Acme Corp",
  address: "...",
  website: "...",
  primaryContactId: "user456", // or null
  requesterId: "admin123"
}
```

#### **Flow 2: Create Client User**

**Page:** `/admin` (enhanced user creation form)

**When role="client" is selected, show additional fields:**

1. **Client Organization** (dropdown - optional):
   - List all client organizations
   - Can be left empty (user not linked to any client org yet)
   - Sets `clientOrganizationId` on user

2. **Projects** (multi-select dropdown - optional):
   - List all projects
   - Can select multiple or none
   - For each selected project:
     - Add user to project team with role "client_rep"

3. System creates user with label="client"
4. If client org selected, set clientOrganizationId
5. If projects selected, add to project teams

**API:** `POST /api/admin/users`
```javascript
{
  email: "john@acme.com",
  username: "johndoe",
  firstName: "John",
  lastName: "Doe",
  role: "client",
  clientOrganizationId: "client123", // new field
  projectIds: ["proj1", "proj2"],    // new field
  requesterId: "admin123"
}
```

#### **Flow 3: Edit Client Organization**

**Page:** `/clients/[id]/edit`

**Can update:**
- Organization details
- Primary contact person
- See all users linked to this organization
- Add/remove users from organization

#### **Flow 4: Assign Client User to Projects**

**Page:** `/projects/[id]/members` (existing)

**Enhanced:**
- When adding client user to project, they get "client_rep" role
- Can see which client org they represent

### 4. Migration Strategy

**For Existing Data:**

1. **Existing clients with static contact info:**
   ```javascript
   // Option A: Keep as-is (backward compatible)
   // Display: "John Doe (john@acme.com)" - static text

   // Option B: Create user accounts
   // 1. Create user with role="client"
   // 2. Link via primaryContactId
   // 3. Clear old contactName, contactEmail, contactPhone
   ```

2. **Phased migration:**
   - Phase 1: Add new fields, keep old fields for compatibility
   - Phase 2: Migrate existing data
   - Phase 3: Deprecate old fields

### 5. UI Changes Required

#### **New Pages:**
- `/clients/new` - Create client organization
- `/clients/[id]/edit` - Edit client organization
- `/clients/[id]/contacts` - Manage contact persons for client

#### **Modified Pages:**
- `/admin` - Enhanced user creation for clients
- `/clients` - Show linked contact persons instead of static text
- `/projects/[id]/members` - Show client organization affiliation

#### **New Components:**
- `ClientOrganizationForm` - Create/edit client org
- `ClientUserSelector` - Dropdown to select client users
- `ProjectSelector` - Multi-select for projects
- `ClientContactList` - Display all contacts for a client org

### 6. API Changes Required

#### **New Endpoints:**
```
GET    /api/clients/[id]/contacts      - Get all users for a client org
POST   /api/clients/[id]/contacts      - Add user to client org
DELETE /api/clients/[id]/contacts/[id] - Remove user from client org
```

#### **Modified Endpoints:**
```
POST   /api/admin/users    - Add clientOrganizationId, projectIds
PUT    /api/admin/users    - Update client user's organization
POST   /api/clients        - Add primaryContactId field
PUT    /api/clients/[id]   - Update primaryContactId
```

### 7. Validation Rules

**Client User Creation:**
- If role="client", clientOrganizationId is optional
- If clientOrganizationId provided, must be valid client org
- If projectIds provided, must be valid projects
- Can't assign non-client users to client organizations

**Client Organization Creation:**
- name is required
- primaryContactId must be a user with role="client"
- primaryContactId must be in same NREP organization

### 8. Benefits of New Architecture

✅ **Security:**
- Contact persons have proper authentication
- Can control which projects they access
- Audit trail of who accessed what

✅ **Data Integrity:**
- Single source of truth for contact information
- No duplicate data
- Relationships enforced by database

✅ **Flexibility:**
- Multiple contact persons per client
- Contact persons can be reassigned
- Easy to grant/revoke project access

✅ **User Experience:**
- Clients can log in to see their projects
- Staff can easily see who to contact
- Clear organizational structure

### 9. Implementation Checklist

**Database:**
- [ ] Add `clientOrganizationId` attribute to pms_users
- [ ] Add `primaryContactId` attribute to pms_clients
- [ ] Make contactName, contactEmail, contactPhone optional in pms_clients

**Backend:**
- [ ] Update user creation API to handle clientOrganizationId
- [ ] Update user creation API to handle projectIds
- [ ] Update client creation API to handle primaryContactId
- [ ] Create endpoint to list client users
- [ ] Update RBAC permissions for client users

**Frontend:**
- [ ] Create `/clients/new` page
- [ ] Create `/clients/[id]/edit` page
- [ ] Enhance user creation form for clients
- [ ] Update clients list to show linked contacts
- [ ] Create client user selector component
- [ ] Create project selector component

**Testing:**
- [ ] Test client org creation with/without contact
- [ ] Test client user creation with/without org
- [ ] Test project assignment for client users
- [ ] Test permission inheritance

### 10. Example Data Flow

**Scenario:** Create a new client organization with contact person

```javascript
// Step 1: Create client user
POST /api/admin/users
{
  email: "jane@acme.com",
  username: "janedoe",
  firstName: "Jane",
  lastName: "Doe",
  role: "client",
  clientOrganizationId: null, // Not assigned yet
  projectIds: [],
  requesterId: "admin123"
}
// Response: { user: { id: "user789", ... } }

// Step 2: Create client organization
POST /api/clients
{
  name: "Acme Corporation",
  address: "123 Main St",
  website: "https://acme.com",
  primaryContactId: "user789", // Link to Jane
  requesterId: "admin123"
}
// Response: { client: { $id: "client456", ... } }

// Step 3: Update user's clientOrganizationId
PUT /api/admin/users/user789
{
  clientOrganizationId: "client456",
  requesterId: "admin123"
}

// Step 4: Assign to projects
POST /api/projects/proj123/members
{
  userId: "user789",
  roles: ["client_rep"],
  requesterId: "admin123"
}
```

## Questions to Consider

1. **Can a client user belong to multiple client organizations?**
   - Current design: No (1:1 relationship)
   - If yes: Change clientOrganizationId to array

2. **Can a client organization have multiple primary contacts?**
   - Current design: Single primary + all users with clientOrganizationId
   - Alternative: Array of contact IDs

3. **What happens when primary contact leaves?**
   - Remove primaryContactId (set to null)
   - Optionally reassign to another user

4. **Should we migrate existing static contacts to user accounts?**
   - Recommended: Yes, but gradually
   - Create users for active clients first

5. **How to handle external contacts who don't need login?**
   - Keep static fields as fallback
   - Use primaryContactId when user account exists

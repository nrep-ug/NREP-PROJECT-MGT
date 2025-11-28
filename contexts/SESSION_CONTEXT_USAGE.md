# Session Context Usage Guide

The SessionContext provides user session data throughout the application, reducing unnecessary queries to Appwrite.

## What's Available in the Session

The session object contains:

```javascript
{
  // Auth user
  authUser: {...},              // Appwrite auth user object

  // Profile data
  profile: {...},               // Full profile object
  accountId: "...",
  email: "user@example.com",
  username: "username",
  firstName: "John",
  lastName: "Doe",
  otherNames: "Middle",
  status: "active",
  title: "Senior Developer",
  department: "Engineering",
  timezone: "Africa/Kampala",
  avatarUrl: "https://...",

  // Organization data
  organization: {...},          // Full organization object
  organizationId: "org_nrep",
  organizationName: "NREP",

  // Role labels and permissions
  labels: ["admin"],            // Array of role labels
  isAdmin: true,
  isManager: true,
  isStaff: true,
  isClient: false,
}
```

## Usage Examples

### 1. Basic Usage - Get Current User

```javascript
'use client';

import { useSession } from '@/contexts/SessionContext';

export default function UserProfile() {
  const { session, loading, error } = useSession();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!session) return <div>Not authenticated</div>;

  return (
    <div>
      <h1>Welcome, {session.firstName} {session.lastName}!</h1>
      <p>Email: {session.email}</p>
      <p>Username: @{session.username}</p>
      <p>Organization: {session.organizationName}</p>
    </div>
  );
}
```

### 2. Using the Shorthand Hook - useUser()

```javascript
'use client';

import { useUser } from '@/contexts/SessionContext';

export default function Greeting() {
  const user = useUser();

  if (!user) return null;

  return <h2>Hello, {user.firstName}!</h2>;
}
```

### 3. Checking Authentication Status

```javascript
'use client';

import { useAuth } from '@/contexts/SessionContext';

export default function ProtectedContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please log in</div>;

  return <div>Protected content here</div>;
}
```

### 4. Role-Based Access Control

```javascript
'use client';

import { useUser } from '@/contexts/SessionContext';

export default function AdminPanel() {
  const user = useUser();

  if (!user?.isAdmin) {
    return <div>Access denied. Admin privileges required.</div>;
  }

  return (
    <div>
      <h1>Admin Panel</h1>
      {/* Admin-only content */}
    </div>
  );
}
```

### 5. Conditional Rendering Based on Role

```javascript
'use client';

import { useUser } from '@/contexts/SessionContext';

export default function Dashboard() {
  const user = useUser();

  return (
    <div>
      <h1>Dashboard</h1>

      {user?.isAdmin && (
        <section>
          <h2>Admin Tools</h2>
          {/* Admin-only features */}
        </section>
      )}

      {user?.isManager && (
        <section>
          <h2>Manager Tools</h2>
          {/* Manager features */}
        </section>
      )}

      {user?.isStaff && (
        <section>
          <h2>Staff Features</h2>
          {/* Staff features */}
        </section>
      )}
    </div>
  );
}
```

### 6. Refreshing the Session After Profile Update

```javascript
'use client';

import { useState } from 'react';
import { useSession } from '@/contexts/SessionContext';

export default function EditProfile() {
  const { session, refreshSession } = useSession();
  const [formData, setFormData] = useState({
    firstName: session?.firstName || '',
    lastName: session?.lastName || '',
    title: session?.title || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Update profile via API
      const response = await fetch(`/api/users/${session.accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // Refresh the session to get updated data
        await refreshSession();
        alert('Profile updated successfully!');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit">Update Profile</button>
    </form>
  );
}
```

### 7. Clearing Session on Logout

```javascript
'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/contexts/SessionContext';
import { account } from '@/lib/appwriteClient';

export default function LogoutButton() {
  const router = useRouter();
  const { clearSession } = useSession();

  const handleLogout = async () => {
    try {
      // Delete Appwrite session
      await account.deleteSession('current');

      // Clear the context
      clearSession();

      // Redirect to login
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return <button onClick={handleLogout}>Logout</button>;
}
```

### 8. Accessing Organization Data

```javascript
'use client';

import { useUser } from '@/contexts/SessionContext';

export default function OrganizationInfo() {
  const user = useUser();

  return (
    <div>
      <h3>Organization</h3>
      <p>Name: {user?.organizationName}</p>
      <p>ID: {user?.organizationId}</p>
      <p>Status: {user?.organization?.isActive ? 'Active' : 'Inactive'}</p>
    </div>
  );
}
```

### 9. Using Labels for Custom Permissions

```javascript
'use client';

import { useUser } from '@/contexts/SessionContext';

export default function FeatureToggle() {
  const user = useUser();

  // Check if user has specific label
  const hasLabel = (label) => user?.labels?.includes(label);

  return (
    <div>
      {hasLabel('admin') && <button>Admin Feature</button>}
      {hasLabel('manager') && <button>Manager Feature</button>}
      {hasLabel('staff') && <button>Staff Feature</button>}
      {hasLabel('client') && <button>Client Portal</button>}
    </div>
  );
}
```

### 10. Server Component Pattern (No Direct Access)

Note: Session context only works in client components. For server components, use the `getUserSession()` function directly:

```javascript
// app/dashboard/page.js (Server Component)
import { getUserSession } from '@/lib/auth';
import ClientDashboard from './ClientDashboard';

export default async function DashboardPage() {
  const session = await getUserSession();

  if (!session) {
    redirect('/login');
  }

  return <ClientDashboard initialSession={session} />;
}
```

## API Reference

### Hooks

#### `useSession()`
Returns the full session context.

```javascript
const { session, loading, error, refreshSession, clearSession } = useSession();
```

#### `useUser()`
Shorthand to get the current user session.

```javascript
const user = useUser();
```

#### `useAuth()`
Get authentication status.

```javascript
const { isAuthenticated, loading } = useAuth();
```

### Methods

#### `refreshSession()`
Refetch the session data from Appwrite. Useful after profile updates.

```javascript
await refreshSession();
```

#### `clearSession()`
Clear the session from context. Useful on logout.

```javascript
clearSession();
```

## Performance Benefits

1. **Single Query on Mount**: Session data is loaded once when the app starts
2. **No Redundant Queries**: Components can access user data without additional API calls
3. **Instant Access**: No loading states needed for basic user info in most components
4. **Controlled Refresh**: Only refresh when needed (after profile updates)

## Best Practices

1. **Always check for null**: `if (!user) return null;`
2. **Use loading state**: Show loading indicators while session is being fetched
3. **Refresh after updates**: Call `refreshSession()` after profile/org updates
4. **Clear on logout**: Always call `clearSession()` when user logs out
5. **Use shorthand hooks**: Use `useUser()` for simple access, `useSession()` when you need methods

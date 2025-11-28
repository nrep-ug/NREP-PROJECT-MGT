# NREP Project Management System

A production-ready Project Management System built with **Next.js 14 (App Router)** and **Appwrite**. This system provides comprehensive project management capabilities including projects, tasks, milestones, timesheets, document management, and client portals.

## Features

- **Project Management**: Create and manage projects with clients, budgets, and timelines
- **Task Tracking**: Kanban-style task boards with priorities and assignments
- **Milestones**: Track project milestones and deadlines
- **Timesheets**: Weekly timesheet management with approval workflows
- **Document Management**: Upload and version documents with secure storage
- **Embeds**: Integrate external content (Google Slides, Figma, etc.)
- **Client Portal**: Read-only access for clients
- **RBAC**: Role-based access control using Appwrite Teams
- **Responsive UI**: Built with React Bootstrap

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: JavaScript (no TypeScript)
- **Backend**: Appwrite (Database, Storage, Teams, Auth)
- **UI**: React + react-bootstrap
- **Date/Time**: moment + moment-timezone (Africa/Kampala)
- **Additional**: react-select, react-calendar

## Prerequisites

- Node.js 18+ and npm 9+
- Appwrite instance (Cloud or self-hosted)
- Appwrite project with API key

## Setup Instructions

### 1. Clone and Install

```bash
# Clone the repository
cd "NREP Project MGT"

# Install dependencies
npm install
```

### 2. Configure Appwrite

#### Option A: Using Appwrite Cloud

1. Go to [cloud.appwrite.io](https://cloud.appwrite.io)
2. Create a new project
3. Note your Project ID and Endpoint
4. Go to Settings > API Keys and create a new API key with full permissions

#### Option B: Self-hosted Appwrite

1. Install Appwrite following [official docs](https://appwrite.io/docs/installation)
2. Create a new project
3. Generate an API key with full permissions

### 3. Environment Variables

Create a `.env.local` file in the project root:

```bash
# Copy from example
cp .env.example .env.local
```

Edit `.env.local` with your Appwrite credentials:

```bash
# Appwrite Configuration
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id-here
APPWRITE_API_KEY=your-api-key-here
APPWRITE_DATABASE_ID=pms_db

# Storage Buckets
APPWRITE_BUCKET_DOCS=pms-project-docs
APPWRITE_BUCKET_VERSIONS=pms-doc-versions

# Teams Bootstrap
ORG_NAME=NREP
APPWRITE_INVITE_REDIRECT=http://localhost:3000/auth/callback

# Email Configuration (optional - for timesheet notifications)
# Leave blank to disable email sending (emails will be logged instead)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=NREP PMS <noreply@nrep.com>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Database Setup

Run the collections setup script to create all database collections, attributes, and indexes:

```bash
npm run setup:collections
```

This script is **idempotent** - safe to run multiple times.

Expected output:
```
== PMS Collections Setup ==
✓ Database exists: pms_db
  ✓ Collection exists: pms_organizations
    + attribute: pms_organizations.name (string)
    ...
✓ Bucket exists: pms-project-docs
✓ Done.
```

### 5. Bootstrap Organization and Admin User

**Recommended: Use the Web-Based Setup (Easy!)**

Run the setup server and open your browser:

```bash
npm run setup
```

This will start a web server at `http://localhost:3001` with a beautiful form where you can:
- Create your organization
- Set up the first admin user account
- Set the admin password
- **Automatically updates `.env.local`** with your organization configuration

The setup is instant and works perfectly on Windows!

**Alternative: Command-Line Setup**

If you prefer the command line (or need to batch-invite users):

```bash
# Interactive CLI wizard
npm run setup:teams

# Or batch invite from JSON file
node scripts/teams-bootstrap.js --org "Your Org Name" --users ./seed-users.json
```

**Note**: The web-based setup (`npm run setup`) is recommended for the initial admin account creation, especially on Windows.

### 6. Configure Appwrite Redirect URL

In your Appwrite Console:

1. Go to **Auth > Settings**
2. Add `http://localhost:3000/auth/callback` to **Success URLs**
3. Add `http://localhost:3000/login` to **Failure URLs**

For production, add your production URLs as well.

### 7. Start Development Server

After completing the setup, close the setup server (Ctrl+C) and start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 8. First Login

1. Go to `http://localhost:3000/login`
2. Enter the admin email and password you created during setup
3. You'll be redirected to the dashboard
4. Navigate to the Admin panel to invite other users

## Project Structure

```
NREP Project MGT/
├── app/                      # Next.js App Router pages
│   ├── api/                  # API routes (server-side)
│   │   ├── projects/         # Project CRUD
│   │   ├── timesheets/       # Timesheet management
│   │   ├── documents/        # Document registration
│   │   ├── embeds/           # Embed management
│   │   └── admin/            # Admin operations
│   ├── dashboard/            # Dashboard page
│   ├── projects/             # Projects pages
│   │   └── [id]/             # Project detail with tabs
│   ├── clients/              # Clients management
│   ├── timesheets/           # Timesheet entry
│   ├── admin/                # Admin panel
│   ├── login/                # Login page
│   └── auth/                 # Auth callback
├── components/               # React components
│   ├── project/              # Project tab components
│   ├── AppLayout.js          # Main layout with sidebar
│   ├── Sidebar.js            # Navigation sidebar
│   ├── LoadingSpinner.js     # Loading state
│   └── Toast.js              # Toast notifications
├── hooks/                    # Custom React hooks
│   └── useAuth.js            # Authentication hook
├── lib/                      # Utility libraries
│   ├── appwriteAdmin.js      # Server-side Appwrite client
│   ├── appwriteClient.js     # Client-side Appwrite SDK
│   ├── auth.js               # Auth utilities
│   ├── rbac.js               # Role-based access control
│   └── date.js               # Date/timezone utilities
├── scripts/                  # Bootstrap scripts
│   ├── collections-setup.js  # Create database schema
│   └── teams-bootstrap.js    # Create org and invite users
├── seed-users.json           # Default users for bootstrap
├── .env.example              # Environment variables template
├── .env.local                # Your local environment (not in git)
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## Key Concepts

### RBAC Model

The system uses **Appwrite Teams** for role-based access control:

#### Organization Team
- **admin**: Full access, can manage users and projects
- **manager**: Can manage projects, approve timesheets
- **staff**: Can work on assigned tasks, log timesheets
- **client**: Read-only access to assigned projects

#### Project Team (per-project)
- **owner**: Full control over project
- **manager**: Can manage project resources
- **contributor**: Can work on tasks
- **viewer**: Read-only access
- **client_rep**: Client representative

### Document Permissions

All collections use **Document Security** with per-document permissions:

- **Projects**: Read by Org team, Update/Delete by Org admins + Project managers
- **Timesheets**: Read/Update by owner + Org managers
- **Documents**: Read by Org + Project teams, Update/Delete by managers
- **Tasks/Milestones**: Read by Org + Project teams, Update by managers

### Hybrid Architecture

The system uses a **hybrid approach**:

- **Client-side (Web SDK)**: For safe user operations (reading data, creating tasks, logging time)
- **Server-side (API routes with API key)**: For privileged operations (creating projects, teams, approvals)

This ensures:
- API keys never expose to client
- Cross-tenant data isolation
- Proper permission enforcement

### Timezone Handling

- All dates stored in **UTC** in Appwrite
- Displayed in **Africa/Kampala timezone** on UI
- Use `lib/date.js` utilities for all date operations

## Usage

### Creating a Project

1. Go to **Projects** page
2. Click **+ New Project**
3. Fill in project details (code, name, client, dates, budget)
4. Click **Create Project**

This will:
- Create a project document
- Create a project-specific Team
- Set proper permissions
- Add you as project owner

### Managing Tasks

1. Open a project
2. Go to **Tasks** tab
3. Click **+ Add Task**
4. Tasks appear in Kanban columns by status

### Logging Time

1. Go to **Timesheets**
2. Select week using calendar
3. Add entries (project, date, hours, notes)
4. Click **Submit for Approval** when complete

Managers can approve timesheets in the approval view.

### Uploading Documents

1. Open a project
2. Go to **Documents** tab
3. Click file upload button
4. Document uploads to Appwrite Storage and registers version

### Adding Embeds

1. Open a project
2. Go to **Embeds** tab
3. Click **+ Add Embed**
4. Enter HTTPS URL (e.g., Google Slides share link)
5. Embed renders responsively

## Email Notifications

The system supports email notifications for timesheet workflow actions. Notifications are sent when:

- **Employee submits timesheet**: Admins and project managers receive email notification
- **Manager approves timesheet**: Employee receives approval confirmation email
- **Manager rejects timesheet**: Employee receives rejection email with comments

### Setting Up Email Notifications

#### 1. Install Nodemailer

```bash
npm install nodemailer
```

#### 2. Configure Email Environment Variables

Add these variables to your `.env.local` file:

```bash
# Email Configuration (for notifications)
# SMTP settings for sending email notifications
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=NREP PMS <noreply@nrep.com>

# Application URL (required for email links)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 3. Gmail Setup (if using Gmail)

1. Enable 2-Factor Authentication on your Google account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Generate an App Password for "Mail"
4. Use the generated password as `EMAIL_PASSWORD`

**Note**: Regular Gmail password won't work; you must use an App Password.

#### 4. Other Email Providers

For other SMTP providers (Outlook, SendGrid, etc.), update:

- `EMAIL_HOST`: Your SMTP server hostname
- `EMAIL_PORT`: SMTP port (usually 587 for TLS, 465 for SSL)
- `EMAIL_USER`: Your SMTP username
- `EMAIL_PASSWORD`: Your SMTP password

#### 5. Development Mode

If email credentials are not configured, the system will:
- Log email details to console instead of sending
- Continue working normally without sending actual emails
- This allows development without SMTP setup

### Email Templates

The system includes pre-designed email templates for:

1. **Timesheet Submitted**: Notifies approvers with total hours and review link
2. **Timesheet Approved**: Confirms approval to employee with approver name
3. **Timesheet Rejected**: Notifies employee with rejection reason and feedback

All templates are mobile-responsive and include:
- Professional styling with NREP branding
- Clear call-to-action buttons
- Relevant timesheet details (week, hours, etc.)
- Plain-text fallback for email clients that don't support HTML

### Testing Email Notifications

To test notifications:

1. Submit a timesheet as an employee
2. Check logs or email inbox for notification
3. Approve/reject a timesheet as a manager
4. Verify employee receives email

In development mode (without SMTP), check the console logs for email details.

## Scripts

### Collections Setup

```bash
npm run setup:collections
# or
node scripts/collections-setup.js
```

Creates database, collections, attributes, indexes, and buckets. Idempotent.

### Organization & Admin Setup

```bash
# Web-based setup (recommended)
npm run setup

# CLI-based setup
npm run setup:teams

# Batch invite users from JSON
node scripts/teams-bootstrap.js --org "NREP" --users ./seed-users.json
```

The web-based setup (`npm run setup`) opens a browser interface for easy organization and admin account creation.

## API Routes

### Projects
- `GET /api/projects?organizationId=xxx` - List projects
- `POST /api/projects` - Create project (creates team + permissions)
- `GET /api/projects/[id]` - Get project
- `PATCH /api/projects/[id]` - Update project

### Timesheets
- `POST /api/timesheets` - Create/update timesheet + add entries
- `PATCH /api/timesheets` - Submit/approve/reject timesheet

### Documents
- `POST /api/documents` - Register document after Storage upload

### Embeds
- `GET /api/embeds?projectId=xxx` - List embeds
- `POST /api/embeds` - Create embed

### Admin
- `POST /api/admin/bootstrap/collections` - Run collections setup
- `POST /api/admin/bootstrap/teams` - Run teams bootstrap

## Building for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Environment Variables for Production

Update `.env.local` (or your hosting platform's env vars):

```bash
# Use your production Appwrite endpoint
APPWRITE_ENDPOINT=https://your-appwrite-domain.com/v1

# Update redirect URL
APPWRITE_INVITE_REDIRECT=https://your-domain.com/auth/callback
```

Also update Appwrite Console with production redirect URLs.

## Troubleshooting

### "Missing required environment variables"

Ensure `.env.local` exists with all required variables. Restart dev server after changes.

### "Collection not found" error

Run `npm run setup:collections` to create database schema.

### "Team not found" error

Run `npm run setup:teams` to create organization team.

### Users not receiving invitations

1. Check Appwrite Console > Auth > Settings
2. Verify SMTP configuration
3. Check spam folders
4. Use Appwrite Console to manually create users if needed

### Permission denied errors

1. Ensure user is member of organization team
2. Check user roles in Appwrite Console > Auth > Teams
3. Verify document permissions in code

### Storage/Document upload fails

1. Verify buckets exist (run collections setup)
2. Check bucket permissions in Appwrite Console
3. Ensure CORS settings allow your domain

## Development Notes

### Adding New Collections

1. Add collection spec to `scripts/collections-setup.js`
2. Run `npm run setup:collections`
3. Add constant to `lib/appwriteClient.js` COLLECTIONS object
4. Create API routes and UI components

### Modifying Permissions

Edit `lib/rbac.js` functions:
- `getOrgDocPermissions()` - For org-scoped resources
- `getProjectDocPermissions()` - For project resources
- `getTimesheetPermissions()` - For timesheets

### Timezone Changes

To use a different timezone, update `DEFAULT_TIMEZONE` in `lib/date.js`.

## Security Considerations

- **API Key**: Keep `APPWRITE_API_KEY` secret, server-only
- **Document Security**: Enabled for all collections
- **Organization Scoping**: Always filter by `organizationId`
- **HTTPS Only**: Embeds must use HTTPS URLs
- **Session Management**: Appwrite handles session cookies
- **CORS**: Configure in Appwrite Console for production

## Support

For issues or questions:

1. Check this README
2. Review Appwrite documentation: [appwrite.io/docs](https://appwrite.io/docs)
3. Check Next.js documentation: [nextjs.org/docs](https://nextjs.org/docs)

## License

This project is for NREP internal use. All rights reserved.

---

**Built with ❤️ using Next.js and Appwrite**

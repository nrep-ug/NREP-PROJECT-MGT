/**
 * Migration: Seed Default Project Roles
 *
 * For each existing project that doesn't already have roles in pms_project_roles,
 * seeds the 7 default role templates (manager, lead, developer, designer, QA, member, client_rep).
 *
 * Usage:
 *   node scripts/migrate-project-roles.js
 *
 * Requires:
 *   - APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY in .env.local
 *   - APPWRITE_DATABASE_ID (or uses default)
 */

require('dotenv').config({ path: '.env.local' });

const { Client, Databases, ID, Query } = require('node-appwrite');

const ENDPOINT = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68fb5845001d32f31656';

const COL_PROJECTS = process.env.NEXT_PUBLIC_APPWRITE_COL_PROJECTS || 'pms_projects';
const COL_ROLES = process.env.NEXT_PUBLIC_APPWRITE_COL_PROJECT_ROLES || 'pms_project_roles';

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error('Missing required environment variables: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

// Default role templates — same as in lib/projectRoles.js
const DEFAULT_ROLE_TEMPLATES = [
  {
    slug: 'manager',
    name: 'Project Manager',
    description: 'Can manage project settings, team members, and approve work',
    color: '#0d6efd',
    permissions: [
      'project.update', 'project.delete', 'team.manage',
      'task.create', 'task.update', 'task.delete', 'task.assign',
      'timesheet.approve', 'budget.manage',
    ],
    priority: 100,
    isDefault: true,
    isStaffRole: true,
  },
  {
    slug: 'lead',
    name: 'Team Lead',
    description: 'Can assign tasks, review work, and coordinate team members',
    color: '#0dcaf0',
    permissions: [
      'task.create', 'task.update', 'task.assign', 'task.review',
      'timesheet.review',
    ],
    priority: 80,
    isDefault: true,
    isStaffRole: true,
  },
  {
    slug: 'developer',
    name: 'Developer',
    description: 'Can work on development tasks and log time',
    color: '#198754',
    permissions: [
      'task.view', 'task.update_assigned',
      'timesheet.create', 'timesheet.update_own',
    ],
    priority: 60,
    isDefault: true,
    isStaffRole: true,
  },
  {
    slug: 'designer',
    name: 'Designer',
    description: 'Can work on design tasks and log time',
    color: '#ffc107',
    permissions: [
      'task.view', 'task.update_assigned',
      'timesheet.create', 'timesheet.update_own',
    ],
    priority: 60,
    isDefault: true,
    isStaffRole: true,
  },
  {
    slug: 'qa',
    name: 'QA / Tester',
    description: 'Can test, report issues, and log time',
    color: '#6c757d',
    permissions: [
      'task.view', 'task.update_assigned', 'task.test',
      'issue.create', 'timesheet.create', 'timesheet.update_own',
    ],
    priority: 60,
    isDefault: true,
    isStaffRole: true,
  },
  {
    slug: 'member',
    name: 'Team Member',
    description: 'General team member with basic project access',
    color: '#343a40',
    permissions: [
      'task.view', 'task.update_assigned',
      'timesheet.create', 'timesheet.update_own',
    ],
    priority: 40,
    isDefault: true,
    isStaffRole: true,
  },
  {
    slug: 'client_rep',
    name: 'Client Representative',
    description: 'Can view project progress, tasks, and reports',
    color: '#6f42c1',
    permissions: [
      'project.view', 'task.view', 'report.view', 'document.view',
    ],
    priority: 20,
    isDefault: true,
    isStaffRole: false,
  },
];

async function migrate() {
  console.log('=== Project Roles Migration ===');
  console.log(`Database: ${DB_ID}`);
  console.log(`Projects collection: ${COL_PROJECTS}`);
  console.log(`Roles collection: ${COL_ROLES}`);
  console.log('');

  // Fetch all projects
  let allProjects = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const batch = await databases.listDocuments(DB_ID, COL_PROJECTS, [
      Query.limit(limit),
      Query.offset(offset),
    ]);
    allProjects = allProjects.concat(batch.documents);
    if (batch.documents.length < limit) break;
    offset += limit;
  }

  console.log(`Found ${allProjects.length} project(s).`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const project of allProjects) {
    try {
      // Check if roles already exist for this project
      const existingRoles = await databases.listDocuments(DB_ID, COL_ROLES, [
        Query.equal('projectId', project.$id),
        Query.limit(1),
      ]);

      if (existingRoles.total > 0) {
        console.log(`  ⏭ ${project.code} (${project.$id}) — already has ${existingRoles.total} role(s), skipping`);
        skipped++;
        continue;
      }

      // Seed default roles
      let rolesCreated = 0;
      for (const template of DEFAULT_ROLE_TEMPLATES) {
        await databases.createDocument(DB_ID, COL_ROLES, ID.unique(), {
          projectId: project.$id,
          slug: template.slug,
          name: template.name,
          description: template.description,
          color: template.color,
          permissions: template.permissions,
          priority: template.priority,
          isDefault: template.isDefault,
          isStaffRole: template.isStaffRole,
          createdBy: project.createdBy || null,
        });
        rolesCreated++;
      }

      console.log(`  ✅ ${project.code} (${project.$id}) — seeded ${rolesCreated} role(s)`);
      migrated++;
    } catch (err) {
      console.error(`  ❌ ${project.code} (${project.$id}) — ERROR: ${err.message}`);
      errors++;
    }
  }

  console.log('');
  console.log('=== Migration Summary ===');
  console.log(`  Projects migrated: ${migrated}`);
  console.log(`  Projects skipped:  ${skipped}`);
  console.log(`  Errors:            ${errors}`);
  console.log(`  Total projects:    ${allProjects.length}`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

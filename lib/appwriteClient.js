/**
 * Client-side Appwrite SDK for safe user operations
 * Use in React components and client-side hooks
 */

import { Client, Account, Databases, Storage, Teams, Query, ID, Permission, Role } from 'appwrite';

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

if (!ENDPOINT || !PROJECT_ID) {
  console.error('[appwriteClient] Missing required environment variables');
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID);

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
const teams = new Teams(client);

export {
  client,
  account,
  databases,
  storage,
  teams,
  Query,
  ID,
  Permission,
  Role,
};

// Export collection names and IDs as constants
export const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68fb5845001d32f31656';

export const COLLECTIONS = {
  ORGANIZATIONS: 'pms_organizations',
  USERS: 'pms_users',
  CLIENTS: 'pms_clients',
  PROJECTS: 'pms_projects',
  MILESTONES: 'pms_milestones',
  TASKS: 'pms_tasks',
  TASK_ASSIGNMENTS: 'pms_task_assignments',
  TASK_COMMENTS: 'pms_task_comments',
  TIMESHEETS: 'pms_timesheets',
  TIMESHEET_ENTRIES: 'pms_timesheet_entries',
  DOCUMENTS: 'pms_documents',
  DOCUMENT_VERSIONS: 'pms_document_versions',
  EMBEDS: 'pms_embeds',
  FX_RATES: 'pms_fx_rates',
};

export const BUCKET_DOCS = 'pms-project-docs';
export const BUCKET_VERSIONS = 'pms-doc-versions';

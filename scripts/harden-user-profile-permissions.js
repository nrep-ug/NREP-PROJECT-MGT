#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Restrict user-profile documents to read-only client access.
 *
 * The default invocation is a read-only plan. Pass --apply to replace each
 * profile's document permissions with reads for its owner and organization
 * team. All profile writes then flow through authenticated server APIs.
 * This utility never changes profile data and never deletes documents.
 */

require('dotenv').config({ path: '.env.local' });

const { Client, Databases, Permission, Query, Role } = require('node-appwrite');

const APPLY = process.argv.includes('--apply');
const ENV = process.env;
const ENDPOINT = ENV.APPWRITE_ENDPOINT || ENV.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = ENV.APPWRITE_PROJECT_ID || ENV.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = ENV.APPWRITE_API_KEY;
const DATABASE_ID = ENV.APPWRITE_DATABASE_ID
  || ENV.NEXT_PUBLIC_APPWRITE_DATABASE_ID
  || '68fb5845001d32f31656';
const USERS_ID = ENV.NEXT_PUBLIC_APPWRITE_COL_USERS || 'pms_users';

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error('Missing Appwrite endpoint, project ID, or server API key in .env.local.');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY)
  .addHeader('X-Appwrite-Response-Format', '1.9.0');
const databases = new Databases(client);

function sorted(values) {
  return [...(values || [])].sort();
}

function samePermissions(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function expectedPermissions(profile) {
  if (!profile.accountId || !profile.organizationId) {
    throw new Error(`Profile ${profile.$id} is missing accountId or organizationId; refusing to change it.`);
  }
  return [
    Permission.read(Role.user(profile.accountId)),
    Permission.read(Role.team(profile.organizationId)),
  ];
}

async function listAllProfiles() {
  const profiles = [];
  let offset = 0;
  while (true) {
    const page = await databases.listDocuments(DATABASE_ID, USERS_ID, [
      Query.orderAsc('$id'),
      Query.limit(100),
      Query.offset(offset),
    ]);
    profiles.push(...page.documents);
    offset += page.documents.length;
    if (page.documents.length === 0 || offset >= page.total) break;
  }
  return profiles;
}

async function main() {
  const collection = await databases.getCollection(DATABASE_ID, USERS_ID);
  if (!collection.documentSecurity) {
    throw new Error('User Profiles must have document security enabled before permissions can be hardened.');
  }

  const profiles = await listAllProfiles();
  const changes = profiles
    .map((profile) => ({ profile, permissions: expectedPermissions(profile) }))
    .filter(({ profile, permissions }) => !samePermissions(profile.$permissions, permissions));

  console.log(`User profiles inspected: ${profiles.length}`);
  console.log(`Permission updates planned: ${changes.length}`);
  if (!APPLY) {
    console.log('Read-only plan complete. Re-run with --apply to update only document permissions.');
    return;
  }

  for (const { profile, permissions } of changes) {
    await databases.updateDocument(DATABASE_ID, USERS_ID, profile.$id, {}, permissions);
  }
  console.log(`Permission updates applied: ${changes.length}`);
}

main().catch((error) => {
  console.error(`Profile permission hardening failed: ${error.message}`);
  process.exit(1);
});

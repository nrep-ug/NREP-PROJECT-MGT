/**
 * Finance demo — read-only user resolution
 *
 * Safely resolves the existing user records for the two named demo
 * participants (by username) WITHOUT modifying anything. Run this first so
 * an administrator can confirm identity before any role assignment or demo
 * seeding takes place.
 *
 * Usage:
 *   node scripts/resolve-finance-demo-users.js
 *
 * Requires (from .env.local): APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID,
 * APPWRITE_API_KEY, APPWRITE_DATABASE_ID.
 */

require('dotenv').config({ path: '.env.local' });

const { Client, Databases, Teams, Users, Query } = require('node-appwrite');

const ENDPOINT = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.APPWRITE_DATABASE_ID || '68fb5845001d32f31656';
const COL_USERS = process.env.NEXT_PUBLIC_APPWRITE_COL_USERS || 'pms_users';

const USERNAMES = ['mkizza', 'dnatukwasa'];

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error('Missing required environment variables: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);
const teams = new Teams(client);
const users = new Users(client);

async function resolveUser(username) {
  const docs = await databases.listDocuments(DB_ID, COL_USERS, [
    Query.equal('username', username),
    Query.limit(1),
  ]);
  const profile = docs.documents[0];
  if (!profile) {
    return { username, found: false };
  }

  let authUser = null;
  try {
    authUser = await users.get(profile.accountId);
  } catch (err) {
    return { username, found: true, profile, authError: err.message };
  }

  let organizationRoles = [];
  try {
    const memberships = await teams.listMemberships(profile.organizationId, [
      Query.equal('userId', profile.accountId),
      Query.limit(2),
    ]);
    organizationRoles = memberships.memberships.find((m) => m.userId === profile.accountId)?.roles || [];
  } catch (err) {
    organizationRoles = [`<error: ${err.message}>`];
  }

  return {
    username,
    found: true,
    accountId: profile.accountId,
    profileId: profile.$id,
    email: authUser.email,
    name: authUser.name,
    userType: profile.userType,
    status: profile.status,
    organizationId: profile.organizationId,
    labels: authUser.labels || [],
    organizationRoles,
    existingFinanceRoles: organizationRoles.filter((r) => r.startsWith('finance_')),
  };
}

async function main() {
  console.log('=== Finance demo user resolution (read-only) ===');
  console.log(`Appwrite endpoint: ${ENDPOINT}`);
  console.log('');

  const results = [];
  for (const username of USERNAMES) {
    const result = await resolveUser(username);
    results.push(result);
    if (!result.found) {
      console.log(`❌ ${username}: no matching user profile found in ${COL_USERS}.`);
      continue;
    }
    if (result.authError) {
      console.log(`⚠️  ${username}: profile found (${result.profileId}) but Appwrite auth lookup failed: ${result.authError}`);
      continue;
    }
    console.log(`✅ ${username}`);
    console.log(`   accountId:        ${result.accountId}`);
    console.log(`   name / email:     ${result.name} <${result.email}>`);
    console.log(`   userType/status:  ${result.userType} / ${result.status}`);
    console.log(`   organizationId:   ${result.organizationId}`);
    console.log(`   account labels:   ${result.labels.join(', ') || '(none)'}`);
    console.log(`   org team roles:   ${result.organizationRoles.join(', ') || '(none)'}`);
    console.log(`   existing finance roles: ${result.existingFinanceRoles.join(', ') || '(none)'}`);
    console.log('');
  }

  const missing = results.filter((r) => !r.found);
  const sameOrg = new Set(results.filter((r) => r.found && r.organizationId).map((r) => r.organizationId));
  console.log('=== Summary ===');
  console.log(`Resolved: ${results.length - missing.length}/${results.length}`);
  if (missing.length) {
    console.log(`Missing: ${missing.map((r) => r.username).join(', ')} — cannot proceed with role assignment until these exist.`);
  }
  if (sameOrg.size > 1) {
    console.log('⚠️  These users belong to DIFFERENT organizations — a single demo project cannot include both as Finance participants.');
  } else if (sameOrg.size === 1) {
    console.log(`Both users share organizationId ${[...sameOrg][0]} — safe to proceed with a scoped demo.`);
  }
}

main().catch((err) => {
  console.error('Resolution failed:', err);
  process.exit(1);
});

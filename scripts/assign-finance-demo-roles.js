/**
 * Finance demo — org-scoped Finance role assignment (DEMO/TEST ONLY)
 *
 * Grants the same organization-scoped Finance roles the production admin UI
 * grants (via Appwrite Teams membership roles on the org team — see
 * PATCH /api/admin/users/[userId] and lib/serverAuth.js::deriveOrganizationFinanceAccess).
 * This script does NOT introduce any new authorization mechanism and does NOT
 * hard-code these usernames into any production authorization path — it is a
 * one-off, deliberately-run administrative utility for standing up the Finance
 * acceptance-test participants.
 *
 * It is strictly additive to each user's existing org team roles: any
 * non-Finance roles they already hold (admin, manager, supervisor, ...) are
 * left untouched, and any Finance roles are updated only for the two demo
 * accounts.
 *
 * Usage:
 *   node scripts/assign-finance-demo-roles.js            # dry run (default)
 *   node scripts/assign-finance-demo-roles.js --apply    # actually writes
 *   node scripts/assign-finance-demo-roles.js --revert   # remove the finance_* roles this script granted
 */

require('dotenv').config({ path: '.env.local' });

const { Client, Databases, Teams, Query } = require('node-appwrite');

const ENDPOINT = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.APPWRITE_DATABASE_ID || '68fb5845001d32f31656';
const COL_USERS = process.env.NEXT_PUBLIC_APPWRITE_COL_USERS || 'pms_users';

const FINANCE_MEMBERSHIP_ROLES = ['finance_officer', 'finance_reviewer', 'finance_budget_approver', 'finance_admin'];

// DEMO/TEST ONLY — the two named acceptance-test participants from the
// Finance requirements doc. Not referenced anywhere in production code.
const DEMO_ASSIGNMENTS = [
  { username: 'mkizza', financeRole: 'finance_officer', label: 'Finance Officer / Editor (DEMO)' },
  { username: 'dnatukwasa', financeRole: 'finance_reviewer', label: 'Finance Reviewer (DEMO)' },
];

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const REVERT = args.has('--revert');

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error('Missing required environment variables: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);
const teams = new Teams(client);

async function loadProfile(username) {
  const docs = await databases.listDocuments(DB_ID, COL_USERS, [
    Query.equal('username', username),
    Query.limit(1),
  ]);
  const profile = docs.documents[0];
  if (!profile) throw new Error(`No user profile found for username "${username}".`);
  if (profile.status !== 'active') throw new Error(`User "${username}" is not active (status=${profile.status}); refusing to grant Finance access.`);
  return profile;
}

async function main() {
  console.log(`=== Finance demo role assignment (${REVERT ? 'REVERT' : APPLY ? 'APPLY' : 'DRY RUN'}) ===`);
  console.log('');

  for (const assignment of DEMO_ASSIGNMENTS) {
    const profile = await loadProfile(assignment.username);
    const memberships = await teams.listMemberships(profile.organizationId, [
      Query.equal('userId', profile.accountId),
      Query.limit(2),
    ]);
    const membership = memberships.memberships.find((m) => m.userId === profile.accountId);
    if (!membership) {
      console.log(`⚠️  ${assignment.username}: no active membership in org team ${profile.organizationId}; skipping.`);
      continue;
    }
    const currentRoles = membership.roles || [];
    const nonFinanceRoles = currentRoles.filter((role) => !FINANCE_MEMBERSHIP_ROLES.includes(role));
    const nextRoles = REVERT
      ? nonFinanceRoles
      : [...new Set([...nonFinanceRoles, assignment.financeRole])];

    console.log(`${assignment.username} (${assignment.label})`);
    console.log(`  current org roles: ${currentRoles.join(', ') || '(none)'}`);
    console.log(`  next org roles:    ${nextRoles.join(', ') || '(none)'}`);

    if (APPLY || REVERT) {
      await teams.updateMembership(profile.organizationId, membership.$id, nextRoles);
      console.log('  ✅ applied');
    } else {
      console.log('  (dry run — no changes written; re-run with --apply to commit)');
    }
    console.log('');
  }

  if (!APPLY && !REVERT) {
    console.log('Dry run complete. No changes were made. Re-run with --apply to grant the demo Finance roles,');
    console.log('or --revert to remove only the finance_* roles this script would have granted.');
  }
}

main().catch((err) => {
  console.error('Role assignment failed:', err);
  process.exit(1);
});

import { randomInt } from 'crypto';
import { Account, Client } from 'node-appwrite';
import { adminDatabases, adminStorage, DB_ID, Query } from '@/lib/appwriteAdmin';
import { HttpError } from '@/lib/serverAuth';
import { CC } from './service';

/**
 * Champion logins.
 *
 * A champion signs in with their phone number. Appwrite's password login needs
 * an email, so each champion account gets a non-deliverable login address
 * derived from the phone: +256700123456 -> 256700123456@champions.nrep.ug.
 * The account carries ONLY the "field" label: no staff label, no user
 * profile and no organization-team membership, so it can never load the staff
 * workspace or read organization records.
 */
export const CHAMPION_LOGIN_DOMAIN = 'champions.nrep.ug';
export const FIELD_LABEL = 'field';

export function championLoginEmail(phoneE164) {
  return `${String(phoneE164).replace(/\D/g, '')}@${CHAMPION_LOGIN_DOMAIN}`;
}

/** 8-digit starting password (Appwrite minimum length is 8). Shown to staff once. */
export function generateStartingPassword() {
  return String(randomInt(10_000_000, 100_000_000));
}

const BROAD = /^(create|read|update|delete|write)\("(any|users|guests)"\)$/;
let hardenedConfirmedAt = 0;

/**
 * Safety interlock: a champion is a logged-in Appwrite user, so while any
 * collection or bucket still grants "any"/"users" access, creating champion
 * logins would expose organization data. Refuse until
 * scripts/harden-collection-permissions.js --apply has been run.
 */
export async function assertPermissionsHardened() {
  if (Date.now() - hardenedConfirmedAt < 5 * 60_000) return;
  const [collections, buckets] = await Promise.all([
    adminDatabases.listCollections(DB_ID, [Query.limit(100)]),
    adminStorage.listBuckets([Query.limit(100)]),
  ]);
  const open = [
    ...collections.collections.filter((c) => (c.$permissions || []).some((p) => BROAD.test(p))).map((c) => c.$id),
    ...buckets.buckets.filter((b) => (b.$permissions || []).some((p) => BROAD.test(p))).map((b) => b.$id),
  ];
  if (open.length) {
    throw new HttpError(
      409,
      `Champion logins are locked until the database permission fix is applied (still open: ${open.join(', ')}). `
        + 'An administrator must run: node scripts/harden-collection-permissions.js --apply',
      'SECURITY_PREREQUISITE'
    );
  }
  hardenedConfirmedAt = Date.now();
}

/**
 * Verify a champion's Appwrite JWT and load their champion record.
 * Used by /api/field/* routes. Never trusts identity from the request body.
 */
export async function requireChampionContext(request) {
  const header = request.headers.get('authorization') || '';
  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== 'bearer' || !token || token.length > 4096) {
    throw new HttpError(401, 'Please log in again.', 'AUTH_REQUIRED');
  }
  let account;
  try {
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setJWT(token);
    account = await new Account(client).get();
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.', 'AUTH_INVALID');
  }
  if (!(account.labels || []).includes(FIELD_LABEL)) {
    throw new HttpError(403, 'This page is for Clean Cooking champions.', 'NOT_A_CHAMPION');
  }
  const result = await adminDatabases.listDocuments(DB_ID, CC.CHAMPIONS, [
    Query.equal('accountId', account.$id),
    Query.limit(1),
  ]);
  const champion = result.documents[0];
  if (!champion || champion.status === 'inactive') {
    throw new HttpError(403, 'Your champion account is not active. Please contact NREP.', 'CHAMPION_INACTIVE');
  }
  const project = await adminDatabases.getDocument(DB_ID, 'pms_projects', champion.projectId);
  return { account, champion, project };
}

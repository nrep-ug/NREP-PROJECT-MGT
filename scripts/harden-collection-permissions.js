#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Remove public ("any") and all-logged-in-users ("users") permissions that
 * were set by hand on collections and storage buckets.
 *
 *   node scripts/harden-collection-permissions.js              read-only plan
 *   node scripts/harden-collection-permissions.js --apply      apply (writes a backup first)
 *   node scripts/harden-collection-permissions.js --restore=<backup.json>   undo
 *
 * Collections: collection-level permissions are cleared and document security
 * is switched on, so every record is governed by its own permissions (which
 * all records already carry — the app writes them on create).
 *
 * Buckets: "users" is replaced by the staff/admin/manager/client labels. This
 * keeps today's behaviour for every existing person (uploaded files are only
 * readable by their uploader, so colleagues still need bucket-level read) while
 * excluding any other account type, e.g. Clean Cooking field champions.
 * A later change should serve documents through the server instead.
 *
 * Never changes or deletes documents or files.
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Client, Databases, Storage, Permission, Query, Role } = require('node-appwrite');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const RESTORE = (args.find((a) => a.startsWith('--restore=')) || '').split('=').slice(1).join('=');
const ENV = process.env;
const DB = ENV.APPWRITE_DATABASE_ID || ENV.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68fb5845001d32f31656';

const client = new Client()
  .setEndpoint(ENV.APPWRITE_ENDPOINT || ENV.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(ENV.APPWRITE_PROJECT_ID || ENV.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(ENV.APPWRITE_API_KEY)
  .addHeader('X-Appwrite-Response-Format', '1.9.0');
const databases = new Databases(client);
const storage = new Storage(client);

const BROAD = /^(create|read|update|delete|write)\("(any|users|guests)"\)$/;

const BUCKET_LABELS_READ = ['staff', 'admin', 'manager', 'client'];
const BUCKET_LABELS_WRITE = ['staff', 'admin', 'manager'];
function bucketPermissions() {
  return [
    ...BUCKET_LABELS_READ.map((l) => Permission.read(Role.label(l))),
    ...BUCKET_LABELS_READ.map((l) => Permission.create(Role.label(l))),
    ...BUCKET_LABELS_WRITE.map((l) => Permission.update(Role.label(l))),
    ...BUCKET_LABELS_WRITE.map((l) => Permission.delete(Role.label(l))),
  ];
}

async function updateCollection(col, permissions, documentSecurity) {
  await databases.updateCollection(DB, col.$id, col.name, permissions, documentSecurity, col.enabled);
}

async function updateBucket(bucket, permissions) {
  await storage.updateBucket(
    bucket.$id, bucket.name, permissions, bucket.fileSecurity, bucket.enabled,
    bucket.maximumFileSize, bucket.allowedFileExtensions, bucket.compression,
    bucket.encryption, bucket.antivirus
  );
}

async function plan() {
  const collections = (await databases.listCollections(DB, [Query.limit(100)])).collections;
  const buckets = (await storage.listBuckets([Query.limit(100)])).buckets;
  const colChanges = collections
    .filter((c) => (c.$permissions || []).some((p) => BROAD.test(p)) || false)
    .map((c) => ({ kind: 'collection', item: c, before: { permissions: c.$permissions, documentSecurity: c.documentSecurity },
      after: { permissions: (c.$permissions || []).filter((p) => !BROAD.test(p)), documentSecurity: true } }));
  const bucketChanges = buckets
    .filter((b) => (b.$permissions || []).some((p) => BROAD.test(p)))
    .map((b) => ({ kind: 'bucket', item: b, before: { permissions: b.$permissions },
      after: { permissions: [...new Set([...(b.$permissions || []).filter((p) => !BROAD.test(p)), ...bucketPermissions()])] } }));
  return [...colChanges, ...bucketChanges];
}

async function run() {
  if (RESTORE) {
    const backup = JSON.parse(fs.readFileSync(RESTORE, 'utf8'));
    for (const entry of backup) {
      if (entry.kind === 'collection') {
        const col = await databases.getCollection(DB, entry.id);
        await updateCollection(col, entry.before.permissions, entry.before.documentSecurity);
      } else {
        const bucket = await storage.getBucket(entry.id);
        await updateBucket(bucket, entry.before.permissions);
      }
      console.log(`restored ${entry.kind} ${entry.id}`);
    }
    return;
  }

  const changes = await plan();
  console.log(`Permission hardening — ${APPLY ? 'APPLY' : 'read-only plan'}`);
  if (!changes.length) { console.log('Nothing to change: no public or all-users permissions found.'); return; }
  for (const c of changes) {
    const removed = c.before.permissions.filter((p) => !c.after.permissions.includes(p));
    const added = c.after.permissions.filter((p) => !c.before.permissions.includes(p));
    const docSec = c.kind === 'collection' && !c.before.documentSecurity ? ' + turn ON document security' : '';
    console.log(`- ${c.kind} ${c.item.$id}: remove ${removed.length}${added.length ? `, add ${added.length} label rules` : ''}${docSec}`);
  }
  if (!APPLY) { console.log('No changes made. Re-run with --apply.'); return; }

  const backupFile = path.join(os.tmpdir(), `nrep-permissions-backup-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(changes.map((c) => ({ kind: c.kind, id: c.item.$id, before: c.before })), null, 2));
  console.log(`Backup written: ${backupFile}`);
  for (const c of changes) {
    if (c.kind === 'collection') await updateCollection(c.item, c.after.permissions, true);
    else await updateBucket(c.item, c.after.permissions);
    console.log(`  updated ${c.kind} ${c.item.$id}`);
  }
  const remaining = await plan();
  console.log(remaining.length ? `WARNING: ${remaining.length} items still broad.` : 'Verified: no public or all-users permissions remain.');
  console.log(`To undo: node scripts/harden-collection-permissions.js --restore="${backupFile}"`);
}

run().catch((error) => { console.error(`Stopped: ${error.message}`); process.exit(1); });

#!/usr/bin/env node
/* eslint-disable no-console */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const {
  Client,
  Databases,
  Storage,
  ID
} = require('node-appwrite');

// Import shared collections definition
const { collectionsDefinition } = require('../lib/collectionsDefinition.js');

const ENV = require('node:process').env;

const APPWRITE_ENDPOINT = ENV.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = ENV.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = ENV.APPWRITE_API_KEY;

const DB_ID = ENV.APPWRITE_DATABASE_ID || 'pms_db';

const BUCKET_DOCS = ENV.APPWRITE_BUCKET_DOCS || 'pms-project-docs';
const BUCKET_VERSIONS = ENV.APPWRITE_BUCKET_VERSIONS || 'pms-doc-versions';

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error('Missing required envs: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

/** Helpers */
async function ensureDatabase(databaseId, name) {
  try {
    await databases.get(databaseId);
    console.log(`✓ Database exists: ${databaseId}`);
  } catch (err) {
    if (err && err.code === 404) {
      await databases.create(databaseId, name);
      console.log(`+ Created database: ${databaseId}`);
    } else {
      throw err;
    }
  }
}

async function ensureCollection(db, collectionId, name) {
  try {
    await databases.getCollection(db, collectionId);
    console.log(`  ✓ Collection exists: ${collectionId}`);
  } catch (err) {
    if (err && err.code === 404) {
      // Document security ON to use per-document permissions later
      await databases.createCollection(db, collectionId, name, [], true);
      console.log(`  + Created collection: ${collectionId}`);
    } else {
      throw err;
    }
  }
}

async function listAttributesSafe(db, col) {
  try {
    return await databases.listAttributes(db, col);
  } catch (e) {
    if (e && e.code === 404) return { attributes: [] };
    throw e;
  }
}
async function hasAttr(existing, key) {
  return existing.attributes.some((a) => a.key === key);
}

async function ensureAttr(db, col, spec) {
  const current = await listAttributesSafe(db, col);
  if (await hasAttr(current, spec.key)) {
    // console.log(`    · attribute exists: ${col}.${spec.key}`);
    return;
  }
  const req = spec.required === true;
  const arr = spec.array === true;
  const def = spec.default;

  switch (spec.type) {
    case 'string':
      await databases.createStringAttribute(
        db, col, spec.key,
        spec.size || 190,
        req,
        def,
        arr
      );
      break;
    case 'email':
      await databases.createEmailAttribute(db, col, spec.key, req, def, arr);
      break;
    case 'url':
      await databases.createUrlAttribute(db, col, spec.key, req, def, arr);
      break;
    case 'ip':
      await databases.createIpAttribute(db, col, spec.key, req, def, arr);
      break;
    case 'integer':
      await databases.createIntegerAttribute(
        db, col, spec.key, req,
        spec.min || null,
        spec.max || null,
        def,
        arr
      );
      break;
    case 'float':
      await databases.createFloatAttribute(
        db, col, spec.key, req,
        spec.min || null,
        spec.max || null,
        def,
        arr
      );
      break;
    case 'boolean':
      await databases.createBooleanAttribute(db, col, spec.key, req, def, arr);
      break;
    case 'datetime':
      await databases.createDatetimeAttribute(db, col, spec.key, req, def, arr);
      break;
    case 'enum':
      if (!spec.elements || !Array.isArray(spec.elements)) {
        throw new Error(`Enum attribute ${col}.${spec.key} requires 'elements' array`);
      }
      await databases.createEnumAttribute(
        db, col, spec.key,
        spec.elements,
        req,
        def,
        arr
      );
      break;
    case 'json':
      // Appwrite 1.7.4 does not have native JSON type
      // Store as string - application handles JSON.stringify/JSON.parse
      await databases.createStringAttribute(
        db, col, spec.key,
        spec.size || 10000,  // Larger default for JSON content
        req,
        def,
        arr
      );
      console.log(`    + attribute: ${col}.${spec.key} (json -> string)`);
      return; // Return early to avoid duplicate log
    default:
      throw new Error(`Unknown attribute type for ${col}.${spec.key}: ${spec.type}`);
  }
  console.log(`    + attribute: ${col}.${spec.key} (${spec.type})`);
}

async function listIndexesSafe(db, col) {
  try {
    return await databases.listIndexes(db, col);
  } catch (e) {
    if (e && e.code === 404) return { indexes: [] };
    throw e;
  }
}
function hasIndex(existing, key) {
  return existing.indexes.some((i) => i.key === key);
}
async function ensureIndex(db, col, key, type, attributes, orders) {
  const existing = await listIndexesSafe(db, col);
  if (hasIndex(existing, key)) return;
  await databases.createIndex(db, col, key, type, attributes, orders || attributes.map(() => 'ASC'));
  console.log(`    + index: ${col}.${key} [${type}] (${attributes.join(', ')})`);
}

async function ensureBucket(bucketId, name) {
  try {
    await storage.getBucket(bucketId);
    console.log(`✓ Bucket exists: ${bucketId}`);
  } catch (err) {
    if (err && err.code === 404) {
      // Private bucket (fileSecurity=true)
      // In Appwrite 1.7.4: createBucket(bucketId, name, [permissions], fileSecurity, enabled, maxSize, allowedExtensions, compression, encryption, antivirus)
      await storage.createBucket(
        bucketId,
        name,
        [],              // permissions - empty array for no bucket-level permissions (use file-level)
        true,            // fileSecurity - enable file-level permissions
        true,            // enabled
        30000000,        // maxSize - 30MB
        [],              // allowedExtensions - empty means all allowed
        'gzip',          // compression
        false,           // encryption
        false            // antivirus
      );
      console.log(`+ Created bucket: ${bucketId}`);
    } else {
      throw err;
    }
  }
}

// Use shared collections definition
const COLS = collectionsDefinition;

async function run() {
  console.log('== PMS Collections Setup ==');
  await ensureDatabase(DB_ID, 'PMS Database');

  for (const c of COLS) {
    await ensureCollection(DB_ID, c.id, c.name);
    for (const a of c.attrs) {
      await ensureAttr(DB_ID, c.id, a);
    }
    for (const idx of c.indexes || []) {
      await ensureIndex(DB_ID, c.id, idx.key, idx.type, idx.attrs, idx.orders);
    }
  }

  // Optional buckets
  if (BUCKET_DOCS) await ensureBucket(BUCKET_DOCS, 'PMS Project Docs');
  if (BUCKET_VERSIONS) await ensureBucket(BUCKET_VERSIONS, 'PMS Doc Versions');

  console.log('✓ Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

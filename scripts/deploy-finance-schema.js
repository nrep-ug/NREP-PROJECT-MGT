#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Additive-only Finance schema deployment.
 *
 * The default invocation is a read-only plan. Pass --apply to create only
 * missing Finance collections, attributes, and indexes. This utility contains
 * no update or delete calls and refuses incompatible existing definitions.
 */

require('dotenv').config({ path: '.env.local' });

const { Client, Databases, Query } = require('node-appwrite');
const {
  CORE_FINANCE_ATTRIBUTE_TARGETS,
  FINANCE_COLLECTION_DEFINITIONS,
} = require('../lib/financeSchema.cjs');

const APPLY = process.argv.includes('--apply');
const ENV = process.env;
const ENDPOINT = ENV.APPWRITE_ENDPOINT || ENV.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = ENV.APPWRITE_PROJECT_ID || ENV.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = ENV.APPWRITE_API_KEY;
const DATABASE_ID = ENV.APPWRITE_DATABASE_ID
  || ENV.NEXT_PUBLIC_APPWRITE_DATABASE_ID
  || '68fb5845001d32f31656';
const POLL_INTERVAL_MS = 750;
const POLL_TIMEOUT_MS = 45_000;

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

const targets = [
  ...CORE_FINANCE_ATTRIBUTE_TARGETS,
  ...FINANCE_COLLECTION_DEFINITIONS,
];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function getCollectionOrNull(collectionId) {
  try {
    return await databases.getCollection(DATABASE_ID, collectionId);
  } catch (error) {
    if (error?.code === 404) return null;
    throw error;
  }
}

async function listAttributes(collectionId) {
  const result = await databases.listAttributes(DATABASE_ID, collectionId, [Query.limit(100)]);
  return result.attributes || [];
}

async function listIndexes(collectionId) {
  const result = await databases.listIndexes(DATABASE_ID, collectionId, [Query.limit(100)]);
  return result.indexes || [];
}

function expectedRemoteType(spec) {
  if (spec.type === 'json') return 'string';
  if (spec.type === 'enum') return 'string';
  if (spec.type === 'float') return 'double';
  return spec.type;
}

function sorted(values) {
  return [...(values || [])].sort();
}

function sameValues(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function assertCompatibleAttribute(collectionId, existing, spec) {
  const issues = [];
  const remoteType = existing.type || existing.format;
  const expectedType = expectedRemoteType(spec);
  if (remoteType && remoteType !== expectedType) {
    issues.push(`type is ${remoteType}, expected ${expectedType}`);
  }
  if (Boolean(existing.required) !== Boolean(spec.required)) {
    issues.push(`required is ${Boolean(existing.required)}, expected ${Boolean(spec.required)}`);
  }
  if (Boolean(existing.array) !== Boolean(spec.array)) {
    issues.push(`array is ${Boolean(existing.array)}, expected ${Boolean(spec.array)}`);
  }
  if (spec.size && existing.size && Number(existing.size) !== Number(spec.size)) {
    issues.push(`size is ${existing.size}, expected ${spec.size}`);
  }
  if (spec.type === 'enum' && existing.elements && !sameValues(existing.elements, spec.elements)) {
    issues.push('enum values differ');
  }
  if (spec.type === 'enum' && existing.format !== 'enum') {
    issues.push(`format is ${existing.format || 'unset'}, expected enum`);
  }
  if (issues.length) {
    throw new Error(
      `Refusing incompatible attribute ${collectionId}.${spec.key}: ${issues.join('; ')}`
    );
  }
  if (existing.status === 'failed' || existing.status === 'stuck') {
    throw new Error(`Attribute ${collectionId}.${spec.key} is ${existing.status}.`);
  }
}

function assertCompatibleIndex(collectionId, existing, spec) {
  const attributes = existing.attributes || existing.attrs || [];
  if (existing.type !== spec.type || !sameValues(attributes, spec.attrs)) {
    throw new Error(`Refusing incompatible index ${collectionId}.${spec.key}.`);
  }
  if (existing.status === 'failed' || existing.status === 'stuck') {
    throw new Error(`Index ${collectionId}.${spec.key} is ${existing.status}.`);
  }
}

async function inspectTarget(target) {
  const collection = await getCollectionOrNull(target.id);
  if (!collection) {
    if (target.mustAlreadyExist) {
      throw new Error(`Required core collection is missing: ${target.id}`);
    }
    return {
      target,
      collection: null,
      missingAttributes: [...target.attrs],
      missingIndexes: [...(target.indexes || [])],
    };
  }

  if (!target.mustAlreadyExist) {
    if (!collection.documentSecurity) {
      throw new Error(`Finance collection ${target.id} must have document security enabled.`);
    }
    if ((collection.$permissions || []).length > 0) {
      throw new Error(`Finance collection ${target.id} has unexpected collection-level permissions.`);
    }
  }

  const [attributes, indexes] = await Promise.all([
    listAttributes(target.id),
    listIndexes(target.id),
  ]);
  const attributesByKey = new Map(attributes.map((attribute) => [attribute.key, attribute]));
  const indexesByKey = new Map(indexes.map((index) => [index.key, index]));
  const missingAttributes = [];
  const missingIndexes = [];

  for (const spec of target.attrs) {
    const existing = attributesByKey.get(spec.key);
    if (!existing) missingAttributes.push(spec);
    else assertCompatibleAttribute(target.id, existing, spec);
  }
  for (const spec of target.indexes || []) {
    const existing = indexesByKey.get(spec.key);
    if (!existing) missingIndexes.push(spec);
    else assertCompatibleIndex(target.id, existing, spec);
  }

  return { target, collection, missingAttributes, missingIndexes };
}

async function inspectAll() {
  const inspected = [];
  for (const target of targets) inspected.push(await inspectTarget(target));
  return inspected;
}

function printPlan(inspected) {
  let actionCount = 0;
  console.log(`Finance schema ${APPLY ? 'apply' : 'read-only plan'} for database ${DATABASE_ID}`);
  for (const item of inspected) {
    const createCollection = !item.collection;
    const actions = [];
    if (createCollection) actions.push('create collection (private, document security enabled)');
    if (item.missingAttributes.length) actions.push(`add ${item.missingAttributes.length} attributes`);
    if (item.missingIndexes.length) actions.push(`add ${item.missingIndexes.length} indexes`);
    actionCount += Number(createCollection) + item.missingAttributes.length + item.missingIndexes.length;
    console.log(`- ${item.target.id}: ${actions.length ? actions.join(', ') : 'already compatible'}`);
    for (const spec of item.missingAttributes) console.log(`    attribute + ${spec.key}`);
    for (const spec of item.missingIndexes) console.log(`    index     + ${spec.key}`);
  }
  console.log(`Planned additive actions: ${actionCount}`);
  if (!APPLY && actionCount) console.log('No changes applied. Re-run with --apply after reviewing this plan.');
  return actionCount;
}

async function waitForAttribute(collectionId, key) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const attribute = await databases.getAttribute(DATABASE_ID, collectionId, key);
    if (attribute.status === 'available') return;
    if (attribute.status === 'failed' || attribute.status === 'stuck') {
      throw new Error(`Attribute ${collectionId}.${key} became ${attribute.status}.`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for attribute ${collectionId}.${key}.`);
}

async function waitForIndex(collectionId, key) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const index = await databases.getIndex(DATABASE_ID, collectionId, key);
    if (index.status === 'available') return;
    if (index.status === 'failed' || index.status === 'stuck') {
      throw new Error(`Index ${collectionId}.${key} became ${index.status}.`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for index ${collectionId}.${key}.`);
}

async function createAttribute(collectionId, spec) {
  const required = spec.required === true;
  const array = spec.array === true;
  const fallback = spec.default;
  switch (spec.type) {
    case 'string':
    case 'json':
      await databases.createStringAttribute(
        DATABASE_ID,
        collectionId,
        spec.key,
        spec.size || (spec.type === 'json' ? 10000 : 190),
        required,
        fallback,
        array
      );
      break;
    case 'integer':
      await databases.createIntegerAttribute(
        DATABASE_ID,
        collectionId,
        spec.key,
        required,
        spec.min,
        spec.max,
        fallback,
        array
      );
      break;
    case 'float':
      await databases.createFloatAttribute(
        DATABASE_ID,
        collectionId,
        spec.key,
        required,
        spec.min,
        spec.max,
        fallback,
        array
      );
      break;
    case 'boolean':
      await databases.createBooleanAttribute(
        DATABASE_ID,
        collectionId,
        spec.key,
        required,
        fallback,
        array
      );
      break;
    case 'datetime':
      await databases.createDatetimeAttribute(
        DATABASE_ID,
        collectionId,
        spec.key,
        required,
        fallback,
        array
      );
      break;
    case 'enum':
      await databases.createEnumAttribute(
        DATABASE_ID,
        collectionId,
        spec.key,
        spec.elements,
        required,
        fallback,
        array
      );
      break;
    default:
      throw new Error(`Unsupported Finance attribute type: ${spec.type}`);
  }
  await waitForAttribute(collectionId, spec.key);
  console.log(`  + attribute ${collectionId}.${spec.key}`);
}

async function applyTarget(item) {
  if (!item.collection) {
    await databases.createCollection(
      DATABASE_ID,
      item.target.id,
      item.target.name,
      [],
      true,
      true
    );
    console.log(`+ collection ${item.target.id}`);
  }
  for (const spec of item.missingAttributes) await createAttribute(item.target.id, spec);
  for (const spec of item.missingIndexes) {
    await databases.createIndex(
      DATABASE_ID,
      item.target.id,
      spec.key,
      spec.type,
      spec.attrs,
      spec.orders || spec.attrs.map(() => 'ASC')
    );
    await waitForIndex(item.target.id, spec.key);
    console.log(`  + index ${item.target.id}.${spec.key}`);
  }
}

async function run() {
  await databases.get(DATABASE_ID);
  const inspected = await inspectAll();
  const actionCount = printPlan(inspected);
  if (!APPLY || actionCount === 0) return;

  console.log('Applying additive Finance schema actions...');
  for (const item of inspected) await applyTarget(item);

  const verification = await inspectAll();
  const remaining = verification.reduce(
    (total, item) => total
      + Number(!item.collection)
      + item.missingAttributes.length
      + item.missingIndexes.length,
    0
  );
  if (remaining !== 0) throw new Error(`Post-deployment verification found ${remaining} missing items.`);
  console.log('Finance schema deployment verified: all targets are compatible and available.');
}

run().catch((error) => {
  console.error(`Finance schema deployment stopped: ${error.message}`);
  process.exit(1);
});

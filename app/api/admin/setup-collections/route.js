/**
 * Setup Collections API - Check and create database collections
 * POST: Check existing collections and create missing ones
 * GET: Check status of all collections without creating
 */

import { NextResponse } from 'next/server';
import { adminDatabases, ID } from '@/lib/appwriteAdmin';
import { collectionsDefinition } from '@/lib/collectionsDefinition';
import { ensureAttribute, ensureIndex } from '@/lib/collectionHelpers';

const DB_ID = process.env.APPWRITE_DATABASE_ID || 'pms_db';

/**
 * Check if a collection exists
 */
async function checkCollection(collectionId) {
  try {
    await adminDatabases.getCollection(DB_ID, collectionId);
    return { exists: true, error: null };
  } catch (err) {
    if (err && err.code === 404) {
      return { exists: false, error: null };
    }
    return { exists: false, error: err.message };
  }
}

/**
 * Create a collection if it doesn't exist
 */
async function ensureCollection(collectionId, name) {
  try {
    await adminDatabases.getCollection(DB_ID, collectionId);
    return { status: 'exists', message: `Collection already exists: ${collectionId}` };
  } catch (err) {
    if (err && err.code === 404) {
      try {
        // Document security ON to use per-document permissions later
        await adminDatabases.createCollection(DB_ID, collectionId, name, [], true);
        return { status: 'created', message: `Created collection: ${collectionId}` };
      } catch (createErr) {
        return { status: 'error', message: `Failed to create collection: ${createErr.message}` };
      }
    } else {
      return { status: 'error', message: `Error checking collection: ${err.message}` };
    }
  }
}

/**
 * GET /api/admin/setup-collections
 * Check status of all collections
 */
export async function GET(request) {
  try {
    const collections = collectionsDefinition;
    const results = [];

    for (const col of collections) {
      const check = await checkCollection(col.id);
      results.push({
        id: col.id,
        name: col.name,
        exists: check.exists,
        error: check.error,
      });
    }

    const allExist = results.every(r => r.exists);
    const someExist = results.some(r => r.exists);

    return NextResponse.json({
      success: true,
      allConfigured: allExist,
      someConfigured: someExist,
      total: results.length,
      existing: results.filter(r => r.exists).length,
      missing: results.filter(r => !r.exists).length,
      collections: results,
    });
  } catch (error) {
    console.error('[API /admin/setup-collections GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check collections' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/setup-collections
 * Create missing collections
 */
export async function POST(request) {
  try {
    console.log('[API /admin/setup-collections] Starting collections setup...');

    // First, ensure database exists
    try {
      await adminDatabases.get(DB_ID);
      console.log(`[API] Database exists: ${DB_ID}`);
    } catch (err) {
      if (err && err.code === 404) {
        await adminDatabases.create(DB_ID, 'PMS Database');
        console.log(`[API] Created database: ${DB_ID}`);
      } else {
        throw err;
      }
    }

    const collections = collectionsDefinition;
    const results = [];

    for (const col of collections) {
      console.log(`[API] Processing collection: ${col.id}`);
      const collectionResult = await ensureCollection(col.id, col.name);

      const collectionData = {
        id: col.id,
        name: col.name,
        ...collectionResult,
        attributes: [],
        indexes: [],
      };

      // If collection exists or was created, setup attributes and indexes
      if (collectionResult.status === 'exists' || collectionResult.status === 'created') {
        // Create attributes
        if (col.attrs && col.attrs.length > 0) {
          console.log(`[API] Setting up ${col.attrs.length} attributes for ${col.id}`);
          for (const attr of col.attrs) {
            const attrResult = await ensureAttribute(adminDatabases, DB_ID, col.id, attr);
            collectionData.attributes.push({
              key: attr.key,
              type: attr.type,
              ...attrResult,
            });
            console.log(`[API]   ${attrResult.status}: ${attr.key}`);
          }
        }

        // Create indexes
        if (col.indexes && col.indexes.length > 0) {
          console.log(`[API] Setting up ${col.indexes.length} indexes for ${col.id}`);
          for (const idx of col.indexes) {
            const indexResult = await ensureIndex(
              adminDatabases,
              DB_ID,
              col.id,
              idx.key,
              idx.type,
              idx.attrs,
              idx.orders
            );
            collectionData.indexes.push({
              key: idx.key,
              type: idx.type,
              ...indexResult,
            });
            console.log(`[API]   ${indexResult.status}: ${idx.key}`);
          }
        }
      }

      results.push(collectionData);
    }

    const created = results.filter(r => r.status === 'created').length;
    const existing = results.filter(r => r.status === 'exists').length;
    const errors = results.filter(r => r.status === 'error').length;

    const totalAttributes = results.reduce((sum, r) => sum + r.attributes.length, 0);
    const createdAttributes = results.reduce(
      (sum, r) => sum + r.attributes.filter(a => a.status === 'created').length,
      0
    );
    const totalIndexes = results.reduce((sum, r) => sum + r.indexes.length, 0);
    const createdIndexes = results.reduce(
      (sum, r) => sum + r.indexes.filter(i => i.status === 'created').length,
      0
    );

    return NextResponse.json({
      success: errors === 0,
      message: `Collections setup completed. Created: ${created} collections, ${createdAttributes} attributes, ${createdIndexes} indexes`,
      summary: {
        total: results.length,
        created,
        existing,
        errors,
        totalAttributes,
        createdAttributes,
        totalIndexes,
        createdIndexes,
      },
      collections: results,
    });
  } catch (error) {
    console.error('[API /admin/setup-collections POST] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to setup collections',
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

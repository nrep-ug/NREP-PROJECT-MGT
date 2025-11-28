/**
 * Server-side Appwrite client with API key for privileged operations
 * Use ONLY in API routes, never expose on client
 */

const { Client, Databases, Storage, Teams, Users, ID, Query, Permission, Role } = require('node-appwrite');

const ENDPOINT = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.APPWRITE_DATABASE_ID || '68fb5845001d32f31656';

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error('[appwriteAdmin] Missing required environment variables');
}

const adminClient = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const adminDatabases = new Databases(adminClient);
const adminStorage = new Storage(adminClient);
const adminTeams = new Teams(adminClient);
const adminUsers = new Users(adminClient);

module.exports = {
  adminClient,
  adminDatabases,
  adminStorage,
  adminTeams,
  adminUsers,
  ID,
  Query,
  Permission,
  Role,
  DB_ID,
  BUCKET_DOCS: process.env.APPWRITE_BUCKET_DOCS || 'pms-project-docs',
  BUCKET_VERSIONS: process.env.APPWRITE_BUCKET_VERSIONS || 'pms-doc-versions',
};

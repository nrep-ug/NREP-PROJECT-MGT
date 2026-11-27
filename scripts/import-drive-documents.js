#!/usr/bin/env node
/**
 * Copy files from a Google Drive folder inventory into a project's Documents
 * tab, mirroring the Drive folder structure.
 *
 *   node scripts/import-drive-documents.js \
 *     --inventory=<inventory.json> --files=<dir> --uploader=<accountId> \
 *     [--project=BCCeC] [--root="Google Drive – BCCeC"] [--apply]
 *
 * --inventory  JSON list of { id, name, mime, path, size, modified } (one per
 *              Drive file or folder), as produced by the read-only inventory.
 * --files      Directory holding the downloaded files, named <driveId>.<ext>.
 *              Files missing there are downloaded from the (shared) Drive link.
 * --uploader   Appwrite account ID recorded as uploader / folder creator.
 *
 * Does what the Documents tab's Upload button does: stores the file in the
 * documents bucket, then creates the document header + version 1 with the
 * project's document permissions (org + project team read; admins and
 * project owners/managers manage). Re-running skips files whose title already
 * exists in the target folder. Dry run by default.
 *
 * Source files may contain personal data (contacts, attendance lists): they
 * go only into the access-controlled project storage, never into the repo.
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client, Databases, Storage, ID, Query, Permission, Role } = require('node-appwrite');
const { InputFile } = require('node-appwrite/file');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));
const APPLY = args.apply === true;
if (!args.inventory || !args.files || !args.uploader) {
  console.error('Usage: node scripts/import-drive-documents.js --inventory=<file.json> --files=<dir> --uploader=<accountId> [--project=BCCeC] [--root="..."] [--apply]');
  process.exit(1);
}
const projectCode = args.project || 'BCCeC';
const rootName = args.root || 'Google Drive – BCCeC';

const E = process.env;
const DB = E.APPWRITE_DATABASE_ID || E.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const COL = {
  PROJECTS: E.NEXT_PUBLIC_APPWRITE_COL_PROJECTS || 'pms_projects',
  DOCUMENTS: E.NEXT_PUBLIC_APPWRITE_COL_DOCUMENTS || 'pms_documents',
  FOLDERS: E.NEXT_PUBLIC_APPWRITE_COL_DOCUMENT_FOLDERS || 'pms_document_folders',
  VERSIONS: E.NEXT_PUBLIC_APPWRITE_COL_DOCUMENT_VERSIONS || 'pms_document_versions',
};
const BUCKET = E.NEXT_PUBLIC_APPWRITE_BUCKET_DOCS || 'pms-project-docs';
const client = new Client().setEndpoint(E.APPWRITE_ENDPOINT).setProject(E.APPWRITE_PROJECT_ID).setKey(E.APPWRITE_API_KEY);
const db = new Databases(client);
const storage = new Storage(client);

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const EXT = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const categoryOf = (item) => (/wordprocessing|pdf/.test(item.mime) ? 'report' : 'other');
const titleOf = (name) => name.replace(/\.[A-Za-z0-9]+$/, '').replace(/#/g, '').replace(/\s+/g, ' ').trim();

// Same rule as lib/rbac.js getProjectDocPermissions (called with the org id).
const docPermissions = (orgId, teamId) => [
  Permission.read(Role.team(orgId)),
  Permission.read(Role.team(teamId)),
  Permission.update(Role.label('admin')),
  Permission.update(Role.team(teamId, 'manager')),
  Permission.update(Role.team(teamId, 'owner')),
  Permission.delete(Role.label('admin')),
  Permission.delete(Role.team(teamId, 'owner')),
];

async function localFile(item) {
  const ext = EXT[item.mime] || item.name.split('.').pop().toLowerCase();
  const file = path.join(args.files, `${item.id}.${ext}`);
  if (fs.existsSync(file)) return file;
  if (!APPLY) return file; // dry run: will be downloaded on apply
  const res = await fetch(`https://drive.google.com/uc?export=download&id=${item.id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Download failed for "${item.name}" (HTTP ${res.status})`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

(async () => {
  const projects = await db.listDocuments(DB, COL.PROJECTS, [Query.equal('code', projectCode), Query.limit(2)]);
  if (projects.total !== 1) throw new Error(`Expected one project with code "${projectCode}", found ${projects.total}.`);
  const project = projects.documents[0];
  const permissions = docPermissions(project.organizationId, project.projectTeamId);
  console.log(`Project: ${project.name} (${project.code})`);
  console.log(`Mode: ${APPLY ? 'APPLY — uploading' : 'DRY RUN — nothing will be written'}\n`);

  const inventory = JSON.parse(fs.readFileSync(args.inventory, 'utf8'));
  const files = inventory.filter((i) => i.mime !== FOLDER_MIME);
  const existingFolders = (await db.listDocuments(DB, COL.FOLDERS, [Query.equal('projectId', project.$id), Query.limit(500)])).documents;
  const existingDocs = (await db.listDocuments(DB, COL.DOCUMENTS, [Query.equal('projectId', project.$id), Query.limit(1000)])).documents;

  const folderCache = new Map(); // "parentId|name" -> folder id
  async function ensureFolder(name, parentId) {
    const key = `${parentId || ''}|${name}`;
    if (folderCache.has(key)) return folderCache.get(key);
    const found = existingFolders.find((f) => f.name === name && (f.parentFolderId || null) === (parentId || null));
    let id = found?.$id;
    if (!id) {
      if (APPLY) {
        const folder = await db.createDocument(DB, COL.FOLDERS, ID.unique(), {
          projectId: project.$id, name, parentFolderId: parentId || null, projectFolder: !parentId,
          createdBy: args.uploader, modifiedBy: args.uploader,
          isClientVisible: false, isStaffVisible: true, staffList: [], clientList: [],
        });
        id = folder.$id;
      } else {
        id = `(new:${name})`;
      }
      console.log(`  + folder ${parentId ? '…/' : ''}${name}`);
    }
    folderCache.set(key, id);
    return id;
  }

  const rootId = await ensureFolder(rootName, null);
  let uploaded = 0;
  let skipped = 0;
  for (const item of files.sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = item.path.split('/');
    let parentId = rootId;
    for (const dir of parts.slice(0, -1)) parentId = await ensureFolder(dir, parentId);
    const title = titleOf(item.name);
    const already = existingDocs.find((d) => d.title === title && (d.parentFolderId || null) === parentId);
    if (already) { skipped += 1; console.log(`  = skip (already there): ${item.path}`); continue; }

    const file = await localFile(item);
    console.log(`  + ${item.path}  [${categoryOf(item)}, ${Math.round((item.size || 0) / 1024)} KB]`);
    if (!APPLY) continue;

    const bytes = fs.readFileSync(file);
    const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
    const docId = ID.unique();
    const stored = await storage.createFile(BUCKET, docId, InputFile.fromBuffer(bytes, item.name), permissions);
    await db.createDocument(DB, COL.DOCUMENTS, ID.unique(), {
      documentId: docId, projectId: project.$id, uploaderId: args.uploader, title,
      category: categoryOf(item), currentVersion: 1, parentFolderId: parentId,
      isClientVisible: false, isStaffVisible: true, staffList: [], clientList: [],
    }, permissions);
    await db.createDocument(DB, COL.VERSIONS, ID.unique(), {
      documentId: docId, versionNo: 1, fileId: stored.$id, mimeType: item.mime,
      sizeBytes: bytes.length, checksumSha256: checksum, uploadedBy: args.uploader,
      uploadedAt: new Date().toISOString(),
    }, permissions);
    uploaded += 1;
  }
  console.log(`\n${APPLY ? 'Uploaded' : 'Would upload'} ${APPLY ? uploaded : files.length - skipped} file(s); ${skipped} already present.`);
  if (!APPLY) console.log('Dry run complete. Re-run with --apply to upload.');
})().catch((error) => {
  console.error('Import stopped:', error.message);
  process.exit(1);
});

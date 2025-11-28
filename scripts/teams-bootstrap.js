#!/usr/bin/env node
/* eslint-disable no-console */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { env } = require('node:process');

const {
  Client,
  Teams,
  Users,
  Databases,
  ID,
  Permission,
  Role
} = require('node-appwrite');

const APPWRITE_ENDPOINT = env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = env.APPWRITE_API_KEY;

const DB_ID = env.APPWRITE_DATABASE_ID || 'pms_db';
const COL_ORGS = 'pms_organizations';
const COL_USERS = 'pms_users';

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error('Missing required envs: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  process.exit(1);
}

function parseArg(key) {
  const a = process.argv.indexOf(key);
  if (a !== -1 && process.argv[a + 1]) return process.argv[a + 1];
  return null;
}

// Interactive input helper
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false // Disable terminal mode for better Windows compatibility
});

function question(query) {
  return new Promise(resolve => {
    // Explicitly write to stdout for better visibility in PowerShell
    process.stdout.write(query);
    rl.once('line', (answer) => {
      resolve(answer);
    });
  });
}

function questionHidden(query) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(query);
    stdin.resume();

    // Check if setRawMode is available (not available in some Windows terminals)
    const supportsRawMode = typeof stdin.setRawMode === 'function';

    if (supportsRawMode) {
      try {
        stdin.setRawMode(true);
      } catch (e) {
        console.warn('\n(Note: Password masking not available in this terminal)');
      }
    } else {
      console.warn('\n(Note: Password masking not available in this terminal)');
    }

    stdin.setEncoding('utf8');

    let password = '';
    stdin.on('data', function onData(char) {
      char = char.toString('utf8');

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          if (supportsRawMode && stdin.isTTY) {
            try {
              stdin.setRawMode(false);
            } catch (e) {
              // Ignore
            }
          }
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.exit();
          break;
        case '\u007f': // Backspace
        case '\b':
          if (supportsRawMode && stdin.isTTY) {
            password = password.slice(0, -1);
            stdout.clearLine();
            stdout.cursorTo(0);
            stdout.write(query + '*'.repeat(password.length));
          }
          break;
        default:
          password += char;
          if (supportsRawMode && stdin.isTTY) {
            stdout.write('*');
          }
          break;
      }
    });
  });
}

function slugify(s) {
  // Create a slug and ensure it fits within Appwrite's 36-char limit
  // We need to reserve 4 chars for 'org_' prefix, leaving 32 chars for the slug
  let slug = String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '');

  // Truncate to 32 chars to leave room for 'org_' prefix (total 36 chars max)
  if (slug.length > 32) {
    slug = slug.substring(0, 32);
  }

  return slug;
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const teams = new Teams(client);
const users = new Users(client);
const databases = new Databases(client);

async function ensureTeam(teamId, name) {
  try {
    await teams.get(teamId);
    console.log(`✓ Team exists: ${teamId}`);
  } catch (e) {
    if (e && e.code === 404) {
      await teams.create(teamId, name);
      console.log(`+ Created Team: ${teamId}`);
    } else {
      throw e;
    }
  }
}

// For duplicate-invite safety, we check memberships by email when possible.
async function hasMembershipByEmail(teamId, email) {
  const list = await teams.listMemberships(teamId);
  return list.memberships.some((m) => (m.userEmail && m.userEmail.toLowerCase() === email.toLowerCase()));
}

async function inviteToTeam(teamId, u) {
  const email = u.email;
  // Note: We no longer use team roles. Labels will be assigned when user accepts invitation.
  // The 'roles' field in the seed data is preserved for reference but not used in team membership.
  if (await hasMembershipByEmail(teamId, email)) {
    console.log(`  · Already a member/invited: ${email}`);
    return;
  }
  // Use firstName + lastName for display name in invitation
  const displayName = `${u.firstName} ${u.lastName}`.trim() || u.username;
  await teams.createMembership(teamId, [], email, INVITE_REDIRECT, displayName);
  const userRole = Array.isArray(u.roles) && u.roles.length ? u.roles[0] : 'staff';
  console.log(`  + Invited: ${email} (@${u.username}) [Role to assign: ${userRole}]`);
}

async function ensureOrgDoc(orgTeamId, name) {
  // Find by code (slug)
  const code = slugify(name);
  try {
    const doc = await databases.createDocument(DB_ID, COL_ORGS, ID.unique(), {
      name,
      code,
      isActive: true
    });
    console.log(`+ Created org doc in ${COL_ORGS}: ${doc.$id}`);
    return doc;
  } catch (e) {
    if (e && e.code === 409) {
      console.log('· Org document likely exists (409). Skipping create.');
      return null;
    }
    if (e && e.code === 404) {
      console.error('pms_organizations collection not found. Run collections-setup.js first.');
      throw e;
    }
    throw e;
  }
}

async function createUserProfileStub(orgTeamId, seedUser) {
  try {
    // Note: For invite stubs, we use minimal permissions since accountId is 'pending'
    // Once user accepts and accountId is updated, permissions should be updated too
    const permissions = [
      Permission.read(Role.team(orgTeamId)),
      Permission.read(Role.label('manager')),
      Permission.read(Role.label('admin')),
      Permission.update(Role.label('admin')),
      Permission.delete(Role.label('admin')),
    ];

    await databases.createDocument(
      DB_ID,
      COL_USERS,
      ID.unique(),
      {
        accountId: 'pending',
        organizationId: orgTeamId,
        email: seedUser.email,
        username: seedUser.username,
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
        otherNames: seedUser.otherNames || null,
        status: 'invited',
        timezone: 'Africa/Kampala'
      },
      permissions
    );
    console.log(`    · Created profile stub for @${seedUser.username} (${seedUser.email})`);
  } catch (e) {
    if (e && e.code === 404) {
      console.error('pms_users collection not found. Run collections-setup.js first.');
      throw e;
    }
    if (e && e.code === 409) {
      console.log(`    · Profile stub may already exist for @${seedUser.username}`);
    } else {
      console.log(`    · (warn) Could not create stub for @${seedUser.username}: ${e.message || e}`);
    }
  }
}

async function createAdminUser(orgTeamId, adminData) {
  console.log('\n→ Starting admin user creation process...');
  console.log(`  Organization Team ID: ${orgTeamId}`);
  console.log(`  Email: ${adminData.email}`);
  console.log(`  Username: ${adminData.username}`);
  console.log(`  Name: ${adminData.firstName} ${adminData.lastName}`);

  try {
    // 1. Create the user account in Appwrite Auth
    console.log('\n→ Step 1: Creating user account in Appwrite Auth...');
    const userId = ID.unique();
    console.log(`  Generated User ID: ${userId}`);
    console.log(`  Calling users.create()...`);

    const user = await users.create(
      userId,
      adminData.email,
      undefined, // phone
      adminData.password,
      `${adminData.firstName} ${adminData.lastName}`
    );
    console.log(`✓ Successfully created admin account!`);
    console.log(`  User ID: ${user.$id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);

    // 2. Add admin label to user
    console.log('\n→ Step 2: Adding admin label to user...');
    try {
      await users.updateLabels(user.$id, ['admin']);
      console.log(`✓ Successfully added admin label to user`);
    } catch (e) {
      console.error(`✗ Failed to add admin label: ${e.message || e}`);
      console.error(`  Error code: ${e.code || 'none'}`);
      console.error(`  Error type: ${e.type || 'none'}`);
      if (e.response) {
        console.error(`  Response: ${JSON.stringify(e.response, null, 2)}`);
      }
      throw e;
    }

    // 3. Add user to organization team (for membership only, no roles)
    console.log('\n→ Step 3: Adding user to organization team...');
    console.log(`  Team ID: ${orgTeamId}`);
    try {
      const membership = await teams.createMembership(
        orgTeamId,
        [], // No roles - just membership
        undefined, // email (undefined since we're using userId)
        user.$id, // userId - directly add the existing user
        undefined, // phone
        '', // url (empty string for no redirect)
        `${adminData.firstName} ${adminData.lastName}`
      );
      console.log(`✓ Successfully added to org team (membership only)`);
      console.log(`  Membership ID: ${membership.$id}`);
    } catch (e) {
      console.warn(`⚠ Could not add to team: ${e.message || e}`);
      console.warn(`  Error code: ${e.code || 'none'}`);
      console.warn(`  Error type: ${e.type || 'none'}`);
      if (e.response) {
        console.warn(`  Response: ${JSON.stringify(e.response, null, 2)}`);
      }
    }

    // 4. Create user profile document
    console.log('\n→ Step 4: Creating user profile document...');
    console.log(`  Collection: ${COL_USERS}`);
    console.log(`  Database: ${DB_ID}`);

    const profileData = {
      accountId: user.$id,
      organizationId: orgTeamId,
      email: adminData.email,
      username: adminData.username,
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      otherNames: adminData.otherNames || null,
      status: 'active',
      title: 'System Administrator',
      timezone: 'Africa/Kampala'
    };
    console.log(`  Profile data: ${JSON.stringify(profileData, null, 2)}`);

    // Set permissions for the user profile (using labels)
    const permissions = [
      Permission.read(Role.user(user.$id)),
      Permission.read(Role.team(orgTeamId)),
      Permission.update(Role.user(user.$id)),
      Permission.update(Role.label('admin')),
      Permission.delete(Role.label('admin')),
    ];

    const profileDoc = await databases.createDocument(
      DB_ID,
      COL_USERS,
      ID.unique(),
      profileData,
      permissions
    );
    console.log(`✓ Successfully created user profile`);
    console.log(`  Profile ID: ${profileDoc.$id}`);
    console.log(`  Username: @${adminData.username}`);

    return user;
  } catch (e) {
    console.error('\n✗ Error during admin user creation:');
    console.error(`  Message: ${e.message || 'Unknown error'}`);
    console.error(`  Code: ${e.code || 'none'}`);
    console.error(`  Type: ${e.type || 'none'}`);
    if (e.response) {
      console.error(`  Response: ${JSON.stringify(e.response, null, 2)}`);
    }
    if (e.stack) {
      console.error(`  Stack: ${e.stack}`);
    }

    if (e && e.code === 409) {
      console.error(`\n✗ User with email ${adminData.email} already exists.`);
      throw new Error('Admin user already exists');
    }
    throw e;
  }
}

async function run() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       NREP Project Management System - Setup              ║');
  console.log('║       Organization & Admin User Bootstrap                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log();

  // Check if running in non-interactive mode (with --users flag)
  const usersFile = parseArg('--users');
  if (usersFile) {
    console.log('Running in non-interactive mode (legacy)...\n');
    await runLegacyMode(usersFile);
    rl.close();
    return;
  }

  console.log('This wizard will help you set up:');
  console.log('  1. Your organization');
  console.log('  2. The first admin user account');
  console.log();
  console.log('After setup, you can log in and invite other users through the UI.\n');

  // Step 1: Organization Setup
  console.log('─────────────────────────────────────');
  console.log('Step 1: Organization Setup');
  console.log('─────────────────────────────────────');

  const orgName = await question('Organization Name (e.g., NREP): ');
  if (!orgName || orgName.trim() === '') {
    console.error('✗ Organization name is required.');
    process.exit(1);
  }

  const orgSlug = slugify(orgName);
  const orgTeamId = `org_${orgSlug}`;

  console.log(`\n→ Organization ID will be: ${orgTeamId}\n`);

  // Step 2: Admin User Setup
  console.log('─────────────────────────────────────');
  console.log('Step 2: Admin User Account');
  console.log('─────────────────────────────────────');

  const adminEmail = await question('Admin Email: ');
  if (!adminEmail || !adminEmail.includes('@')) {
    console.error('✗ Valid email is required.');
    process.exit(1);
  }

  const adminUsername = await question('Admin Username: ');
  if (!adminUsername || adminUsername.trim() === '') {
    console.error('✗ Username is required.');
    process.exit(1);
  }

  const adminFirstName = await question('First Name: ');
  if (!adminFirstName || adminFirstName.trim() === '') {
    console.error('✗ First name is required.');
    process.exit(1);
  }

  const adminLastName = await question('Last Name: ');
  if (!adminLastName || adminLastName.trim() === '') {
    console.error('✗ Last name is required.');
    process.exit(1);
  }

  const adminOtherNames = await question('Other Names (optional, press Enter to skip): ');

  let adminPassword = '';
  let confirmPassword = '';

  do {
    adminPassword = await questionHidden('Admin Password (min 8 characters): ');

    if (adminPassword.length < 8) {
      console.log('✗ Password must be at least 8 characters. Try again.');
      continue;
    }

    confirmPassword = await questionHidden('Confirm Password: ');

    if (adminPassword !== confirmPassword) {
      console.log('✗ Passwords do not match. Try again.\n');
      adminPassword = '';
    }
  } while (adminPassword !== confirmPassword || adminPassword.length < 8);

  console.log('\n─────────────────────────────────────');
  console.log('Setup Summary');
  console.log('─────────────────────────────────────');
  console.log(`Organization: ${orgName}`);
  console.log(`Org Team ID:  ${orgTeamId}`);
  console.log(`Admin Email:  ${adminEmail}`);
  console.log(`Admin User:   @${adminUsername}`);
  console.log(`Admin Name:   ${adminFirstName} ${adminOtherNames ? adminOtherNames + ' ' : ''}${adminLastName}`);
  console.log('─────────────────────────────────────\n');

  const confirm = await question('Proceed with setup? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('Setup cancelled.');
    rl.close();
    process.exit(0);
  }

  console.log('\n⏳ Setting up...\n');

  try {
    // Create organization team
    await ensureTeam(orgTeamId, orgName);

    // Create organization document
    await ensureOrgDoc(orgTeamId, orgName);

    // Create admin user
    await createAdminUser(orgTeamId, {
      email: adminEmail,
      username: adminUsername,
      firstName: adminFirstName,
      lastName: adminLastName,
      otherNames: adminOtherNames,
      password: adminPassword
    });

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                   ✓ Setup Complete!                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log();
    console.log('Next steps:');
    console.log(`  1. Start the dev server: npm run dev`);
    console.log(`  2. Open http://localhost:3000/login`);
    console.log(`  3. Log in with:`);
    console.log(`     Email: ${adminEmail}`);
    console.log(`     Password: (the one you just set)`);
    console.log(`  4. Navigate to Admin panel to invite other users`);
    console.log();
    console.log('Happy project managing! 🚀');
    console.log();

  } catch (error) {
    console.error('\n✗ Setup failed:', error.message);
    process.exit(1);
  }

  rl.close();
}

// Legacy mode: batch invite from JSON file (kept for backwards compatibility)
async function runLegacyMode(usersFile) {
  const ORG_NAME = parseArg('--org') || env.ORG_NAME || 'My Organization';
  const orgSlug = slugify(ORG_NAME);
  const ORG_TEAM_ID = env.ORG_TEAM_ID || `org_${orgSlug}`;
  const INVITE_REDIRECT = env.APPWRITE_INVITE_REDIRECT || 'http://localhost:3000/auth/callback';

  await ensureTeam(ORG_TEAM_ID, ORG_NAME);

  let seeds = [];
  const filePath = path.resolve(process.cwd(), usersFile);
  if (!fs.existsSync(filePath)) {
    console.error(`Users file not found: ${filePath}`);
    process.exit(1);
  }
  try {
    seeds = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Invalid JSON in users file:', e.message);
    process.exit(1);
  }

  console.log(`Inviting ${seeds.length} users to ${ORG_TEAM_ID}...`);
  for (const u of seeds) {
    await inviteToTeam(ORG_TEAM_ID, u);
  }

  await ensureOrgDoc(ORG_TEAM_ID, ORG_NAME);
  for (const u of seeds) {
    await createUserProfileStub(ORG_TEAM_ID, u);
  }

  console.log('✓ Done.');
}

run().catch((e) => {
  console.error(e);
  rl.close();
  process.exit(1);
});

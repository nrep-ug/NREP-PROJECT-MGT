/**
 * Admin API - Run teams bootstrap
 * POST: Trigger teams-bootstrap script
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request) {
  try {
    // In production, add authentication check here
    // Verify the user is an org admin before allowing this

    const body = await request.json();
    const { orgName, usersFile } = body;

    let command = 'node scripts/teams-bootstrap.js';
    if (orgName) {
      command += ` --org "${orgName}"`;
    }
    if (usersFile) {
      command += ` --users "${usersFile}"`;
    }

    const { stdout, stderr } = await execAsync(command);

    return NextResponse.json({
      success: true,
      output: stdout,
      errors: stderr || null,
    });
  } catch (error) {
    console.error('[API /admin/bootstrap/teams POST]', error);
    return NextResponse.json({
      error: error.message || 'Failed to run teams bootstrap',
      output: error.stdout || '',
      errors: error.stderr || '',
    }, { status: 500 });
  }
}

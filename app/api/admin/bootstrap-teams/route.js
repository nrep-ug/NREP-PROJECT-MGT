/**
 * Bootstrap Teams API - Run teams bootstrap script
 * POST: Trigger teams bootstrap script
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request) {
  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    console.log('[API /admin/bootstrap-teams] Starting teams bootstrap...');

    // Run the npm script for teams bootstrap
    // Pass organizationId as environment variable
    const { stdout, stderr } = await execAsync('npm run setup:teams', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ORGANIZATION_ID: organizationId,
      },
      timeout: 120000, // 2 minute timeout
    });

    console.log('[API /admin/bootstrap-teams] stdout:', stdout);
    if (stderr) {
      console.warn('[API /admin/bootstrap-teams] stderr:', stderr);
    }

    return NextResponse.json({
      success: true,
      message: 'Teams bootstrap completed',
      output: stdout,
    });
  } catch (error) {
    console.error('[API /admin/bootstrap-teams] Error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to bootstrap teams',
        details: error.stderr || error.stdout,
      },
      { status: 500 }
    );
  }
}

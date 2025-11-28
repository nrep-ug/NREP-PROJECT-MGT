/**
 * Admin API - Run collections setup
 * POST: Trigger collections-setup script
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request) {
  try {
    // In production, add authentication check here
    // Verify the user is an org admin before allowing this

    const { stdout, stderr } = await execAsync('node scripts/collections-setup.js');

    return NextResponse.json({
      success: true,
      output: stdout,
      errors: stderr || null,
    });
  } catch (error) {
    console.error('[API /admin/bootstrap/collections POST]', error);
    return NextResponse.json({
      error: error.message || 'Failed to run collections setup',
      output: error.stdout || '',
      errors: error.stderr || '',
    }, { status: 500 });
  }
}

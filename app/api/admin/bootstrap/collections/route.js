/**
 * Admin API - Run collections setup
 * POST: Trigger collections-setup script
 */

import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { apiErrorResponse, requireAdmin, requireAuthenticatedContext } from '@/lib/serverAuth';

const execFileAsync = promisify(execFile);

export async function POST(request) {
  try {
    const context = await requireAuthenticatedContext(request);
    requireAdmin(context);

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['scripts/collections-setup.js'],
      { cwd: process.cwd(), timeout: 120000 }
    );

    return NextResponse.json({
      success: true,
      output: stdout,
      errors: stderr || null,
    });
  } catch (error) {
    console.error('[API /admin/bootstrap/collections POST]', error);
    const response = apiErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

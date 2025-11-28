/**
 * Session API - Get current user session info
 * GET: Returns basic session info (used by middleware for role-based routing)
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    // This endpoint is called by middleware, so we need to be efficient
    // We'll use the Appwrite SDK to get user info from the session cookie

    const { Client, Account } = await import('node-appwrite');

    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('appwrite-session');

    if (!sessionCookie) {
      return NextResponse.json({ error: 'No session' }, { status: 401 });
    }

    // Create Appwrite client with the session
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
      .setSession(sessionCookie.value);

    const account = new Account(client);

    // Get user account info (includes labels with roles)
    const user = await account.get();

    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Extract role information from labels
    const labels = user.labels || [];
    const isAdmin = labels.includes('admin');
    const isStaff = labels.includes('staff') || isAdmin;
    const isClient = labels.includes('client');

    return NextResponse.json({
      isAdmin,
      isStaff,
      isClient,
      labels,
      userId: user.$id,
      email: user.email,
    });
  } catch (error) {
    console.error('[API /auth/session] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get session' },
      { status: 500 }
    );
  }
}

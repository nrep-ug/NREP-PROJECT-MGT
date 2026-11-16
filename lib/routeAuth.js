import { NextResponse } from 'next/server';
import { apiErrorResponse, requireAuthenticatedContext } from './serverAuth';

/**
 * Authenticate an API request from its Appwrite JWT (Authorization: Bearer).
 *
 * The caller's identity, labels and organization come ONLY from the verified
 * token, never from query strings or request bodies (requesterId, createdBy,
 * updatedBy, organizationId, labels…). Those client-supplied values must be
 * ignored by every route that uses this helper.
 *
 * Usage:
 *   const { context, response } = await authenticateRequest(request);
 *   if (response) return response;
 *
 * @returns {Promise<{ context?: object, response?: NextResponse }>}
 */
export async function authenticateRequest(request) {
  try {
    return { context: await requireAuthenticatedContext(request) };
  } catch (error) {
    const { status, body } = apiErrorResponse(error);
    if (status >= 500) console.error('[routeAuth]', error);
    return { response: NextResponse.json(body, { status }) };
  }
}

/** Staff = staff, manager or admin label (clients and other roles excluded). */
export function isStaffContext(context) {
  const labels = context?.labels || [];
  return labels.includes('staff') || labels.includes('manager') || labels.includes('admin');
}

/**
 * Returns a 403 response when a resource belongs to a different organization
 * than the authenticated caller, otherwise null.
 */
export function forbidOtherOrganization(context, organizationId) {
  if (organizationId && organizationId !== context.organizationId) {
    return NextResponse.json(
      { error: 'Forbidden: this record belongs to another organization' },
      { status: 403 }
    );
  }
  return null;
}

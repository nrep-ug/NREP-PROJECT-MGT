/**
 * Clients API - List and Create
 * GET: List clients scoped by org
 * POST: Create client (admin only)
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, ID, Query, DB_ID } from '@/lib/appwriteAdmin';
import { verifyAdminAccess } from '@/lib/authHelpers';
import { getOrgDocPermissions } from '@/lib/rbac';

const COL_CLIENTS = 'pms_clients';

/**
 * GET /api/clients
 * List all clients in an organization with contact person details
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const queries = [Query.equal('organizationId', organizationId)];

    const response = await adminDatabases.listDocuments(DB_ID, COL_CLIENTS, queries);

    // Enrich with primary contact details
    const primaryContactIds = [...new Set(response.documents
      .map(c => c.primaryContactId)
      .filter(id => id))]; // Filter out null/undefined

    let contactsMap = {};

    if (primaryContactIds.length > 0) {
      try {
        const contactsRes = await adminDatabases.listDocuments(
          DB_ID,
          'pms_users',
          [Query.equal('accountId', primaryContactIds)]
        );

        contactsRes.documents.forEach(contact => {
          contactsMap[contact.accountId] = {
            id: contact.accountId,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email
          };
        });
      } catch (err) {
        console.error('Failed to fetch primary contacts', err);
      }
    }

    const clientsWithContacts = response.documents.map(client => ({
      ...client,
      primaryContact: client.primaryContactId ? contactsMap[client.primaryContactId] : null
    }));

    return NextResponse.json({ clients: clientsWithContacts, total: response.total });
  } catch (error) {
    console.error('[API /clients GET]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch clients' }, { status: 500 });
  }
}

/**
 * POST /api/clients
 * Create a new client organization (admin only)
 * Note: Only organization admins can create client organizations
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      organizationId,
      name,
      code,
      primaryContactId,    // Reference to user account
      email,               // Organization email
      phone,               // Organization phone
      address,
      website,
      notes,
      status,
      requesterId // ID of the user making the request (for authorization)
    } = body;

    // Validate required fields
    if (!organizationId || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: organizationId, name' },
        { status: 400 }
      );
    }

    // If primaryContactId is provided, validate it's a valid client user
    if (primaryContactId) {
      try {
        const contactProfile = await adminDatabases.listDocuments(
          DB_ID,
          'pms_users',
          [
            Query.equal('accountId', primaryContactId),
            Query.limit(1)
          ]
        );

        if (contactProfile.documents.length === 0) {
          return NextResponse.json(
            { error: 'Primary contact user not found' },
            { status: 404 }
          );
        }

        // Verify the user has client label
        const user = await adminUsers.get(primaryContactId);
        if (!user.labels || !user.labels.includes('client')) {
          return NextResponse.json(
            { error: 'Primary contact must be a user with client role' },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error('Error validating primary contact:', error);
        return NextResponse.json(
          { error: 'Failed to validate primary contact' },
          { status: 500 }
        );
      }
    }

    // Verify requester has admin access
    if (!requesterId) {
      return NextResponse.json(
        { error: 'Unauthorized: requesterId is required' },
        { status: 401 }
      );
    }

    const isAdmin = await verifyAdminAccess(requesterId);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create clients' },
        { status: 403 }
      );
    }

    // Create client document with permissions
    const permissions = getOrgDocPermissions(organizationId);

    const clientData = {
      organizationId,
      name,
      code: code || null,
      primaryContactId: primaryContactId || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      website: website || null,
      notes: notes || null,
      status: status || 'active',
    };

    const client = await adminDatabases.createDocument(
      DB_ID,
      COL_CLIENTS,
      ID.unique(),
      clientData,
      permissions
    );

    // If primary contact was assigned, update the user's clientOrganizationIds
    if (primaryContactId) {
      try {
        const contactProfile = await adminDatabases.listDocuments(
          DB_ID,
          'pms_users',
          [
            Query.equal('accountId', primaryContactId),
            Query.limit(1)
          ]
        );

        if (contactProfile.documents.length > 0) {
          const userProfile = contactProfile.documents[0];
          const currentClientOrgs = userProfile.clientOrganizationIds || [];

          // Add this client org to user's clientOrganizationIds if not already there
          if (!currentClientOrgs.includes(client.$id)) {
            await adminDatabases.updateDocument(
              DB_ID,
              'pms_users',
              userProfile.$id,
              {
                clientOrganizationIds: [...currentClientOrgs, client.$id]
              }
            );
          }
        }
      } catch (error) {
        console.error('Failed to update user clientOrganizationIds:', error);
        // Don't fail the request if this update fails
      }
    }

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error('[API /clients POST]', error);

    let errorMessage = 'Failed to create client';
    let statusCode = 500;

    if (error.code === 409) {
      errorMessage = 'Client with this name already exists';
      statusCode = 409;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage, code: error.code, type: error.type },
      { status: statusCode }
    );
  }
}

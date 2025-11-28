/**
 * Client API - Get, Update, Delete single client
 * GET: Get client by ID with contact details
 * PUT: Update client (admin/manager only)
 * DELETE: Delete client (admin only)
 */

import { NextResponse } from 'next/server';
import { adminDatabases, adminUsers, Query, DB_ID } from '@/lib/appwriteAdmin';
import { verifyAdminAccess } from '@/lib/authHelpers';

const COL_CLIENTS = 'pms_clients';

/**
 * GET /api/clients/[id]
 * Get a single client organization with contact details
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const client = await adminDatabases.getDocument(DB_ID, COL_CLIENTS, id);

    // Enrich with primary contact details
    if (client.primaryContactId) {
      try {
        const contactProfiles = await adminDatabases.listDocuments(
          DB_ID,
          'pms_users',
          [
            Query.equal('accountId', client.primaryContactId),
            Query.limit(1)
          ]
        );

        if (contactProfiles.documents.length > 0) {
          const contact = contactProfiles.documents[0];
          return NextResponse.json({
            client: {
              ...client,
              primaryContact: {
                accountId: contact.accountId,
                email: contact.email,
                username: contact.username,
                firstName: contact.firstName,
                lastName: contact.lastName,
                title: contact.title,
                status: contact.status
              }
            }
          });
        }
      } catch (error) {
        console.error(`Failed to fetch contact for client ${id}:`, error);
      }
    }

    return NextResponse.json({ client });
  } catch (error) {
    console.error('[API /clients/[id] GET]', error);

    if (error.code === 404) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ error: error.message || 'Failed to fetch client' }, { status: 500 });
  }
}

/**
 * PUT /api/clients/[id]
 * Update a client organization (admin only)
 * Note: Only organization admins can update client organizations
 */
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      name,
      code,
      primaryContactId,
      contactName,         // Legacy field (optional)
      contactEmail,        // Legacy field (optional)
      contactPhone,        // Legacy field (optional)
      address,
      website,
      notes,
      status,
      requesterId // ID of the user making the request (for authorization)
    } = body;

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
        { error: 'Forbidden: Only administrators can update clients' },
        { status: 403 }
      );
    }

    // Get existing client
    const existingClient = await adminDatabases.getDocument(DB_ID, COL_CLIENTS, id);

    // If primaryContactId is being changed, validate the new contact
    if (primaryContactId && primaryContactId !== existingClient.primaryContactId) {
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

    // Prepare update data (only include fields that are provided)
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code || null;
    if (primaryContactId !== undefined) updateData.primaryContactId = primaryContactId || null;
    if (contactName !== undefined) updateData.contactName = contactName || null;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail || null;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone || null;
    if (address !== undefined) updateData.address = address || null;
    if (website !== undefined) updateData.website = website || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (status !== undefined) updateData.status = status;

    // Update client document
    const updatedClient = await adminDatabases.updateDocument(
      DB_ID,
      COL_CLIENTS,
      id,
      updateData
    );

    // Handle primary contact changes
    const oldContactId = existingClient.primaryContactId;
    const newContactId = primaryContactId !== undefined ? primaryContactId : oldContactId;

    // Remove old contact's association
    if (oldContactId && oldContactId !== newContactId) {
      try {
        const oldContactProfiles = await adminDatabases.listDocuments(
          DB_ID,
          'pms_users',
          [
            Query.equal('accountId', oldContactId),
            Query.limit(1)
          ]
        );

        if (oldContactProfiles.documents.length > 0) {
          const userProfile = oldContactProfiles.documents[0];
          const currentClientOrgs = userProfile.clientOrganizationIds || [];
          const updatedClientOrgs = currentClientOrgs.filter(orgId => orgId !== id);

          await adminDatabases.updateDocument(
            DB_ID,
            'pms_users',
            userProfile.$id,
            { clientOrganizationIds: updatedClientOrgs }
          );
        }
      } catch (error) {
        console.error('Failed to remove old contact association:', error);
      }
    }

    // Add new contact's association
    if (newContactId && newContactId !== oldContactId) {
      try {
        const newContactProfiles = await adminDatabases.listDocuments(
          DB_ID,
          'pms_users',
          [
            Query.equal('accountId', newContactId),
            Query.limit(1)
          ]
        );

        if (newContactProfiles.documents.length > 0) {
          const userProfile = newContactProfiles.documents[0];
          const currentClientOrgs = userProfile.clientOrganizationIds || [];

          if (!currentClientOrgs.includes(id)) {
            await adminDatabases.updateDocument(
              DB_ID,
              'pms_users',
              userProfile.$id,
              { clientOrganizationIds: [...currentClientOrgs, id] }
            );
          }
        }
      } catch (error) {
        console.error('Failed to add new contact association:', error);
      }
    }

    return NextResponse.json({ client: updatedClient });
  } catch (error) {
    console.error('[API /clients/[id] PUT]', error);

    if (error.code === 404) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    let errorMessage = 'Failed to update client';
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

/**
 * DELETE /api/clients/[id]
 * Delete a client organization (admin only)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const requesterId = searchParams.get('requesterId');

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
        { error: 'Forbidden: Only administrators can delete clients' },
        { status: 403 }
      );
    }

    // Get client before deleting to handle cleanup
    const client = await adminDatabases.getDocument(DB_ID, COL_CLIENTS, id);

    // Remove client org from primary contact's clientOrganizationIds
    if (client.primaryContactId) {
      try {
        const contactProfiles = await adminDatabases.listDocuments(
          DB_ID,
          'pms_users',
          [
            Query.equal('accountId', client.primaryContactId),
            Query.limit(1)
          ]
        );

        if (contactProfiles.documents.length > 0) {
          const userProfile = contactProfiles.documents[0];
          const currentClientOrgs = userProfile.clientOrganizationIds || [];
          const updatedClientOrgs = currentClientOrgs.filter(orgId => orgId !== id);

          await adminDatabases.updateDocument(
            DB_ID,
            'pms_users',
            userProfile.$id,
            { clientOrganizationIds: updatedClientOrgs }
          );
        }
      } catch (error) {
        console.error('Failed to remove contact association:', error);
      }
    }

    // Delete the client
    await adminDatabases.deleteDocument(DB_ID, COL_CLIENTS, id);

    return NextResponse.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    console.error('[API /clients/[id] DELETE]', error);

    if (error.code === 404) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to delete client' },
      { status: 500 }
    );
  }
}

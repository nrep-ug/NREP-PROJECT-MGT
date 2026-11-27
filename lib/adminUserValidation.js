import { COLLECTIONS, adminDatabases, DB_ID, Query } from './appwriteAdmin';
import { HttpError } from './serverAuth';

function normalizeId(value, fieldName) {
  if (typeof value !== 'string' || !value.trim() || value.length > 64) {
    throw new HttpError(400, `${fieldName} contains an invalid identifier.`, 'INVALID_IDENTIFIER');
  }
  return value.trim();
}

export function normalizeIdList(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${fieldName} must be an array.`, 'INVALID_IDENTIFIER_LIST');
  }
  return [...new Set(value.map((item) => normalizeId(item, fieldName)))];
}

async function getOrganizationDocument(collectionId, id, organizationId, label) {
  let document;
  try {
    document = await adminDatabases.getDocument(DB_ID, collectionId, id);
  } catch (error) {
    if (error?.code === 404) {
      throw new HttpError(400, `${label} is not available in your organization.`, 'INVALID_ASSIGNMENT');
    }
    throw error;
  }
  if (document.organizationId !== organizationId) {
    throw new HttpError(400, `${label} is not available in your organization.`, 'INVALID_ASSIGNMENT');
  }
  return document;
}

export async function validateClientAssignments(organizationId, rawClientIds = [], rawProjectIds = []) {
  const clientOrganizationIds = normalizeIdList(rawClientIds, 'clientOrganizationIds');
  const projectIds = normalizeIdList(rawProjectIds, 'projectIds');

  const [clients, projects] = await Promise.all([
    Promise.all(clientOrganizationIds.map((id) => getOrganizationDocument(
      COLLECTIONS.CLIENTS,
      id,
      organizationId,
      'A selected client'
    ))),
    Promise.all(projectIds.map((id) => getOrganizationDocument(
      COLLECTIONS.PROJECTS,
      id,
      organizationId,
      'A selected project'
    ))),
  ]);

  const selectedClientIds = new Set(clients.map((client) => client.$id));
  for (const project of projects) {
    if (!project.clientId || !selectedClientIds.has(project.clientId)) {
      throw new HttpError(
        400,
        'Every selected project must belong to one of the selected clients.',
        'PROJECT_CLIENT_MISMATCH'
      );
    }
    if (!project.projectTeamId) {
      throw new HttpError(
        409,
        'A selected project is not ready for client access because its project team is missing.',
        'PROJECT_TEAM_REQUIRED'
      );
    }
  }

  return { clientOrganizationIds, projectIds, projects };
}

export async function validateSupervisorAssignment(organizationId, rawSupervisorId, accountId = null) {
  if (rawSupervisorId === undefined || rawSupervisorId === null || rawSupervisorId === '') return null;
  const supervisorId = normalizeId(rawSupervisorId, 'supervisorId');
  if (accountId && supervisorId === accountId) {
    throw new HttpError(400, 'A user cannot be their own supervisor.', 'SELF_SUPERVISOR');
  }

  const result = await adminDatabases.listDocuments(DB_ID, COLLECTIONS.USERS, [
    Query.equal('accountId', supervisorId),
    Query.limit(1),
  ]);
  const supervisor = result.documents[0];
  if (
    !supervisor ||
    supervisor.organizationId !== organizationId ||
    supervisor.userType === 'client' ||
    supervisor.status !== 'active'
  ) {
    throw new HttpError(400, 'The selected supervisor is not available in your organization.', 'INVALID_SUPERVISOR');
  }
  return supervisorId;
}

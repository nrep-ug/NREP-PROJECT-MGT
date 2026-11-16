import { Query } from '@/lib/appwriteAdmin';
import { HttpError } from '@/lib/serverAuth';
import { CC, listAll } from './service';
import { nameKey } from './domain';
import { HubValidationError, validateHub } from './hubDomain';

export const HUB_EDITABLE_KEYS = [
  'name', 'district', 'location', 'status', 'activities', 'otherActivity',
  'managerName', 'managerPhone', 'managerEmail', 'managerGender',
  'peopleWorking', 'womenWorking', 'youthWorking', 'householdsServed', 'establishedOn', 'notes',
];

/** validateHub, with validation failures turned into 400 responses. */
export function hubFields(body, options) {
  try {
    return validateHub(body, options);
  } catch (error) {
    if (error instanceof HubValidationError) throw new HttpError(400, error.message, 'VALIDATION_ERROR');
    throw error;
  }
}

export async function assertUniqueHubName(projectId, name, exceptId = null) {
  const hubs = await listAll(CC.HUBS, [Query.equal('projectId', projectId), Query.select(['$id', 'name'])]);
  if (hubs.some((h) => h.$id !== exceptId && nameKey(h.name) === nameKey(name))) {
    throw new HttpError(409, `A hub called "${name}" already exists.`, 'DUPLICATE');
  }
}

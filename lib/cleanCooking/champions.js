import { adminDatabases, DB_ID, Query } from '@/lib/appwriteAdmin';
import { CC, HttpError } from './service';

/** Hide personal contact details from users who may only read the project. */
export function redactChampion(champion, canSeeContacts) {
  if (canSeeContacts) return champion;
  return { ...champion, phone: champion.phone ? 'hidden' : null, email: champion.email ? 'hidden' : null };
}

/** One phone number may belong to only one champion in a project (it becomes their login later). */
export async function assertPhoneUnique(projectId, phone, exceptId) {
  if (!phone) return;
  const matches = await adminDatabases.listDocuments(DB_ID, CC.CHAMPIONS, [
    Query.equal('projectId', projectId),
    Query.equal('phone', phone),
    Query.limit(2),
  ]);
  if (matches.documents.some((c) => c.$id !== exceptId)) {
    throw new HttpError(409, 'Another champion already uses this phone number.', 'DUPLICATE_PHONE');
  }
}

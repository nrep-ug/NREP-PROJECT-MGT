import { NextResponse } from 'next/server';
import { adminDatabases, DB_ID, ID, Query } from '@/lib/appwriteAdmin';
import { apiErrorResponse, HttpError } from '@/lib/serverAuth';
import { requireChampionContext } from './championAccounts';
import { FieldValidationError } from './fieldDomain';
import { CC, listAll } from './service';

export { CC, HttpError, listAll };

/**
 * Wrap a champion (/api/field/*) route: verify the champion's JWT, map
 * validation errors to 400, hide internals on 500.
 */
export function fieldHandler(handler, { status = 200 } = {}) {
  return async (request, routeContext) => {
    try {
      const ctx = await requireChampionContext(request);
      const params = routeContext?.params ? await routeContext.params : {};
      const result = await handler({ request, params, ...ctx });
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result, { status: result?.duplicate ? 200 : status });
    } catch (error) {
      if (error instanceof FieldValidationError) {
        return NextResponse.json({ error: error.message, code: 'VALIDATION_ERROR' }, { status: 400 });
      }
      const response = apiErrorResponse(error);
      if (response.status >= 500) console.error('[Field API]', error);
      return NextResponse.json(response.body, { status: response.status });
    }
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.', 'INVALID_JSON');
  }
}

/** Fields every champion submission carries; identity comes from the session only. */
export function submissionStamp(champion, account) {
  return {
    projectId: champion.projectId,
    championId: champion.$id,
    district: champion.district,
    submittedBy: account.$id,
  };
}

/**
 * Create a record exactly once per clientSubmissionId (generated on the
 * phone). Re-sending the same submission — a double tap, a retry after a bad
 * connection, or later an offline sync — returns the original record.
 */
export async function createOnce(collectionId, data, champion) {
  const findExisting = async () => {
    const found = await adminDatabases.listDocuments(DB_ID, collectionId, [
      Query.equal('clientSubmissionId', data.clientSubmissionId),
      Query.limit(1),
    ]);
    return found.documents[0] || null;
  };
  const existing = await findExisting();
  if (existing) {
    if (existing.championId !== champion.$id) throw new HttpError(409, 'Duplicate submission ID.', 'DUPLICATE');
    return { record: existing, duplicate: true };
  }
  try {
    const record = await adminDatabases.createDocument(DB_ID, collectionId, ID.unique(), data);
    return { record, duplicate: false };
  } catch (error) {
    if (error?.code === 409) {
      const raced = await findExisting();
      if (raced && raced.championId === champion.$id) return { record: raced, duplicate: true };
    }
    throw error;
  }
}

/** Load one of the champion's own records, or 404 (never reveal other champions' records). */
export async function getOwn(collectionId, id, champion, label = 'Record') {
  let doc;
  try {
    doc = await adminDatabases.getDocument(DB_ID, collectionId, id);
  } catch (error) {
    if (error?.code === 404) throw new HttpError(404, `${label} not found.`, 'NOT_FOUND');
    throw error;
  }
  if (doc.championId !== champion.$id) throw new HttpError(404, `${label} not found.`, 'NOT_FOUND');
  return doc;
}

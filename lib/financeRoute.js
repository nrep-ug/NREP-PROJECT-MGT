import { NextResponse } from 'next/server';
import { apiErrorResponse, HttpError, requireAuthenticatedContext } from './serverAuth';

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.', 'INVALID_JSON');
  }
}

export async function handleFinanceRequest(request, handler, { status = 200 } = {}) {
  try {
    const context = await requireAuthenticatedContext(request);
    const result = await handler(context);
    return NextResponse.json(result, { status });
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response.status >= 500) console.error('[Finance API]', error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

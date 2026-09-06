import { NextResponse } from 'next/server';
import { getExpenditureEvidence } from '@/lib/financeService';
import { apiErrorResponse, requireAuthenticatedContext } from '@/lib/serverAuth';

export async function GET(request, { params }) {
  try {
    const context = await requireAuthenticatedContext(request);
    const { id, fileId } = await params;
    const { data, metadata } = await getExpenditureEvidence(context, id, fileId);
    const safeName = String(metadata.name || 'evidence').replace(/["\r\n]/g, '');
    return new NextResponse(data, {
      headers: {
        'Content-Type': metadata.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response.status >= 500) console.error('[Finance evidence API]', error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

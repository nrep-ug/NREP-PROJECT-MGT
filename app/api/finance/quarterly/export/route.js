import { NextResponse } from 'next/server';
import { getQuarterlyReport, quarterlyReportCsv } from '@/lib/financeService';
import { apiErrorResponse, requireAuthenticatedContext } from '@/lib/serverAuth';

export async function GET(request) {
  try {
    const context = await requireAuthenticatedContext(request);
    const { searchParams } = new URL(request.url);
    const report = await getQuarterlyReport(context, {
      projectId: searchParams.get('projectId'),
      year: searchParams.get('year'),
      quarter: searchParams.get('quarter'),
    });
    const filename = `${report.project.code || 'project'}-${report.year}-Q${report.quarter}-finance.csv`
      .replace(/[^a-zA-Z0-9._-]/g, '-');
    return new NextResponse(quarterlyReportCsv(report), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const response = apiErrorResponse(error);
    if (response.status >= 500) console.error('[Finance quarterly export API]', error);
    return NextResponse.json(response.body, { status: response.status });
  }
}


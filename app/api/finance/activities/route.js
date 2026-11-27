import { handleFinanceRequest } from '@/lib/financeRoute';
import { listProjectActivities } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, async (context) => {
    const { searchParams } = new URL(request.url);
    const activities = await listProjectActivities(context, searchParams.get('projectId'));
    return { activities, total: activities.length };
  });
}

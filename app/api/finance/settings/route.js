import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { getFinanceSettings, updateFinanceSettings } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, async (context) => {
    const { searchParams } = new URL(request.url);
    return { settings: await getFinanceSettings(context, { projectId: searchParams.get('projectId') }) };
  });
}

export async function PATCH(request) {
  return handleFinanceRequest(request, async (context) => ({
    settings: await updateFinanceSettings(context, await readJson(request)),
  }));
}

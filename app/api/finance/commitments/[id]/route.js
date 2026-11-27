import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { getCommitment, updateCommitment } from '@/lib/financeService';

export async function GET(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    return { commitment: await getCommitment(context, id) };
  });
}

export async function PATCH(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    return { commitment: await updateCommitment(context, id, await readJson(request)) };
  });
}

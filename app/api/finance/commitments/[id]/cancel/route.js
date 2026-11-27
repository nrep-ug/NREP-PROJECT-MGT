import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { cancelCommitment } from '@/lib/financeService';

export async function POST(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    const { reason, comment } = await readJson(request);
    return { commitment: await cancelCommitment(context, id, reason || comment) };
  });
}

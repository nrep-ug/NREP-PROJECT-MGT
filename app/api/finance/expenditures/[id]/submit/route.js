import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { submitExpenditure } from '@/lib/financeService';

export async function POST(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    const body = await readJson(request);
    return { expenditure: await submitExpenditure(context, id, body.evidenceMissingReason) };
  });
}


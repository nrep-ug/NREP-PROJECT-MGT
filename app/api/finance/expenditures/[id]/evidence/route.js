import { handleFinanceRequest } from '@/lib/financeRoute';
import { addExpenditureEvidence } from '@/lib/financeService';

export async function POST(request, { params }) {
  return handleFinanceRequest(request, async (context) => {
    const { id } = await params;
    const formData = await request.formData();
    return { expenditure: await addExpenditureEvidence(context, id, formData.get('file')) };
  });
}

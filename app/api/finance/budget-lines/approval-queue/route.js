import { handleFinanceRequest } from '@/lib/financeRoute';
import { getBudgetApprovalQueue } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, (context) => getBudgetApprovalQueue(context));
}

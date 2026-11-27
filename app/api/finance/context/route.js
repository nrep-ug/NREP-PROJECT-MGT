import { handleFinanceRequest } from '@/lib/financeRoute';
import { getFinanceAccessPayload } from '@/lib/financeService';

export async function GET(request) {
  return handleFinanceRequest(request, getFinanceAccessPayload);
}

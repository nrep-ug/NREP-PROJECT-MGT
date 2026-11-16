/**
 * POST { kind, id, assignedReviewerId }
 * The preparer (or a Finance administrator) sends a record that is waiting
 * for clearance to a different approver.
 */
import { handleFinanceRequest, readJson } from '@/lib/financeRoute';
import { reassignFinanceReviewer } from '@/lib/financeService';

export async function POST(request) {
  return handleFinanceRequest(request, async (context) => {
    const { kind, id, assignedReviewerId } = await readJson(request);
    return { record: await reassignFinanceReviewer(context, kind, id, assignedReviewerId) };
  });
}

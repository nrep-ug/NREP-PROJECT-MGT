/**
 * GET: market & sales figures that are not itemised company sales —
 * company-wide totals, products counted at events, EPCs distributed by NREP.
 * Returned per figure type and never added together (see marketDomain.js).
 */
import { Query } from '@/lib/appwriteAdmin';
import { CC, ccHandler, listAll } from '@/lib/cleanCooking/service';
import { FIGURE_NOTES, summarizeMarketFigures } from '@/lib/cleanCooking/marketDomain';

export const GET = ccHandler('read', async ({ params }) => {
  let figures;
  try {
    figures = await listAll(CC.MARKET_FIGURES, [Query.equal('projectId', params.projectId)]);
  } catch (error) {
    // Table not created yet → empty, with a hint for administrators.
    if (error?.code === 404) return { figures: [], summary: summarizeMarketFigures([]), notes: FIGURE_NOTES, notDeployed: true };
    throw error;
  }
  const sortKey = (f) => f.eventDate || f.periodStart || '';
  figures.sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || (a.companyName || '').localeCompare(b.companyName || ''));
  return { figures, summary: summarizeMarketFigures(figures), notes: FIGURE_NOTES };
});

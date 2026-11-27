'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/apiClient';

const base = (projectId) => `/api/clean-cooking/${encodeURIComponent(projectId)}`;

export const cleanCookingKeys = {
  all: (projectId) => ['clean-cooking', projectId],
  status: (projectId) => ['clean-cooking', projectId, 'status'],
  summary: (projectId) => ['clean-cooking', projectId, 'summary'],
  companies: (projectId) => ['clean-cooking', projectId, 'companies'],
  sales: (projectId) => ['clean-cooking', projectId, 'sales'],
  champions: (projectId) => ['clean-cooking', projectId, 'champions'],
  districts: (projectId) => ['clean-cooking', projectId, 'districts'],
  hubs: (projectId) => ['clean-cooking', projectId, 'hubs'],
  marketFigures: (projectId) => ['clean-cooking', projectId, 'market-figures'],
};

async function request(url, options = {}) {
  const response = await authenticatedFetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  let data = {};
  try { data = await response.json(); } catch { /* empty body */ }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

/** Module status + caller permissions. 403/404 resolve to "not available" instead of erroring. */
export function useCleanCookingStatus(projectId) {
  return useQuery({
    queryKey: cleanCookingKeys.status(projectId),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      try {
        return await request(base(projectId));
      } catch (error) {
        if (error.status === 403 || error.status === 404) return { enabled: false, access: null, unavailable: true };
        throw error;
      }
    },
  });
}

function useList(key, url, select) {
  return useQuery({ queryKey: key, queryFn: () => request(url), select, staleTime: 30_000 });
}

export const useCleanCookingSummary = (projectId) =>
  useList(cleanCookingKeys.summary(projectId), `${base(projectId)}/summary`);
export const useCleanCookingCompanies = (projectId) =>
  useList(cleanCookingKeys.companies(projectId), `${base(projectId)}/companies`, (d) => d.companies);
export const useCleanCookingSales = (projectId) =>
  useList(cleanCookingKeys.sales(projectId), `${base(projectId)}/sales`, (d) => d.sales);
export const useCleanCookingChampions = (projectId) =>
  useList(cleanCookingKeys.champions(projectId), `${base(projectId)}/champions`, (d) => d.champions);
export const useCleanCookingFieldReports = (projectId) =>
  useList([...cleanCookingKeys.all(projectId), 'field-reports'], `${base(projectId)}/field-reports`);
/** Hubs + headline indicators: { hubs, summary }. */
export const useCleanCookingHubs = (projectId) =>
  useList(cleanCookingKeys.hubs(projectId), `${base(projectId)}/hubs`);
/** Market & sales figures: { figures, summary, notes, notDeployed }. */
export const useCleanCookingMarketFigures = (projectId) =>
  useList(cleanCookingKeys.marketFigures(projectId), `${base(projectId)}/market-figures`);
export const useCleanCookingDistricts = (projectId) =>
  useList(cleanCookingKeys.districts(projectId), `${base(projectId)}/districts`, (d) => d.districts);

/**
 * Generic mutation for Clean Cooking resources. Invalidates every Clean
 * Cooking query for the project on success so totals stay consistent.
 * Call as mutate({ path: '/companies', method: 'POST', body }).
 */
export function useCleanCookingMutation(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path = '', method = 'POST', body }) => request(`${base(projectId)}${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    onSuccess: (_data, variables) => {
      if (variables?.skipInvalidate) return;
      queryClient.invalidateQueries({ queryKey: cleanCookingKeys.all(projectId) });
    },
  });
}

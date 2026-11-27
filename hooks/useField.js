'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/apiClient';

/** Champion portal data hooks (/api/field/*). */

async function request(url, options = {}) {
  let response;
  try {
    response = await authenticatedFetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch {
    const error = new Error('No connection. Your form is saved on this phone — try again when you have signal.');
    error.offline = true;
    throw error;
  }
  let data = {};
  try { data = await response.json(); } catch { /* empty */ }
  if (!response.ok) {
    const error = new Error(data.error || `Something went wrong (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

const RESILIENT = {
  retry: 3,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  staleTime: 30_000,
};

export const fieldKeys = {
  all: ['field'],
  summary: ['field', 'summary'],
  leads: ['field', 'leads'],
  sales: ['field', 'sales'],
  followups: ['field', 'followups'],
};

export const useFieldSummary = () => useQuery({ queryKey: fieldKeys.summary, queryFn: () => request('/api/field/summary'), ...RESILIENT });
export const useFieldLeads = () => useQuery({ queryKey: fieldKeys.leads, queryFn: () => request('/api/field/leads'), select: (d) => d.leads, ...RESILIENT });
export const useFieldSales = () => useQuery({ queryKey: fieldKeys.sales, queryFn: () => request('/api/field/sales'), select: (d) => d.sales, ...RESILIENT });
export const useFieldFollowups = () => useQuery({ queryKey: fieldKeys.followups, queryFn: () => request('/api/field/followups'), ...RESILIENT });

/** mutate({ path: '/leads', method: 'POST', body }) */
export function useFieldMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method = 'POST', body }) => request(`/api/field${path}`, { method, body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fieldKeys.all }),
  });
}

export function newSubmissionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // RFC4122 v4 fallback for older browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Form state that survives a reload, a dropped connection or closing the
 * browser: kept in this phone's storage until submitted. The submission ID is
 * created once per draft, so re-sending after a timeout never duplicates.
 */
export function useDraft(key, initial) {
  const storageKey = `nrep-field-draft:${key}`;
  const initialRef = useRef(initial);
  const [value, setValue] = useState(() => ({ ...initial, clientSubmissionId: newSubmissionId() }));
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setValue({ ...initialRef.current, ...parsed });
        setRestored(true);
      }
    } catch { /* storage unavailable — fine */ }
  }, [storageKey]);

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* ignore */ }
  }, [storageKey, value]);

  const clear = useCallback(() => {
    try { window.localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setValue({ ...initialRef.current, clientSubmissionId: newSubmissionId() });
    setRestored(false);
  }, [storageKey]);

  const update = useCallback((patch) => setValue((v) => ({ ...v, ...patch })), []);
  return { value, update, clear, restored };
}

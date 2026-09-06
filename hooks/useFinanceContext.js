'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { authenticatedFetch } from '@/lib/apiClient';

export function useFinanceContext() {
  const { user, loading: authLoading } = useAuth();
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/finance/context');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Finance access could not be loaded.');
      setFinance(data);
    } catch (requestError) {
      setFinance(null);
      setError(requestError.message || 'Finance access could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) refresh();
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, refresh]);

  return { user, finance, loading: authLoading || loading, error, refresh };
}

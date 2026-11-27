'use client';

import { useQuery } from '@tanstack/react-query';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';
import { getWeekStart } from '@/lib/date';

/**
 * Dashboard data, one query per section so a slow or failed request only
 * affects its own card. The Appwrite server is occasionally slow to answer,
 * so every query retries with back-off before reporting an error.
 */
const RESILIENT = {
  retry: 3,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  staleTime: 60_000,
  refetchOnWindowFocus: false,
};

const userIdOf = (user) => user?.accountId || user?.authUser?.$id;
const orgScope = (user) => (user?.organizationId ? [Query.equal('organizationId', user.organizationId)] : []);

export function useDashboardStats(user) {
  return useQuery({
    queryKey: ['dashboard', 'stats', userIdOf(user), user?.isAdmin, user?.isSupervisor],
    enabled: Boolean(user),
    ...RESILIENT,
    queryFn: async () => {
      const scope = orgScope(user);
      const count = (collection, queries) => databases
        .listDocuments(DB_ID, collection, [...queries, Query.limit(1)])
        .then((res) => res.total);

      const [totalProjects, activeProjects, completedProjects, openActivities] = await Promise.all([
        count(COLLECTIONS.PROJECTS, scope),
        count(COLLECTIONS.PROJECTS, [...scope, Query.equal('status', 'active')]),
        count(COLLECTIONS.PROJECTS, [...scope, Query.equal('status', 'completed')]),
        count(COLLECTIONS.MILESTONES, [Query.equal('status', 'open')]),
      ]);
      const stats = { totalProjects, activeProjects, completedProjects, openActivities };

      if (user.isAdmin) stats.totalUsers = await count(COLLECTIONS.USERS, scope);
      if (user.isSupervisor) stats.teamSize = await count(COLLECTIONS.USERS, [Query.equal('supervisorId', userIdOf(user))]);
      return stats;
    },
  });
}

export function useRecentProjects(user) {
  return useQuery({
    queryKey: ['dashboard', 'recent-projects', user?.organizationId],
    enabled: Boolean(user),
    ...RESILIENT,
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.PROJECTS, [
        ...orgScope(user),
        Query.orderDesc('$createdAt'),
        Query.limit(5),
      ]);
      return res.documents;
    },
  });
}

export function useUpcomingActivities(user) {
  return useQuery({
    queryKey: ['dashboard', 'activities', user?.organizationId],
    enabled: Boolean(user),
    ...RESILIENT,
    queryFn: async () => {
      const res = await databases.listDocuments(DB_ID, COLLECTIONS.MILESTONES, [
        Query.equal('status', 'open'),
        Query.orderAsc('dueDate'),
        Query.limit(5),
      ]);
      return res.documents;
    },
  });
}

/** Staff only: open tasks assigned to me + hours logged this week. */
export function useMyWork(user) {
  const userId = userIdOf(user);
  return useQuery({
    queryKey: ['dashboard', 'my-work', userId],
    enabled: Boolean(user) && !user?.isAdmin && !user?.isSupervisor,
    ...RESILIENT,
    queryFn: async () => {
      const tasksRes = await databases.listDocuments(DB_ID, COLLECTIONS.TASKS, [
        Query.contains('assignedTo', userId),
        Query.notEqual('status', 'done'),
        Query.limit(100),
      ]);
      const due = (t) => {
        const ts = t.dueDate ? new Date(t.dueDate).getTime() : NaN;
        return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
      };
      const tasks = [...tasksRes.documents].sort((a, b) => due(a) - due(b));

      let weeklyHours = null;
      try {
        const sheets = await databases.listDocuments(DB_ID, COLLECTIONS.TIMESHEETS, [
          Query.equal('accountId', userId),
          Query.equal('weekStart', getWeekStart(new Date())),
          Query.limit(1),
        ]);
        const sheet = sheets.documents[0];
        if (!sheet) {
          weeklyHours = 0;
        } else {
          const entries = await databases.listDocuments(DB_ID, COLLECTIONS.TIMESHEET_ENTRIES, [
            Query.equal('timesheetId', sheet.$id),
            Query.limit(500),
          ]);
          weeklyHours = entries.documents.reduce((sum, e) => {
            const h = Number(e.hours);
            return Number.isFinite(h) ? sum + h : sum;
          }, 0);
        }
      } catch (error) {
        console.error('Dashboard weekly hours load error:', error);
      }

      return { openTaskCount: tasksRes.total, tasks: tasks.slice(0, 5), weeklyHours };
    },
  });
}

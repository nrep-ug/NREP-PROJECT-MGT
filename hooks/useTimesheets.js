import { useQuery } from '@tanstack/react-query';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';

export const timesheetKeys = {
    all: ['timesheets'],
    lists: () => [...timesheetKeys.all, 'list'],
    list: (filters) => [...timesheetKeys.lists(), { ...filters }],
    details: () => [...timesheetKeys.all, 'detail'],
    detail: (id) => [...timesheetKeys.details(), id],
};

export function useTimesheets(organizationId, filters = []) {
    return useQuery({
        queryKey: timesheetKeys.list({ organizationId, ...filters }),
        queryFn: async () => {
            if (!organizationId) return [];
            const queries = [
                Query.equal('organizationId', organizationId),
                Query.orderDesc('weekStartDate'),
                ...filters
            ];
            const response = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.TIMESHEETS,
                queries
            );
            return response.documents;
        },
        enabled: !!organizationId,
    });
}

export function useTimesheet(timesheetId) {
    return useQuery({
        queryKey: timesheetKeys.detail(timesheetId),
        queryFn: async () => {
            return await databases.getDocument(
                DB_ID,
                COLLECTIONS.TIMESHEETS,
                timesheetId
            );
        },
        enabled: !!timesheetId,
    });
}

export function useTimesheetDashboard(accountId, organizationId) {
    return useQuery({
        queryKey: ['timesheets', 'dashboard', accountId, organizationId],
        queryFn: async () => {
            const response = await fetch(`/api/timesheets/dashboard?accountId=${accountId}&organizationId=${organizationId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load dashboard data');
            }
            return response.json();
        },
        enabled: !!accountId && !!organizationId,
    });
}

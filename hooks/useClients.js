import { useQuery } from '@tanstack/react-query';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';

export const clientKeys = {
    all: ['clients'],
    lists: () => [...clientKeys.all, 'list'],
    list: (filters) => [...clientKeys.lists(), { ...filters }],
    details: () => [...clientKeys.all, 'detail'],
    detail: (id) => [...clientKeys.details(), id],
};

export function useClients(organizationId) {
    return useQuery({
        queryKey: clientKeys.list({ organizationId }),
        queryFn: async () => {
            if (!organizationId) return [];

            const response = await fetch(`/api/clients?organizationId=${organizationId}`);

            if (!response.ok) {
                throw new Error('Failed to fetch clients');
            }

            const data = await response.json();
            return data.clients || [];
        },
        enabled: !!organizationId,
    });
}

export function useClient(clientId) {
    return useQuery({
        queryKey: clientKeys.detail(clientId),
        queryFn: async () => {
            return await databases.getDocument(
                DB_ID,
                COLLECTIONS.CLIENTS,
                clientId
            );
        },
        enabled: !!clientId,
    });
}

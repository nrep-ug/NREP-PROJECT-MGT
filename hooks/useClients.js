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
            const response = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.CLIENTS,
                [
                    Query.equal('organizationId', organizationId),
                    Query.orderAsc('name')
                ]
            );
            return response.documents;
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

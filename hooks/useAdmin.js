import { useQuery } from '@tanstack/react-query';
import { databases, Query, COLLECTIONS, DB_ID, account } from '@/lib/appwriteClient';

export const adminKeys = {
    users: ['users'],
    usersList: (filters) => [...adminKeys.users, 'list', { ...filters }],
    organization: ['organization'],
    orgDetail: (id) => [...adminKeys.organization, id],
};

export function useUsers(organizationId, options = {}) {
    const {
        page = 1,
        limit = 25,
        search = '',
        roleFilter = '',
        statusFilter = '',
        userTypeFilter = '',
    } = options;

    return useQuery({
        queryKey: adminKeys.usersList({ organizationId, page, limit, search, roleFilter, statusFilter, userTypeFilter }),
        queryFn: async () => {
            if (!organizationId) return { users: [], total: 0 };

            // Build query filters
            const queries = [
                Query.limit(limit),
                Query.offset((page - 1) * limit),
                Query.orderAsc('firstName')
            ];

            // Add search filter if provided
            if (search) {
                queries.push(Query.search('firstName', search));
            }

            // Add role filter if provided
            if (roleFilter) {
                queries.push(Query.equal('roles', roleFilter));
            }

            // Add status filter if provided
            if (statusFilter) {
                queries.push(Query.equal('status', statusFilter));
            }

            // Add user type filter if provided
            if (userTypeFilter) {
                queries.push(Query.equal('userType', userTypeFilter));
            }

            // Fetch users from the users collection
            const response = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.USERS,
                queries
            );

            return {
                users: response.documents,
                total: response.total,
                page,
                limit,
                totalPages: Math.ceil(response.total / limit),
            };
        },
        enabled: !!organizationId,
        staleTime: 30000, // Consider data fresh for 30 seconds
    });
}

export function useOrganization(organizationId) {
    return useQuery({
        queryKey: adminKeys.orgDetail(organizationId),
        queryFn: async () => {
            return await databases.getDocument(
                DB_ID,
                COLLECTIONS.ORGANIZATIONS,
                organizationId
            );
        },
        enabled: !!organizationId,
    });
}

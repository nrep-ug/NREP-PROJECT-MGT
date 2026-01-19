import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { databases, Query, COLLECTIONS, DB_ID } from '@/lib/appwriteClient';

// Keys
export const projectKeys = {
    all: ['projects'],
    lists: () => [...projectKeys.all, 'list'],
    list: (filters) => [...projectKeys.lists(), { ...filters }],
    details: () => [...projectKeys.all, 'detail'],
    detail: (id) => [...projectKeys.details(), id],
    tasks: (projectId) => [...projectKeys.detail(projectId), 'tasks'],
    milestones: (projectId) => [...projectKeys.detail(projectId), 'milestones'],
    documents: (projectId) => [...projectKeys.detail(projectId), 'documents'],
    embeds: (projectId) => [...projectKeys.detail(projectId), 'embeds'],
    team: (projectId) => [...projectKeys.detail(projectId), 'team'],
    components: (projectId) => [...projectKeys.detail(projectId), 'components'],
};

// --- Projects ---

export function useProjects(organizationId) {
    return useQuery({
        queryKey: projectKeys.list({ organizationId }),
        queryFn: async () => {
            if (!organizationId) return [];
            // We use the API route for projects to ensure proper permissions/filtering if needed,
            // but for read-heavy operations, direct Appwrite SDK is often faster if permissions allow.
            // However, the existing code used /api/projects. Let's stick to that for consistency
            // or switch to direct SDK if we want to avoid the API hop.
            // Given the hybrid architecture described, reading is often done via SDK if safe.
            // But the previous code used fetch('/api/projects').
            // Let's use the SDK directly for better performance if possible, but
            // if the API route does extra logic, we should use it.
            // The API route just does listDocuments. Let's use SDK directly for "staff" reads.

            const response = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.PROJECTS,
                [
                    Query.equal('organizationId', organizationId),
                    Query.orderDesc('$createdAt')
                ]
            );
            return response.documents;
        },
        enabled: !!organizationId,
    });
}

export function useProject(projectId) {
    return useQuery({
        queryKey: projectKeys.detail(projectId),
        queryFn: async () => {
            return await databases.getDocument(
                DB_ID,
                COLLECTIONS.PROJECTS,
                projectId
            );
        },
        enabled: !!projectId,
    });
}

// --- Sub-resources ---

export function useProjectTasks(projectId, filters = []) {
    return useQuery({
        queryKey: [...projectKeys.tasks(projectId), { ...filters }],
        queryFn: async () => {
            const queries = [
                Query.equal('projectId', projectId),
                Query.orderDesc('$createdAt'),
                Query.limit(100),
                ...filters
            ];
            const response = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.TASKS,
                queries
            );
            return response.documents;
        },
        enabled: !!projectId,
    });
}

export function useProjectMilestones(projectId) {
    return useQuery({
        queryKey: projectKeys.milestones(projectId),
        queryFn: async () => {
            const response = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.MILESTONES,
                [
                    Query.equal('projectId', projectId),
                    Query.orderAsc('dueDate')
                ]
            );
            return response.documents;
        },
        enabled: !!projectId,
    });
}

export function useProjectDocuments(projectId) {
    return useQuery({
        queryKey: projectKeys.documents(projectId),
        queryFn: async () => {
            // Note: This assumes a 'documents' collection exists as per previous code
            // The previous code used /api/documents which might be doing something specific.
            // Let's check the API route logic later if this fails, but usually it's a collection list.
            // Actually, looking at the file structure, there is a documents collection.
            const response = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.DOCUMENTS,
                [
                    Query.equal('projectId', projectId),
                    Query.orderDesc('$createdAt')
                ]
            );
            return response.documents;
        },
        enabled: !!projectId,
    });
}

export function useProjectEmbeds(projectId) {
    return useQuery({
        queryKey: projectKeys.embeds(projectId),
        queryFn: async () => {
            const response = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.EMBEDS,
                [
                    Query.equal('projectId', projectId),
                    Query.orderDesc('$createdAt')
                ]
            );
            return response.documents;
        },
        enabled: !!projectId,
    });
}

export function useProjectMembers(projectId) {
    return useQuery({
        queryKey: projectKeys.team(projectId),
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}/members`);
            if (!response.ok) {
                throw new Error('Failed to fetch project members');
            }
            const data = await response.json();
            return data.members || [];
        },
        enabled: !!projectId,
    });
}

export function useProjectComponents(projectId) {
    return useQuery({
        queryKey: projectKeys.components(projectId),
        queryFn: async () => {
            const response = await databases.listDocuments(
                DB_ID,
                COLLECTIONS.PROJECT_COMPONENTS,
                [
                    Query.equal('projectId', projectId),
                    Query.orderDesc('$createdAt')
                ]
            );
            return response.documents;
        },
        enabled: !!projectId,
    });
}

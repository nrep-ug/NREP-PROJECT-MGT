import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * React Query hook for fetching and managing project roles from the DB.
 *
 * Usage:
 *   const { data: roles, isLoading } = useProjectRoles(projectId, requesterId);
 *   const createRole = useCreateProjectRole(projectId);
 *   const updateRole = useUpdateProjectRole(projectId);
 *   const deleteRole = useDeleteProjectRole(projectId);
 */

export const roleKeys = {
  all: ['projectRoles'],
  list: (projectId) => [...roleKeys.all, projectId],
};

/**
 * Fetch all roles for a project
 */
export function useProjectRoles(projectId, requesterId) {
  return useQuery({
    queryKey: roleKeys.list(projectId),
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/roles?requesterId=${requesterId}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch project roles');
      }
      const data = await response.json();
      return data.roles || [];
    },
    enabled: !!projectId && !!requesterId,
    staleTime: 5 * 60 * 1000, // 5 minutes — roles don't change often
  });
}

/**
 * Create a new role
 */
export function useCreateProjectRole(projectId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleData) => {
      const response = await fetch(`/api/projects/${projectId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.list(projectId) });
    },
  });
}

/**
 * Update an existing role
 */
export function useUpdateProjectRole(projectId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roleId, ...updateData }) => {
      const response = await fetch(`/api/projects/${projectId}/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.list(projectId) });
    },
  });
}

/**
 * Delete a role
 */
export function useDeleteProjectRole(projectId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roleId, requesterId }) => {
      const response = await fetch(
        `/api/projects/${projectId}/roles/${roleId}?requesterId=${requesterId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.list(projectId) });
    },
  });
}

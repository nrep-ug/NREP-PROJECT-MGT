/**
 * Project Team Roles Constants & Default Templates
 *
 * These roles are assigned at the project team level (not organization-wide).
 * They define what a user can do within a specific project.
 *
 * Default roles serve as templates that are seeded into the pms_project_roles
 * collection when a new project is created. Admins/managers can then customize
 * these roles or create new ones per-project.
 *
 * Note: These are different from organization-level labels (admin, staff, client)
 */

/**
 * All available permission keys, grouped by category.
 * Used in the UI for permission checkboxes.
 */
export const PERMISSION_CATEGORIES = {
  Project: ['project.view', 'project.update', 'project.delete'],
  Team: ['team.manage'],
  Tasks: [
    'task.view', 'task.create', 'task.update', 'task.delete',
    'task.assign', 'task.update_assigned', 'task.review', 'task.test',
  ],
  Timesheets: ['timesheet.create', 'timesheet.update_own', 'timesheet.review', 'timesheet.approve'],
  Documents: ['document.view', 'document.upload', 'document.manage'],
  Budget: ['budget.manage'],
  Issues: ['issue.create'],
  Reports: ['report.view'],
};

/**
 * Flat list of all permission keys
 */
export const ALL_PERMISSIONS = Object.values(PERMISSION_CATEGORIES).flat();

/**
 * Project team role slug constants (for code references)
 */
export const PROJECT_ROLES = {
  MANAGER: 'manager',
  LEAD: 'lead',
  DEVELOPER: 'developer',
  DESIGNER: 'designer',
  QA: 'qa',
  MEMBER: 'member',
  CLIENT_REP: 'client_rep',
};

/**
 * Default role templates — seeded into pms_project_roles on project creation.
 * Each template produces one document in the collection.
 */
export const DEFAULT_ROLE_TEMPLATES = [
  {
    slug: PROJECT_ROLES.MANAGER,
    name: 'Project Manager',
    description: 'Can manage project settings, team members, and approve work',
    color: '#0d6efd',
    permissions: [
      'project.update', 'project.delete', 'team.manage',
      'task.create', 'task.update', 'task.delete', 'task.assign',
      'timesheet.approve', 'budget.manage',
    ],
    priority: 100,
    isDefault: true,
    isStaffRole: true,
  },
  {
    slug: PROJECT_ROLES.LEAD,
    name: 'Team Lead',
    description: 'Can assign tasks, review work, and coordinate team members',
    color: '#0dcaf0',
    permissions: [
      'task.create', 'task.update', 'task.assign', 'task.review',
      'timesheet.review',
    ],
    priority: 80,
    isDefault: true,
    isStaffRole: true,
  },
  {
    slug: PROJECT_ROLES.DEVELOPER,
    name: 'Developer',
    description: 'Can work on development tasks and log time',
    color: '#198754',
    permissions: [
      'task.view', 'task.update_assigned',
      'timesheet.create', 'timesheet.update_own',
    ],
    priority: 60,
    isDefault: true,
    isStaffRole: true,
  },
  {
    slug: PROJECT_ROLES.DESIGNER,
    name: 'Designer',
    description: 'Can work on design tasks and log time',
    color: '#ffc107',
    permissions: [
      'task.view', 'task.update_assigned',
      'timesheet.create', 'timesheet.update_own',
    ],
    priority: 60,
    isDefault: true,
    isStaffRole: true,
  },
  {
    slug: PROJECT_ROLES.QA,
    name: 'QA / Tester',
    description: 'Can test, report issues, and log time',
    color: '#6c757d',
    permissions: [
      'task.view', 'task.update_assigned', 'task.test',
      'issue.create', 'timesheet.create', 'timesheet.update_own',
    ],
    priority: 60,
    isDefault: true,
    isStaffRole: true,
  },
  {
    slug: PROJECT_ROLES.MEMBER,
    name: 'Team Member',
    description: 'General team member with basic project access',
    color: '#343a40',
    permissions: [
      'task.view', 'task.update_assigned',
      'timesheet.create', 'timesheet.update_own',
    ],
    priority: 40,
    isDefault: true,
    isStaffRole: true,
  },
  {
    slug: PROJECT_ROLES.CLIENT_REP,
    name: 'Client Representative',
    description: 'Can view project progress, tasks, and reports',
    color: '#6f42c1',
    permissions: [
      'project.view', 'task.view', 'report.view', 'document.view',
    ],
    priority: 20,
    isDefault: true,
    isStaffRole: false,
  },
];

// -------------------------------------------------------------------
// Helper functions — accept optional dynamic roles array for backward
// compatibility. If no dynamic roles are provided, fall back to the
// hardcoded metadata below.
// -------------------------------------------------------------------

/**
 * Legacy metadata map (for backward compatibility when dynamic roles aren't loaded yet)
 */
const LEGACY_ROLE_METADATA = {};
DEFAULT_ROLE_TEMPLATES.forEach(t => {
  LEGACY_ROLE_METADATA[t.slug] = {
    name: t.name,
    description: t.description,
    color: t.color,
    permissions: t.permissions,
    priority: t.priority,
  };
});

// Re-export as PROJECT_ROLE_METADATA for backward compat
export const PROJECT_ROLE_METADATA = LEGACY_ROLE_METADATA;

/**
 * Get role display name — uses dynamic roles if provided, else legacy lookup
 */
export function getRoleName(roleId, dynamicRoles) {
  if (dynamicRoles) {
    const found = dynamicRoles.find(r => r.slug === roleId);
    if (found) return found.name;
  }
  return LEGACY_ROLE_METADATA[roleId]?.name || roleId;
}

/**
 * Get role color — hex color for dynamic, bootstrap variant name for legacy badge
 */
export function getRoleColor(roleId, dynamicRoles) {
  if (dynamicRoles) {
    const found = dynamicRoles.find(r => r.slug === roleId);
    if (found) return found.color;
  }
  return LEGACY_ROLE_METADATA[roleId]?.color || '#6c757d';
}

/**
 * Get role metadata by role ID (legacy)
 */
export function getRoleMetadata(roleId) {
  return LEGACY_ROLE_METADATA[roleId] || null;
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(roleId, permission, dynamicRoles) {
  if (dynamicRoles) {
    const found = dynamicRoles.find(r => r.slug === roleId);
    return found ? found.permissions?.includes(permission) : false;
  }
  const metadata = LEGACY_ROLE_METADATA[roleId];
  return metadata ? metadata.permissions.includes(permission) : false;
}

/**
 * Check if any of the user's roles has a specific permission
 */
export function hasAnyPermission(roles, permission, dynamicRoles) {
  if (!Array.isArray(roles)) return false;
  return roles.some(roleId => hasPermission(roleId, permission, dynamicRoles));
}

/**
 * Get the highest priority role from an array of roles
 */
export function getHighestRole(roles, dynamicRoles) {
  if (!Array.isArray(roles) || roles.length === 0) return null;

  return roles.reduce((highest, current) => {
    const getPriority = (slug) => {
      if (dynamicRoles) {
        const found = dynamicRoles.find(r => r.slug === slug);
        return found?.priority ?? 0;
      }
      return LEGACY_ROLE_METADATA[slug]?.priority ?? 0;
    };
    return getPriority(current) > getPriority(highest) ? current : highest;
  }, roles[0]);
}

/**
 * Get all available project roles as options for select dropdowns.
 * If dynamicRoles are provided (from the DB), use those.
 * Otherwise fall back to templates.
 */
export function getProjectRoleOptions(dynamicRoles) {
  if (dynamicRoles && dynamicRoles.length > 0) {
    return dynamicRoles.map(role => ({
      value: role.slug,
      label: role.name,
      description: role.description,
      color: role.color,
    }));
  }
  return DEFAULT_ROLE_TEMPLATES.map(t => ({
    value: t.slug,
    label: t.name,
    description: t.description,
    color: t.color,
  }));
}

/**
 * Staff roles that can be assigned to organization employees
 * (excludes client_rep which is only for client users)
 */
export const STAFF_PROJECT_ROLES = [
  PROJECT_ROLES.MANAGER,
  PROJECT_ROLES.LEAD,
  PROJECT_ROLES.DEVELOPER,
  PROJECT_ROLES.DESIGNER,
  PROJECT_ROLES.QA,
  PROJECT_ROLES.MEMBER,
];

/**
 * Get staff role options (excludes client_rep).
 * If dynamicRoles are provided, filters to isStaffRole === true.
 */
export function getStaffRoleOptions(dynamicRoles) {
  if (dynamicRoles && dynamicRoles.length > 0) {
    return dynamicRoles
      .filter(role => role.isStaffRole !== false)
      .map(role => ({
        value: role.slug,
        label: role.name,
        description: role.description,
        color: role.color,
      }));
  }
  return DEFAULT_ROLE_TEMPLATES
    .filter(t => t.isStaffRole)
    .map(t => ({
      value: t.slug,
      label: t.name,
      description: t.description,
      color: t.color,
    }));
}

/**
 * Generate default role documents ready for DB insertion.
 * Used during project creation and migration.
 */
export function getDefaultRoleDocuments(projectId, createdBy) {
  return DEFAULT_ROLE_TEMPLATES.map(template => ({
    projectId,
    slug: template.slug,
    name: template.name,
    description: template.description,
    color: template.color,
    permissions: template.permissions,
    priority: template.priority,
    isDefault: template.isDefault,
    isStaffRole: template.isStaffRole,
    createdBy: createdBy || null,
  }));
}

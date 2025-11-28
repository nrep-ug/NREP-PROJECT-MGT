/**
 * Project Team Roles Constants
 *
 * These roles are assigned at the project team level (not organization-wide).
 * They define what a user can do within a specific project.
 *
 * Note: These are different from organization-level labels (admin, staff, client)
 */

/**
 * Project team role definitions
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
 * Role metadata with display names, descriptions, and permissions
 */
export const PROJECT_ROLE_METADATA = {
  [PROJECT_ROLES.MANAGER]: {
    name: 'Project Manager',
    description: 'Can manage project settings, team members, and approve work',
    color: 'primary',
    permissions: [
      'project.update',
      'project.delete',
      'team.manage',
      'task.create',
      'task.update',
      'task.delete',
      'task.assign',
      'timesheet.approve',
      'budget.manage',
    ],
    priority: 100, // Highest
  },

  [PROJECT_ROLES.LEAD]: {
    name: 'Team Lead',
    description: 'Can assign tasks, review work, and coordinate team members',
    color: 'info',
    permissions: [
      'task.create',
      'task.update',
      'task.assign',
      'task.review',
      'timesheet.review',
    ],
    priority: 80,
  },

  [PROJECT_ROLES.DEVELOPER]: {
    name: 'Developer',
    description: 'Can work on development tasks and log time',
    color: 'success',
    permissions: [
      'task.view',
      'task.update_assigned',
      'timesheet.create',
      'timesheet.update_own',
    ],
    priority: 60,
  },

  [PROJECT_ROLES.DESIGNER]: {
    name: 'Designer',
    description: 'Can work on design tasks and log time',
    color: 'warning',
    permissions: [
      'task.view',
      'task.update_assigned',
      'timesheet.create',
      'timesheet.update_own',
    ],
    priority: 60,
  },

  [PROJECT_ROLES.QA]: {
    name: 'QA / Tester',
    description: 'Can test, report issues, and log time',
    color: 'secondary',
    permissions: [
      'task.view',
      'task.update_assigned',
      'task.test',
      'issue.create',
      'timesheet.create',
      'timesheet.update_own',
    ],
    priority: 60,
  },

  [PROJECT_ROLES.MEMBER]: {
    name: 'Team Member',
    description: 'General team member with basic project access',
    color: 'dark',
    permissions: [
      'task.view',
      'task.update_assigned',
      'timesheet.create',
      'timesheet.update_own',
    ],
    priority: 40,
  },

  [PROJECT_ROLES.CLIENT_REP]: {
    name: 'Client Representative',
    description: 'Can view project progress, tasks, and reports',
    color: 'info',
    permissions: [
      'project.view',
      'task.view',
      'report.view',
      'document.view',
    ],
    priority: 20,
  },
};

/**
 * Get role metadata by role ID
 * @param {string} roleId - The role identifier
 * @returns {Object|null} Role metadata or null if not found
 */
export function getRoleMetadata(roleId) {
  return PROJECT_ROLE_METADATA[roleId] || null;
}

/**
 * Get role display name
 * @param {string} roleId - The role identifier
 * @returns {string} Display name or the roleId if not found
 */
export function getRoleName(roleId) {
  const metadata = getRoleMetadata(roleId);
  return metadata ? metadata.name : roleId;
}

/**
 * Get role color/badge variant
 * @param {string} roleId - The role identifier
 * @returns {string} Bootstrap color variant
 */
export function getRoleColor(roleId) {
  const metadata = getRoleMetadata(roleId);
  return metadata ? metadata.color : 'secondary';
}

/**
 * Check if a role has a specific permission
 * @param {string} roleId - The role identifier
 * @param {string} permission - The permission to check
 * @returns {boolean} True if role has the permission
 */
export function hasPermission(roleId, permission) {
  const metadata = getRoleMetadata(roleId);
  return metadata ? metadata.permissions.includes(permission) : false;
}

/**
 * Check if any of the user's roles has a specific permission
 * @param {string[]} roles - Array of role identifiers
 * @param {string} permission - The permission to check
 * @returns {boolean} True if any role has the permission
 */
export function hasAnyPermission(roles, permission) {
  if (!Array.isArray(roles)) return false;
  return roles.some(roleId => hasPermission(roleId, permission));
}

/**
 * Get the highest priority role from an array of roles
 * @param {string[]} roles - Array of role identifiers
 * @returns {string|null} The highest priority role or null
 */
export function getHighestRole(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return null;

  return roles.reduce((highest, current) => {
    const currentMeta = getRoleMetadata(current);
    const highestMeta = getRoleMetadata(highest);

    if (!currentMeta) return highest;
    if (!highestMeta) return current;

    return currentMeta.priority > highestMeta.priority ? current : highest;
  }, roles[0]);
}

/**
 * Get all available project roles as options for select dropdowns
 * @returns {Array} Array of {value, label, description} objects
 */
export function getProjectRoleOptions() {
  return Object.entries(PROJECT_ROLE_METADATA).map(([value, metadata]) => ({
    value,
    label: metadata.name,
    description: metadata.description,
    color: metadata.color,
  }));
}

/**
 * Staff roles that can be assigned to organization employees
 * (excludes CLIENT_REP which is only for client users)
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
 * Get staff role options (excludes client_rep)
 * @returns {Array} Array of role options for staff members
 */
export function getStaffRoleOptions() {
  return getProjectRoleOptions().filter(option =>
    STAFF_PROJECT_ROLES.includes(option.value)
  );
}

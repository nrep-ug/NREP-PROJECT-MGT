/**
 * RBAC utilities for permission checking using Appwrite labels
 *
 * Architecture:
 * - Labels: Used for organization-wide roles (admin, manager, staff, client)
 * - Teams: Used for organization membership and project teams
 */

/**
 * Organization roles (stored as user labels)
 */
export const OrgRoles = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  CLIENT: 'client',
};

/**
 * Project team roles
 */
export const ProjectRoles = {
  OWNER: 'owner',
  MANAGER: 'manager',
  CONTRIBUTOR: 'contributor',
  VIEWER: 'viewer',
  CLIENT_REP: 'client_rep',
};

/**
 * Check if user has admin label
 * @param {Array<string>} labels - User's labels
 * @returns {boolean}
 */
export function isOrgAdmin(labels) {
  if (!labels || !Array.isArray(labels)) return false;
  return labels.includes(OrgRoles.ADMIN);
}

/**
 * Check if user has manager or admin label
 * @param {Array<string>} labels - User's labels
 * @returns {boolean}
 */
export function isOrgManager(labels) {
  if (!labels || !Array.isArray(labels)) return false;
  return labels.includes(OrgRoles.MANAGER) || labels.includes(OrgRoles.ADMIN);
}

/**
 * Check if user has staff label (includes admin and manager)
 * @param {Array<string>} labels - User's labels
 * @returns {boolean}
 */
export function isStaff(labels) {
  if (!labels || !Array.isArray(labels)) return false;
  return labels.includes(OrgRoles.STAFF) ||
         labels.includes(OrgRoles.MANAGER) ||
         labels.includes(OrgRoles.ADMIN);
}

/**
 * Check if user has client label
 * @param {Array<string>} labels - User's labels
 * @returns {boolean}
 */
export function isClient(labels) {
  if (!labels || !Array.isArray(labels)) return false;
  return labels.includes(OrgRoles.CLIENT);
}

/**
 * Check if user has project manager role
 * @param {Array} memberships - User's team memberships
 * @param {string} projectTeamId - Project team ID
 * @returns {boolean}
 */
export function isProjectManager(memberships, projectTeamId) {
  if (!memberships || !projectTeamId) return false;
  const projMembership = memberships.find(m => m.teamId === projectTeamId);
  return projMembership && (projMembership.roles.includes(ProjectRoles.MANAGER) || projMembership.roles.includes(ProjectRoles.OWNER));
}

/**
 * Check if user can access project
 * @param {Array} memberships - User's team memberships
 * @param {string} projectTeamId - Project team ID
 * @param {string} orgTeamId - Organization team ID
 * @returns {boolean}
 */
export function canAccessProject(memberships, projectTeamId, orgTeamId) {
  if (!memberships) return false;
  return memberships.some(m => m.teamId === projectTeamId || m.teamId === orgTeamId);
}

/**
 * Generate document permissions for organization-scoped resources
 * Uses labels for role-based access control
 * @param {string} orgTeamId - Organization team ID (for basic membership)
 * @returns {Array<string>} Permissions array
 */
export function getOrgDocPermissions(orgTeamId) {
  const { Permission, Role } = require('./appwriteAdmin');
  return [
    Permission.read(Role.team(orgTeamId)),    // All org members can read
    Permission.update(Role.label('admin')),   // Admins can update
    Permission.update(Role.label('manager')), // Managers can update
    Permission.delete(Role.label('admin')),   // Only admins can delete
  ];
}

/**
 * Generate document permissions for project resources
 * Uses labels for org-level access and team roles for project-specific access
 * @param {string} orgTeamId - Organization team ID
 * @param {string} projectTeamId - Project team ID
 * @returns {Array<string>} Permissions array
 */
export function getProjectDocPermissions(orgTeamId, projectTeamId) {
  const { Permission, Role } = require('./appwriteAdmin');
  return [
    Permission.read(Role.team(orgTeamId)),                  // All org members can read
    Permission.read(Role.team(projectTeamId)),              // All project members can read
    Permission.update(Role.label('admin')),                 // Org admins can update
    Permission.update(Role.team(projectTeamId, 'manager')), // Project managers can update
    Permission.update(Role.team(projectTeamId, 'owner')),   // Project owners can update
    Permission.delete(Role.label('admin')),                 // Org admins can delete
    Permission.delete(Role.team(projectTeamId, 'owner')),   // Project owners can delete
  ];
}

/**
 * Generate timesheet permissions (owner + managers/admins via labels)
 * @param {string} accountId - Account ID of the timesheet owner
 * @param {string} orgTeamId - Organization team ID
 * @returns {Array<string>} Permissions array
 */
export function getTimesheetPermissions(accountId, orgTeamId) {
  const { Permission, Role } = require('./appwriteAdmin');
  return [
    Permission.read(Role.user(accountId)),    // Owner can read
    Permission.read(Role.label('manager')),   // Managers can read
    Permission.read(Role.label('admin')),     // Admins can read
    Permission.update(Role.user(accountId)),  // Owner can update
    Permission.update(Role.label('manager')), // Managers can update (approve)
    Permission.update(Role.label('admin')),   // Admins can update
    Permission.delete(Role.user(accountId)),  // Owner can delete
  ];
}

/**
 * Generate user profile permissions (owner + managers/admins via labels)
 * @param {string} accountId - Account ID of the user
 * @param {string} orgTeamId - Organization team ID
 * @returns {Array<string>} Permissions array
 */
export function getUserProfilePermissions(accountId, orgTeamId) {
  const { Permission, Role } = require('./appwriteAdmin');
  return [
    Permission.read(Role.user(accountId)),    // User can read own profile
    Permission.read(Role.team(orgTeamId)),    // All org members can read profiles
    Permission.update(Role.user(accountId)),  // User can update own profile
    Permission.update(Role.label('admin')),   // Admins can update
    Permission.delete(Role.label('admin')),   // Only admins can delete
  ];
}

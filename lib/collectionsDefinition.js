/**
 * Collections Definition
 * Shared collection schemas used by both setup scripts and API endpoints
 * This is the single source of truth for all database collection schemas
 */

export const collectionsDefinition = [
  {
    id: 'pms_organizations',
    name: 'Organizations',
    attrs: [
      { key: 'name', type: 'string', size: 160, required: true },
      { key: 'code', type: 'string', size: 64 },
      { key: 'domain', type: 'string', size: 190 },
      { key: 'isActive', type: 'boolean', default: true }
    ],
    indexes: [
      { key: 'idx_code', type: 'key', attrs: ['code'] }
    ]
  },
  {
    id: 'pms_users',
    name: 'User Profiles',
    attrs: [
      { key: 'accountId', type: 'string', size: 64, required: true },
      { key: 'organizationId', type: 'string', size: 64, required: true },
      { key: 'email', type: 'email' },
      { key: 'username', type: 'string', size: 64, required: true },
      { key: 'firstName', type: 'string', size: 80, required: true },
      { key: 'lastName', type: 'string', size: 80, required: true },
      { key: 'otherNames', type: 'string', size: 120 },
      { key: 'status', type: 'enum', elements: ['active', 'inactive', 'invited', 'suspended'], default: 'active' },
      { key: 'title', type: 'string', size: 120 },
      { key: 'department', type: 'string', size: 120 },
      { key: 'timezone', type: 'string', size: 64, default: 'Africa/Kampala' },
      { key: 'avatarUrl', type: 'string', size: 512 },
      { key: 'clientOrganizationIds', type: 'string', size: 64, array: true },
      { key: 'organizationLabel', type: 'string', size: 64, array: true },
      { key: 'supervisedBy', type: 'string', size: 64 },
      { key: 'userType', type: 'enum', elements: ['staff', 'client'], default: null },
      { key: 'role', type: 'string', size: 64, array: true },
      { key: 'isAdmin', type: 'boolean', default: false }
    ],
    indexes: [
      { key: 'idx_org', type: 'key', attrs: ['organizationId'] },
      { key: 'idx_email', type: 'key', attrs: ['email'] },
      { key: 'uq_username', type: 'unique', attrs: ['username'] }
    ]
  },
  {
    id: 'pms_clients',
    name: 'Clients',
    attrs: [
      { key: 'organizationId', type: 'string', size: 64, required: true },
      { key: 'name', type: 'string', size: 190, required: true },
      { key: 'code', type: 'string', size: 64 },
      { key: 'primaryContactId', type: 'string', size: 64 },
      { key: 'email', type: 'email' },
      { key: 'phone', type: 'string', size: 40 },
      { key: 'address', type: 'string', size: 255 },
      { key: 'website', type: 'url' },
      { key: 'notes', type: 'string', size: 1000 },
      { key: 'status', type: 'enum', elements: ['active', 'inactive', 'suspended'], default: 'active' },
      { key: 'metadata', type: 'json' }
    ],
    indexes: [
      { key: 'idx_org', type: 'key', attrs: ['organizationId'] },
      { key: 'idx_name', type: 'key', attrs: ['name'] },
      { key: 'idx_primaryContact', type: 'key', attrs: ['primaryContactId'] }
    ]
  },
  {
    id: 'pms_projects',
    name: 'Projects',
    attrs: [
      { key: 'organizationId', type: 'string', size: 64, required: true },
      { key: 'clientId', type: 'string', size: 64 },
      { key: 'projectTeamId', type: 'string', size: 64 },
      { key: 'code', type: 'string', size: 64, required: true },
      { key: 'name', type: 'string', size: 190, required: true },
      { key: 'description', type: 'string', size: 2000 },
      { key: 'startDate', type: 'datetime' },
      { key: 'endDate', type: 'datetime' },
      { key: 'status', type: 'enum', elements: ['planned', 'active', 'on_hold', 'completed', 'cancelled'], default: 'planned' },
      { key: 'budgetAmount', type: 'float', default: 0 },
      { key: 'budgetCurrency', type: 'enum', elements: ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS'], default: 'USD' },
      { key: 'createdBy', type: 'string', size: 64 }
    ],
    indexes: [
      { key: 'idx_org', type: 'key', attrs: ['organizationId'] },
      { key: 'idx_client', type: 'key', attrs: ['clientId'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] },
      { key: 'uq_code', type: 'unique', attrs: ['code'] }
    ]
  },
  {
    id: 'pms_milestones',
    name: 'Milestones',
    attrs: [
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'name', type: 'string', size: 190, required: true },
      { key: 'startDate', type: 'datetime' },
      { key: 'dueDate', type: 'datetime' },
      { key: 'status', type: 'enum', elements: ['open', 'reached', 'closed'], default: 'open' },
      { key: 'actualDueDate', type: 'datetime' },
      { key: 'description', type: 'string', size: 5000 },
      { key: 'createdBy', type: 'string', size: 64 },
      { key: 'updatedBy', type: 'string', size: 64 },
    ],
    indexes: [
      { key: 'idx_project', type: 'key', attrs: ['projectId'] }
    ]
  },
  {
    id: 'pms_tasks',
    name: 'Tasks',
    attrs: [
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'milestoneId', type: 'string', size: 64 },
      { key: 'title', type: 'string', size: 190, required: true },
      { key: 'description', type: 'string', size: 2000 },
      { key: 'priority', type: 'enum', elements: ['low', 'medium', 'high', 'critical'], default: 'medium' },
      { key: 'status', type: 'enum', elements: ['todo', 'in_progress', 'blocked', 'done'], default: 'todo' },
      { key: 'estimatedHours', type: 'float', default: 0 },
      { key: 'dueDate', type: 'datetime' },
      { key: 'createdBy', type: 'string', size: 64 },
      { key: 'taskId', type: 'string', size: 64 },
      { key: 'assignedTo', type: 'string', size: 64, array: true },
      { key: 'startDate', type: 'datetime' },
      { key: 'updatedBy', type: 'string', size: 64 },
      { key: 'isClientVisible', type: 'boolean', default: false }
    ],
    indexes: [
      { key: 'idx_project', type: 'key', attrs: ['projectId'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] }
    ]
  },
  {
    id: 'pms_task_assignments',
    name: 'Task Assignments',
    attrs: [
      { key: 'taskId', type: 'string', size: 64, required: true },
      { key: 'accountId', type: 'string', size: 64, required: true },
      { key: 'assignedAt', type: 'datetime' }
    ],
    indexes: [
      { key: 'idx_task', type: 'key', attrs: ['taskId'] },
      { key: 'idx_account', type: 'key', attrs: ['accountId'] }
    ]
  },
  {
    id: 'pms_task_comments',
    name: 'Task Comments',
    attrs: [
      { key: 'taskId', type: 'string', size: 64, required: true },
      { key: 'accountId', type: 'string', size: 64, required: true },
      { key: 'body', type: 'string', size: 500, required: true },
      { key: 'createdAt', type: 'datetime' }
    ],
    indexes: [
      { key: 'idx_task', type: 'key', attrs: ['taskId'] }
    ]
  },
  {
    id: 'pms_timesheets',
    name: 'Timesheets',
    attrs: [
      { key: 'accountId', type: 'string', size: 64, required: true },
      { key: 'weekStart', type: 'datetime', required: true },
      { key: 'status', type: 'enum', elements: ['draft', 'submitted', 'approved', 'rejected'], default: 'draft' },
      { key: 'submittedAt', type: 'datetime' },
      { key: 'approvedBy', type: 'string', size: 64 },
      { key: 'approvedAt', type: 'datetime' },
      { key: 'rejectionComments', type: 'string', size: 1000 }
    ],
    indexes: [
      { key: 'idx_user_week', type: 'key', attrs: ['accountId', 'weekStart'] },
      { key: 'idx_status', type: 'key', attrs: ['status'] }
    ]
  },
  {
    id: 'pms_timesheet_entries',
    name: 'Timesheet Entries',
    attrs: [
      { key: 'timesheetId', type: 'string', size: 64, required: true },
      { key: 'title', type: 'string', size: 250, required: true },
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'taskId', type: 'string', size: 64 },
      { key: 'workDate', type: 'datetime', required: true },
      { key: 'hours', type: 'float', required: true },
      { key: 'notes', type: 'string', size: 500 },
      { key: 'billable', type: 'boolean', default: true },
      { key: 'startTime', type: 'datetime' },
      { key: 'endTime', type: 'datetime' }
    ],
    indexes: [
      { key: 'idx_ts', type: 'key', attrs: ['timesheetId'] },
      { key: 'idx_project_date', type: 'key', attrs: ['projectId', 'workDate'] }
    ]
  },
  {
    id: 'pms_timesheet_templates',
    name: 'Timesheet Templates',
    attrs: [
      { key: 'accountId', type: 'string', size: 64, required: true },
      { key: 'name', type: 'string', size: 100, required: true },
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'taskId', type: 'string', size: 64 },
      { key: 'hours', type: 'float', required: true },
      { key: 'notes', type: 'string', size: 500 },
      { key: 'billable', type: 'boolean', default: true }
    ],
    indexes: [
      { key: 'idx_account', type: 'key', attrs: ['accountId'] },
      { key: 'idx_project', type: 'key', attrs: ['projectId'] }
    ]
  },
  {
    id: 'pms_documents',
    name: 'Documents',
    attrs: [
      { key: 'documentId', type: 'string', size: 64, required: true },
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'uploaderId', type: 'string', size: 64, required: true },
      { key: 'title', type: 'string', size: 190, required: true },
      { key: 'category', type: 'enum', elements: ['contract', 'spec', 'design', 'report', 'invoice', 'other'], default: 'other' },
      { key: 'currentVersion', type: 'integer', default: 1 },
      { key: 'isClientVisible', type: 'boolean', default: false },
      { key: 'isStaffVisible', type: 'boolean', default: true },
      { key: 'staffList', type: 'string', size: 64, array: true },
      { key: 'clientList', type: 'string', size: 64, array: true },
      { key: 'parentFolderId', type: 'string', size: 64 }
    ],
    indexes: [
      { key: 'idx_project', type: 'key', attrs: ['projectId'] }
    ]
  },
  {
    id: 'pms_document_folders',
    name: 'Document Folders',
    attrs: [
      { key:  'projectFolder', type: 'boolean', default: false },
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'name', type: 'string', size: 190, required: true },
      { key: 'parentFolderId', type: 'string', size: 64 },
      { key: 'createdBy', type: 'string', size: 64 },
      { key: 'modifiedBy', type: 'string', size: 64 },
      { key: 'isClientVisible', type: 'boolean', default: false },
      { key: 'isStaffVisible', type: 'boolean', default: true },
      { key: 'staffList', type: 'string', size: 64, array: true },
      { key: 'clientList', type: 'string', size: 64, array: true }
    ],
    indexes: [
      { key: 'idx_project', type: 'key', attrs: ['projectId'] }
    ]
  },
  {
    id: 'pms_document_versions',
    name: 'Document Versions',
    attrs: [
      { key: 'documentId', type: 'string', size: 64, required: true },
      { key: 'versionNo', type: 'integer', required: true },
      { key: 'fileId', type: 'string', size: 64, required: true },
      { key: 'mimeType', type: 'string', size: 120, required: true },
      { key: 'sizeBytes', type: 'float', required: true },
      { key: 'checksumSha256', type: 'string', size: 64 },
      { key: 'uploadedBy', type: 'string', size: 64, required: true },
      { key: 'uploadedAt', type: 'datetime', required: true }
    ],
    indexes: [
      { key: 'idx_doc_ver', type: 'key', attrs: ['documentId', 'versionNo'] }
    ]
  },
  {
    id: 'pms_embeds',
    name: 'Embeds',
    attrs: [
      { key: 'projectId', type: 'string', size: 64, required: true },
      { key: 'title', type: 'string', size: 190, required: true },
      { key: 'provider', type: 'string', size: 80 },
      { key: 'url', type: 'string', size: 1024, required: true },
      { key: 'width', type: 'integer', default: 1000 },
      { key: 'height', type: 'integer', default: 650 },
      { key: 'allowFullscreen', type: 'boolean', default: true },
      { key: 'createdBy', type: 'string', size: 64 },
      { key: 'isClientVisible', type: 'boolean', default: false }
    ],
    indexes: [
      { key: 'idx_project', type: 'key', attrs: ['projectId'] }
    ]
  },
  {
    id: 'pms_fx_rates',
    name: 'FX Rates',
    attrs: [
      { key: 'key', type: 'string', size: 16, required: true },
      { key: 'base', type: 'string', size: 8, required: true },
      { key: 'quote', type: 'string', size: 8, required: true },
      { key: 'rate', type: 'float', required: true },
      { key: 'asOfDate', type: 'datetime', required: true },
      { key: 'isManual', type: 'boolean', default: false },
      { key: 'notes', type: 'string', size: 500 },
      { key: 'createdBy', type: 'string', size: 64 },
      { key: 'createdFrom', type: 'string', size: 64 },
      { key: 'source', type: 'string', size: 128 },
    ],
    indexes: [
      { key: 'idx_key', type: 'key', attrs: ['key'] },
      { key: 'idx_base_quote', type: 'key', attrs: ['base', 'quote'] },
      { key: 'idx_asOfDate', type: 'key', attrs: ['asOfDate'] }
    ]
  }
];

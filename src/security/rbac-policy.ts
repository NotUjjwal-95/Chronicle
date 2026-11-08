import { ProjectRole } from '../types';

export type ProjectPermission =
  | 'project:read'
  | 'project:update'
  | 'source:read'
  | 'source:ingest'
  | 'reconstruct:run'
  | 'verify:run'
  | 'claim:read'
  | 'claim:review'
  | 'conflict:read'
  | 'conflict:resolve'
  | 'interview:read'
  | 'interview:submit'
  | 'graph:read'
  | 'contributor:read'
  | 'audit:read'
  | 'snapshot:read'
  | 'snapshot:create'
  | 'snapshot:verify'
  | 'snapshot:acknowledge'
  | 'snapshot:export'
  | 'workspace:reset'
  | 'shadow:preview';

const ROLE_PERMISSION_MATRIX: Record<ProjectRole, ReadonlySet<ProjectPermission>> = {
  [ProjectRole.MAINTAINER]: new Set<ProjectPermission>([
    'project:read',
    'project:update',
    'source:read',
    'source:ingest',
    'reconstruct:run',
    'verify:run',
    'claim:read',
    'claim:review',
    'conflict:read',
    'conflict:resolve',
    'interview:read',
    'interview:submit',
    'graph:read',
    'contributor:read',
    'audit:read',
    'snapshot:read',
    'snapshot:create',
    'snapshot:verify',
    'snapshot:acknowledge',
    'snapshot:export',
    'workspace:reset',
    'shadow:preview',
  ]),
  [ProjectRole.REVIEWER]: new Set<ProjectPermission>([
    'project:read',
    'source:read',
    'source:ingest',
    'reconstruct:run',
    'verify:run',
    'claim:read',
    'claim:review',
    'conflict:read',
    'conflict:resolve',
    'interview:read',
    'interview:submit',
    'graph:read',
    'contributor:read',
    'audit:read',
    'snapshot:read',
    'snapshot:create',
    'snapshot:verify',
    'snapshot:export',
  ]),
  [ProjectRole.INCOMING_OWNER]: new Set<ProjectPermission>([
    'project:read',
    'source:read',
    'verify:run',
    'claim:read',
    'conflict:read',
    'interview:read',
    'interview:submit',
    'graph:read',
    'contributor:read',
    'audit:read',
    'snapshot:read',
    'snapshot:verify',
    'snapshot:acknowledge',
    'snapshot:export',
  ]),
  [ProjectRole.EXTERNAL_AUDITOR]: new Set<ProjectPermission>([
    'project:read',
    'source:read',
    'claim:read',
    'conflict:read',
    'interview:read',
    'graph:read',
    'contributor:read',
    'snapshot:read',
    'snapshot:verify',
    'snapshot:export',
  ]),
};

const MUTATING_PERMISSIONS: ReadonlySet<ProjectPermission> = new Set<ProjectPermission>([
  'project:update',
  'source:ingest',
  'reconstruct:run',
  'verify:run',
  'claim:review',
  'conflict:resolve',
  'interview:submit',
  'snapshot:create',
  'snapshot:acknowledge',
  'workspace:reset',
]);

export function hasRolePermission(
  role: ProjectRole,
  permission: ProjectPermission,
  isShadowPreview = false
): boolean {
  // Rule 6.3: Shadow role preview must be scoped strictly to read-only operations.
  if (isShadowPreview && MUTATING_PERMISSIONS.has(permission)) {
    return false;
  }

  const allowedSet = ROLE_PERMISSION_MATRIX[role];
  if (!allowedSet) {
    return false;
  }

  return allowedSet.has(permission);
}

export function isMutatingPermission(permission: ProjectPermission): boolean {
  return MUTATING_PERMISSIONS.has(permission);
}

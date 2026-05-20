export type Role = 'OWNER' | 'USER' | 'ADMIN';

export const permissions = {
  OWNER: ['catalog:read', 'catalog:write', 'subscription:manage', 'apikey:manage', 'analytics:read'],
  USER: ['catalog:read', 'catalog:write'],
  ADMIN: ['catalog:read', 'catalog:write', 'subscription:manage', 'apikey:manage', 'analytics:read', 'admin:all'],
} as const;

type Permission = (typeof permissions)[Role][number];

export function can(role: Role, permission: Permission | 'admin:all') {
  return permissions[role].includes(permission as Permission) || role === 'ADMIN';
}

export function assertRole(required: Role | Role[], actual: Role) {
  const allowed = Array.isArray(required) ? required : [required];
  if (!allowed.includes(actual)) {
    throw new Error('FORBIDDEN_ROLE');
  }
}

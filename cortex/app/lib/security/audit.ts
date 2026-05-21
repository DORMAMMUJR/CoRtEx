export type AuditPayload = {
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

export function toStructuredAudit(payload: AuditPayload) {
  return {
    level: 'info',
    event: 'audit',
    timestamp: new Date().toISOString(),
    ...payload,
  };
}

export type Plan = 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS';

export const PLAN_LIMITS: Record<Plan, { catalogs: number; itemsPerCatalog: number; seats: number }> = {
  FREE: { catalogs: 3, itemsPerCatalog: 50, seats: 1 },
  STARTER: { catalogs: 15, itemsPerCatalog: 300, seats: 1 },
  PRO: { catalogs: 100, itemsPerCatalog: 1200, seats: 3 },
  BUSINESS: { catalogs: 1000, itemsPerCatalog: 5000, seats: 20 },
};

export const PLAN_FLAGS: Record<Plan, string[]> = {
  FREE: ['pdf_ingest_basic'],
  STARTER: ['pdf_ingest_basic', 'publications', 'analytics_basic'],
  PRO: ['pdf_ingest_basic', 'publications', 'analytics_advanced', 'ai_image_assist'],
  BUSINESS: ['pdf_ingest_basic', 'publications', 'analytics_advanced', 'ai_image_assist', 'api_keys', 'team_access'],
};

export function hasPlanFeature(plan: Plan, flag: string) {
  return PLAN_FLAGS[plan].includes(flag);
}

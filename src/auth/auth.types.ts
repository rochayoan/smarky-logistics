export type ApiClientType = 'internal_service' | 'tenant_client';
export interface AuthenticatedClient { id: string; name: string; clientType: ApiClientType; tenantId: string | null; }
export interface TenantContext { tenantId: string; }

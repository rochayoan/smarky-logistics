import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedClient, TenantContext } from './auth.types.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function resolveTenantContext(client: AuthenticatedClient, header: unknown): TenantContext {
  if (header !== undefined && (typeof header !== 'string' || !UUID.test(header))) throw new BadRequestException({ code: 'tenant_context_required' });
  if (client.clientType === 'tenant_client') { if (client.tenantId === null) throw new ForbiddenException(); if (header !== undefined && header !== client.tenantId) throw new ForbiddenException({ code: 'tenant_context_mismatch' }); return { tenantId: client.tenantId }; }
  if (header === undefined) throw new BadRequestException({ code: 'tenant_context_required' });
  return { tenantId: header };
}
export function assertTenantContext(context: TenantContext, supplied?: string): void { if (supplied !== undefined && supplied !== context.tenantId) throw new ForbiddenException({ code: 'tenant_context_mismatch' }); }

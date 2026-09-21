import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertTenantContext, resolveTenantContext } from './tenant-context.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const tenantClient = { id: '1', name: 'tenant-a', clientType: 'tenant_client' as const, tenantId: tenantA };
const internal = { id: '2', name: 'orders', clientType: 'internal_service' as const, tenantId: null };

describe('TenantContext', () => {
  it('derives tenant-client context from the credential', () => expect(resolveTenantContext(tenantClient, undefined).tenantId).toBe(tenantA));
  it('rejects tenant-client header and body mismatches', () => {
    expect(() => resolveTenantContext(tenantClient, tenantB)).toThrow(ForbiddenException);
    expect(() => assertTenantContext({ tenantId: tenantA }, tenantB)).toThrow(ForbiddenException);
  });
  it('requires a valid internal-service header and selects its tenant', () => {
    expect(() => resolveTenantContext(internal, undefined)).toThrow();
    expect(() => resolveTenantContext(internal, 'invalid')).toThrow();
    expect(resolveTenantContext(internal, tenantB).tenantId).toBe(tenantB);
  });
});

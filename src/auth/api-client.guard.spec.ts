import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApiClientGuard } from './api-client.guard.js';
import { hashApiToken } from './token.js';

const tenantA = '11111111-1111-4111-8111-111111111111';

describe('ApiClientGuard', () => {
  it('rejects missing, malformed, unknown, and inactive bearer tokens', async () => {
    for (const authorization of [undefined, 'Basic abc', 'Bearer unknown']) {
      const guard = guardWith(undefined);
      await expect(guard.canActivate(contextFor(authorization))).rejects.toBeInstanceOf(UnauthorizedException);
    }
    const guard = guardWith(undefined);
    await expect(guard.canActivate(contextFor('Bearer inactive'))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('looks up SHA-256 hash only and attaches the authenticated client', async () => {
    const database = databaseWith({ id: 'client-a', name: 'orders', client_type: 'internal_service', tenant_id: null, is_active: true });
    const guard = new ApiClientGuard(database as never, { getAllAndOverride: () => false } as never);
    const context = contextFor('Bearer sml_test_token', tenantA);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(database.where).toHaveBeenCalledWith('token_hash', '=', hashApiToken('sml_test_token'));
    expect(database.where).not.toHaveBeenCalledWith('token_hash', '=', 'sml_test_token');
    expect(context.request.authenticatedClient).toEqual({ id: 'client-a', name: 'orders', clientType: 'internal_service', tenantId: null });
    expect(context.request.tenantContext).toEqual({ tenantId: tenantA });
  });
});

function guardWith(row: unknown) { const database = databaseWith(row); return new ApiClientGuard(database as never, { getAllAndOverride: () => false } as never); }
function databaseWith(row: unknown) { const where = vi.fn(); const query = { where: (...args: unknown[]) => { where(...args); return query; }, executeTakeFirst: vi.fn().mockResolvedValue(row) }; return { where, selectFrom: vi.fn(() => ({ selectAll: () => query })) }; }
function contextFor(authorization: string | undefined, tenantId?: string) { const request: { headers: Record<string, string | undefined>; authenticatedClient?: unknown; tenantContext?: unknown } = { headers: { authorization, 'x-tenant-id': tenantId } }; return { request, getHandler: () => undefined, getClass: () => undefined, switchToHttp: () => ({ getRequest: () => request }) } as never; }

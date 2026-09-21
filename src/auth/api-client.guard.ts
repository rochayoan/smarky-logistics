import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../database/database.service.js';
import { IS_PUBLIC_KEY } from './auth.decorators.js';
import { resolveTenantContext } from './tenant-context.js';
import { hashApiToken } from './token.js';
@Injectable()
export class ApiClientGuard implements CanActivate {
  constructor(private readonly database: DatabaseService, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; authenticatedClient?: unknown; tenantContext?: unknown }>();
    const value = request.headers.authorization;
    if (value === undefined || !value.startsWith('Bearer ') || value.length <= 7) throw new UnauthorizedException();
    const row = await this.database.selectFrom('api_clients').selectAll().where('token_hash', '=', hashApiToken(value.slice(7))).where('is_active', '=', true).executeTakeFirst();
    if (row === undefined) throw new UnauthorizedException();
    const client = { id: row.id, name: row.name, clientType: row.client_type, tenantId: row.tenant_id };
    request.authenticatedClient = client;
    request.tenantContext = resolveTenantContext(client, request.headers['x-tenant-id']);
    return true;
  }
}

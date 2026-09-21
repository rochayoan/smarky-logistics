import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { TenantContext } from './auth.types.js';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const CurrentTenant = createParamDecorator((_: unknown, context: ExecutionContext): TenantContext => context.switchToHttp().getRequest<{ tenantContext: TenantContext }>().tenantContext);

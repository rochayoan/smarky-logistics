import { BadRequestException } from '@nestjs/common';

export interface CreateRiderDto {
  tenantId: string;
  name: string;
  phone: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCreateRiderDto(value: unknown): CreateRiderDto {
  if (!isRecord(value)) {
    throw new BadRequestException('Request body must be an object');
  }

  return {
    tenantId: requiredUuid(value, 'tenantId'),
    name: requiredString(value, 'name'),
    phone: optionalString(value, 'phone'),
  };
}

export function parseTenantId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new BadRequestException('tenantId must be a UUID');
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredUuid(value: Record<string, unknown>, field: string): string {
  const uuid = value[field];

  if (typeof uuid !== 'string' || !UUID_PATTERN.test(uuid)) {
    throw new BadRequestException(`${field} must be a UUID`);
  }

  return uuid;
}

function requiredString(value: Record<string, unknown>, field: string): string {
  const string = value[field];

  if (typeof string !== 'string' || string.trim().length === 0) {
    throw new BadRequestException(`${field} must be a non-empty string`);
  }

  return string;
}

function optionalString(value: Record<string, unknown>, field: string): string | null {
  const string = value[field];

  if (string === undefined || string === null) {
    return null;
  }

  if (typeof string !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }

  return string;
}

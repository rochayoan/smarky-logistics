import { BadRequestException } from '@nestjs/common';

export interface AssignRiderDto {
  riderId: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAssignRiderDto(value: unknown): AssignRiderDto {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
  }

  const { riderId } = value as Record<string, unknown>;

  if (typeof riderId !== 'string' || !UUID_PATTERN.test(riderId)) {
    throw new BadRequestException('riderId must be a UUID');
  }

  return { riderId };
}

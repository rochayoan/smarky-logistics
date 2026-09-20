import { BadRequestException } from '@nestjs/common';

export type RiderAvailabilityStatus = 'available' | 'offline';

export interface UpdateRiderAvailabilityDto {
  status: RiderAvailabilityStatus;
}

export function parseUpdateRiderAvailabilityDto(
  value: unknown,
): UpdateRiderAvailabilityDto {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
  }

  const { status } = value as Record<string, unknown>;

  if (status !== 'available' && status !== 'offline') {
    throw new BadRequestException('status must be available or offline');
  }

  return { status };
}

import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseUpdateRiderAvailabilityDto } from './update-rider-availability.dto.js';

describe('parseUpdateRiderAvailabilityDto', () => {
  it('rejects manually setting a rider to busy', () => {
    expect(() => parseUpdateRiderAvailabilityDto({ status: 'busy' })).toThrow(
      BadRequestException,
    );
  });
});

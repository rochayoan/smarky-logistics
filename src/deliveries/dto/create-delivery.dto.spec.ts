import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseCreateDeliveryDto } from './create-delivery.dto.js';

const validPayload = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  restaurantId: '22222222-2222-4222-8222-222222222222',
  branchId: '33333333-3333-4333-8333-333333333333',
  dropoffAddress: 'Av. Siempre Viva 123',
};

describe('parseCreateDeliveryDto', () => {
  it('requires branchId', () => {
    const { branchId: _branchId, ...payloadWithoutBranch } = validPayload;

    expect(() => parseCreateDeliveryDto(payloadWithoutBranch)).toThrow(
      BadRequestException,
    );
  });

  it('uses smarky-orders as the source system by default', () => {
    expect(parseCreateDeliveryDto(validPayload)).toMatchObject({
      sourceSystem: 'smarky-orders',
    });
  });

  it('rejects client-provided deliveryVersion', () => {
    expect(() =>
      parseCreateDeliveryDto({ ...validPayload, deliveryVersion: 2 }),
    ).toThrow(BadRequestException);
  });
});

import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service.js';
import { DeliveriesService } from './deliveries.service.js';

const createdDelivery = {
  id: '11111111-1111-4111-8111-111111111111',
  tenant_id: '22222222-2222-4222-8222-222222222222',
  restaurant_id: '33333333-3333-4333-8333-333333333333',
  branch_id: '44444444-4444-4444-8444-444444444444',
  external_order_id: 'order-123',
  source_system: 'smarky-orders',
  delivery_version: 1,
  status: 'pending' as const,
  pickup_address: null,
  pickup_latitude: null,
  pickup_longitude: null,
  dropoff_address: 'Av. Siempre Viva 123',
  dropoff_latitude: -17.7833,
  dropoff_longitude: -63.1821,
  customer_name: 'Ana Pérez',
  customer_phone: null,
  customer_notes: null,
  delivery_fee: '12.50',
  created_at: new Date('2026-09-20T00:00:00.000Z'),
  updated_at: new Date('2026-09-20T00:00:00.000Z'),
};

describe('DeliveriesService', () => {
  it('creates a pending delivery and its creation event in one transaction', async () => {
    const deliveryValues = vi.fn().mockReturnValue({
      returningAll: () => ({
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue(createdDelivery),
      }),
    });
    const eventExecute = vi.fn().mockResolvedValue([]);
    const eventValues = vi.fn().mockReturnValue({ execute: eventExecute });
    const insertInto = vi.fn((table: string) => {
      return table === 'deliveries'
        ? { values: deliveryValues }
        : { values: eventValues };
    });
    const execute = vi.fn(
      async (callback: (transaction: { insertInto: typeof insertInto }) => Promise<unknown>) =>
        callback({ insertInto }),
    );
    const transaction = vi.fn(() => ({ execute }));
    const database = { transaction } as unknown as DatabaseService;
    const service = new DeliveriesService(database);

    const result = await service.create(createdDelivery.tenant_id, {
      tenantId: createdDelivery.tenant_id,
      restaurantId: createdDelivery.restaurant_id,
      branchId: createdDelivery.branch_id,
      externalOrderId: createdDelivery.external_order_id,
      sourceSystem: createdDelivery.source_system,
      pickupAddress: null,
      pickupLatitude: null,
      pickupLongitude: null,
      dropoffAddress: createdDelivery.dropoff_address,
      dropoffLatitude: createdDelivery.dropoff_latitude,
      dropoffLongitude: createdDelivery.dropoff_longitude,
      customerName: createdDelivery.customer_name,
      customerPhone: null,
      customerNotes: null,
      deliveryFee: 12.5,
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(insertInto).toHaveBeenNthCalledWith(1, 'deliveries');
    expect(deliveryValues).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        source_system: 'smarky-orders',
        delivery_version: 1,
        delivery_fee: 12.5,
      }),
    );
    expect(insertInto).toHaveBeenNthCalledWith(2, 'delivery_events');
    expect(eventValues).toHaveBeenCalledWith({
      tenant_id: createdDelivery.tenant_id,
      delivery_id: createdDelivery.id,
      event_type: 'delivery_created',
      metadata: {
        source: 'api',
        sourceSystem: 'smarky-orders',
        externalOrderId: createdDelivery.external_order_id,
      },
    });
    expect(eventExecute).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      id: createdDelivery.id,
      status: 'pending',
      sourceSystem: 'smarky-orders',
      deliveryVersion: 1,
      deliveryFee: '12.50',
    });
  });

  it('converts an external-order uniqueness conflict into a domain conflict', async () => {
    const database = {
      transaction: vi.fn(() => ({
        execute: vi.fn().mockRejectedValue({
          code: '23505',
          constraint: 'deliveries_tenant_id_source_system_external_order_id_key',
        }),
      })),
    } as unknown as DatabaseService;
    const service = new DeliveriesService(database);

    await expect(
      service.create(createdDelivery.tenant_id, {
        tenantId: createdDelivery.tenant_id,
        restaurantId: createdDelivery.restaurant_id,
        branchId: createdDelivery.branch_id,
        externalOrderId: createdDelivery.external_order_id,
        sourceSystem: createdDelivery.source_system,
        pickupAddress: null,
        pickupLatitude: null,
        pickupLongitude: null,
        dropoffAddress: createdDelivery.dropoff_address,
        dropoffLatitude: createdDelivery.dropoff_latitude,
        dropoffLongitude: createdDelivery.dropoff_longitude,
        customerName: null,
        customerPhone: null,
        customerNotes: null,
        deliveryFee: null,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'delivery_already_exists',
      },
      status: 409,
    });
  });

  it('returns 404 when a delivery does not exist', async () => {
    const executeTakeFirst = vi.fn().mockResolvedValue(undefined);
    const query = { where: () => query, executeTakeFirst };
    const database = { selectFrom: vi.fn(() => ({ selectAll: () => query })) } as unknown as DatabaseService;
    const service = new DeliveriesService(database);

    await expect(
      service.findOne('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

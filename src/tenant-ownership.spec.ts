import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from './database/database.service.js';
import { DeliveriesService } from './deliveries/deliveries.service.js';
import { RidersService } from './riders/riders.service.js';
import { AssignmentsService } from './assignments/assignments.service.js';

const tenantA = '11111111-1111-4111-8111-111111111111';
const deliveryA = '33333333-3333-4333-8333-333333333333';
const deliveryB = '44444444-4444-4444-8444-444444444444';

describe('tenant ownership regression', () => {
  it('findOne scopes delivery lookup by id and tenant_id', async () => {
    const where = vi.fn();
    const row = deliveryRow(deliveryA, tenantA);
    const query = { where: (column: string, operator: string, value: string) => { where(column, operator, value); return query; }, executeTakeFirst: vi.fn().mockResolvedValue(row) };
    const database = { selectFrom: vi.fn(() => ({ selectAll: () => query })) } as unknown as DatabaseService;
    const result = await new DeliveriesService(database).findOne(tenantA, deliveryA);
    expect(result.id).toBe(deliveryA);
    expect(where).toHaveBeenCalledWith('id', '=', deliveryA);
    expect(where).toHaveBeenCalledWith('tenant_id', '=', tenantA);
  });

  it('does not expose a delivery belonging to tenant B from tenant A context', async () => {
    const where = vi.fn();
    const query = { where: (column: string, operator: string, value: string) => { where(column, operator, value); return query; }, executeTakeFirst: vi.fn().mockResolvedValue(undefined) };
    const database = { selectFrom: vi.fn(() => ({ selectAll: () => query })) } as unknown as DatabaseService;
    await expect(new DeliveriesService(database).findOne(tenantA, deliveryB)).rejects.toBeInstanceOf(NotFoundException);
    expect(where).toHaveBeenCalledWith('id', '=', deliveryB);
    expect(where).toHaveBeenCalledWith('tenant_id', '=', tenantA);
  });

  it('uses the effective tenant for rider create and list', async () => {
    const values = vi.fn().mockReturnValue({ returningAll: () => ({ executeTakeFirstOrThrow: vi.fn().mockResolvedValue(riderRow(tenantA)) }) });
    const where = vi.fn();
    const query = { where: (column: string, operator: string, value: string) => { where(column, operator, value); return query; }, orderBy: () => query, execute: vi.fn().mockResolvedValue([]) };
    const database = { insertInto: vi.fn(() => ({ values })), selectFrom: vi.fn(() => ({ selectAll: () => query })) } as unknown as DatabaseService;
    const service = new RidersService(database);
    await service.create(tenantA, { tenantId: '22222222-2222-4222-8222-222222222222', name: 'Rider A', phone: null });
    await service.list(tenantA, 'available');
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: tenantA }));
    expect(where).toHaveBeenCalledWith('tenant_id', '=', tenantA);
    expect(where).toHaveBeenCalledWith('status', '=', 'available');
  });

  it('scopes rider availability lookup by id and effective tenant', async () => {
    const where = vi.fn(); const rider = riderRow(tenantA);
    const select = { where: (column: string, operator: string, value: string) => { where(column, operator, value); return select; }, forUpdate: () => select, executeTakeFirst: vi.fn().mockResolvedValue(rider) };
    const update = { set: () => update, where: () => update, returningAll: () => update, executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ ...rider, status: 'available' }) };
    const database = { transaction: () => ({ execute: (callback: (trx: unknown) => Promise<unknown>) => callback({ selectFrom: () => ({ selectAll: () => select }), updateTable: () => update }) }) } as unknown as DatabaseService;
    await expect(new RidersService(database).updateAvailability(tenantA, rider.id, 'available')).resolves.toMatchObject({ status: 'available' });
    expect(where).toHaveBeenCalledWith('id', '=', rider.id);
    expect(where).toHaveBeenCalledWith('tenant_id', '=', tenantA);
  });

  it('does not update a tenant B rider from tenant A context', async () => {
    const where = vi.fn(); const select = { where: (column: string, operator: string, value: string) => { where(column, operator, value); return select; }, forUpdate: () => select, executeTakeFirst: vi.fn().mockResolvedValue(undefined) };
    const database = { transaction: () => ({ execute: (callback: (trx: unknown) => Promise<unknown>) => callback({ selectFrom: () => ({ selectAll: () => select }) }) }) } as unknown as DatabaseService;
    await expect(new RidersService(database).updateAvailability(tenantA, '66666666-6666-4666-8666-666666666666', 'available')).rejects.toBeInstanceOf(NotFoundException);
    expect(where).toHaveBeenCalledWith('tenant_id', '=', tenantA);
  });

  it('returns tenant-safe not found for Tenant B deliveries across assignment lifecycle actions', async () => {
    for (const action of ['assign', 'accept', 'pickedUp', 'delivered'] as const) {
      const where = vi.fn(); const select = { where: (column: string, operator: string, value: string) => { where(column, operator, value); return select; }, forUpdate: () => select, executeTakeFirst: vi.fn().mockResolvedValue(undefined) };
      const database = { transaction: () => ({ execute: (callback: (trx: unknown) => Promise<unknown>) => callback({ selectFrom: () => ({ selectAll: () => select }) }) }) } as unknown as DatabaseService;
      const service = new AssignmentsService(database);
      const invoke = action === 'assign' ? () => service.assign(tenantA, deliveryB, '55555555-5555-4555-8555-555555555555') : () => service[action](tenantA, deliveryB, '66666666-6666-4666-8666-666666666666');
      await expect(invoke()).rejects.toBeInstanceOf(NotFoundException);
      expect(where).toHaveBeenCalledWith('id', '=', deliveryB);
      expect(where).toHaveBeenCalledWith('tenant_id', '=', tenantA);
    }
  });
});

function deliveryRow(id: string, tenantId: string) { return { id, tenant_id: tenantId, restaurant_id: tenantId, branch_id: tenantId, external_order_id: null, source_system: 'test', delivery_version: 1, status: 'pending' as const, pickup_address: null, pickup_latitude: null, pickup_longitude: null, dropoff_address: 'test', dropoff_latitude: null, dropoff_longitude: null, customer_name: null, customer_phone: null, customer_notes: null, delivery_fee: null, created_at: new Date(), updated_at: new Date() }; }
function riderRow(tenantId: string) { return { id: '55555555-5555-4555-8555-555555555555', tenant_id: tenantId, name: 'Rider A', phone: null, status: 'offline' as const, is_active: true, created_at: new Date(), updated_at: new Date() }; }

import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service.js';
import { AssignmentsService } from './assignments.service.js';

const delivery = {
  id: '11111111-1111-4111-8111-111111111111',
  tenant_id: '22222222-2222-4222-8222-222222222222',
  status: 'pending' as const,
  delivery_version: 1,
};
const rider = {
  id: '33333333-3333-4333-8333-333333333333',
  tenant_id: delivery.tenant_id,
  status: 'available' as const,
  is_active: true,
};
const assignment = {
  id: '44444444-4444-4444-8444-444444444444',
  tenant_id: delivery.tenant_id,
  delivery_id: delivery.id,
  rider_id: rider.id,
  status: 'assigned' as const,
  assigned_at: new Date('2026-09-20T00:00:00.000Z'),
  accepted_at: null,
  created_at: new Date('2026-09-20T00:00:00.000Z'),
};

describe('AssignmentsService', () => {
  it('assigns an available rider, updates delivery and rider, and records an event', async () => {
    const database = transactionDatabase({
      delivery,
      rider,
      createdAssignment: assignment,
      updatedDelivery: { status: 'assigned', delivery_version: 2 },
    });
    const service = new AssignmentsService(database);

    const result = await service.assign(delivery.id, { riderId: rider.id });

    expect(database.writes.assignment).toMatchObject({ status: 'assigned' });
    expect(database.writes.delivery).toMatchObject({
      status: 'assigned',
      delivery_version: 2,
    });
    expect(database.writes.rider).toMatchObject({ status: 'busy' });
    expect(database.writes.events).toEqual([
      expect.objectContaining({
        event_type: 'rider_assigned',
        rider_id: rider.id,
        delivery_id: delivery.id,
      }),
    ]);
    expect(result).toMatchObject({ deliveryStatus: 'assigned', deliveryVersion: 2 });
  });

  it('rejects a rider from another tenant', async () => {
    const database = transactionDatabase({
      delivery,
      rider: { ...rider, tenant_id: '55555555-5555-4555-8555-555555555555' },
    });

    await expect(new AssignmentsService(database).assign(delivery.id, { riderId: rider.id })).rejects.toMatchObject({
      response: { code: 'rider_tenant_mismatch' },
      status: 409,
    });
  });

  it('rejects a rider that is not available', async () => {
    const database = transactionDatabase({
      delivery,
      rider: { ...rider, status: 'busy' as const },
    });

    await expect(new AssignmentsService(database).assign(delivery.id, { riderId: rider.id })).rejects.toMatchObject({
      response: { code: 'rider_unavailable' },
      status: 409,
    });
  });

  it('rejects a delivery that is not pending', async () => {
    const database = transactionDatabase({
      delivery: { ...delivery, status: 'assigned' as const },
      rider,
    });

    await expect(new AssignmentsService(database).assign(delivery.id, { riderId: rider.id })).rejects.toMatchObject({
      response: { code: 'delivery_not_assignable' },
      status: 409,
    });
  });

  it('maps an active-assignment uniqueness conflict to 409', async () => {
    const database = {
      transaction: vi.fn(() => ({ execute: vi.fn().mockRejectedValue({ code: '23505' }) })),
    } as unknown as DatabaseService;

    await expect(new AssignmentsService(database).assign(delivery.id, { riderId: rider.id })).rejects.toMatchObject({
      response: { code: 'assignment_conflict' },
      status: 409,
    });
  });

  it('accepts an assigned delivery, increments its version, and records an event', async () => {
    const assignedDelivery = { ...delivery, status: 'assigned' as const, delivery_version: 2 };
    const acceptedAssignment = {
      ...assignment,
      status: 'accepted' as const,
      accepted_at: new Date('2026-09-20T01:00:00.000Z'),
    };
    const database = transactionDatabase({
      delivery: assignedDelivery,
      rider,
      activeAssignment: assignment,
      updatedAssignment: acceptedAssignment,
      updatedDelivery: { status: 'accepted', delivery_version: 3 },
    });
    const service = new AssignmentsService(database);

    const result = await service.accept(assignedDelivery.id, rider.id);

    expect(database.writes.assignment).toMatchObject({ status: 'accepted', accepted_at: expect.any(Date) });
    expect(database.writes.delivery).toMatchObject({ status: 'accepted', delivery_version: 3 });
    expect(database.writes.rider).toBeUndefined();
    expect(database.writes.events).toEqual([
      expect.objectContaining({ event_type: 'rider_accepted', rider_id: rider.id }),
    ]);
    expect(result).toMatchObject({
      status: 'accepted',
      acceptedAt: acceptedAssignment.accepted_at,
      deliveryStatus: 'accepted',
      deliveryVersion: 3,
    });
  });

  it('rejects acceptance by a rider without the assigned delivery', async () => {
    const database = transactionDatabase({
      delivery: { ...delivery, status: 'assigned' as const },
      rider,
    });

    await expect(new AssignmentsService(database).accept(delivery.id, rider.id)).rejects.toMatchObject({
      response: { code: 'assignment_not_assignable' },
      status: 409,
    });
  });
});

function transactionDatabase(options: {
  delivery: typeof delivery;
  rider: typeof rider;
  activeAssignment?: typeof assignment;
  createdAssignment?: typeof assignment;
  updatedAssignment?: typeof assignment;
  updatedDelivery?: { status: 'assigned' | 'accepted'; delivery_version: number };
}) {
  const writes: {
    assignment?: Record<string, unknown>;
    delivery?: Record<string, unknown>;
    rider?: Record<string, unknown>;
    events: Record<string, unknown>[];
  } = { events: [] };
  const selectFrom = vi.fn((table: string) => {
    const result = table === 'deliveries'
      ? options.delivery
      : table === 'riders'
        ? options.rider
        : options.activeAssignment;
    return query(result);
  });
  const insertInto = vi.fn((table: string) => writeBuilder(table, writes, options));
  const updateTable = vi.fn((table: string) => updateBuilder(table, writes, options));
  const trx = { selectFrom, insertInto, updateTable };

  return {
    writes,
    transaction: vi.fn(() => ({ execute: (callback: (value: typeof trx) => Promise<unknown>) => callback(trx) })),
  } as unknown as DatabaseService & { writes: typeof writes };
}

function query(result: unknown) {
  const builder = {
    selectAll: () => builder,
    where: () => builder,
    forUpdate: () => builder,
    executeTakeFirst: vi.fn().mockResolvedValue(result),
  };
  return builder;
}

function writeBuilder(
  table: string,
  writes: { assignment?: Record<string, unknown>; events: Record<string, unknown>[] },
  options: { createdAssignment?: typeof assignment },
) {
  const builder = {
    values: (values: Record<string, unknown>) => {
      if (table === 'delivery_assignments') {
        writes.assignment = values;
      }
      if (table === 'delivery_events') {
        writes.events.push(values);
      }
      return builder;
    },
    returningAll: () => builder,
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue(options.createdAssignment),
    execute: vi.fn().mockResolvedValue([]),
  };
  return builder;
}

function updateBuilder(
  table: string,
  writes: {
    assignment?: Record<string, unknown>;
    delivery?: Record<string, unknown>;
    rider?: Record<string, unknown>;
  },
  options: {
    updatedAssignment?: typeof assignment;
    updatedDelivery?: { status: 'assigned' | 'accepted'; delivery_version: number };
  },
) {
  const builder = {
    set: (values: Record<string, unknown>) => {
      if (table === 'delivery_assignments') writes.assignment = values;
      if (table === 'deliveries') writes.delivery = values;
      if (table === 'riders') writes.rider = values;
      return builder;
    },
    where: () => builder,
    returningAll: () => builder,
    returning: () => builder,
    executeTakeFirstOrThrow: vi.fn().mockImplementation(() => {
      return Promise.resolve(
        table === 'delivery_assignments'
          ? options.updatedAssignment
          : options.updatedDelivery,
      );
    }),
    execute: vi.fn().mockResolvedValue([]),
  };
  return builder;
}

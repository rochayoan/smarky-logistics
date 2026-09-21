import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service.js';
import { RidersService } from './riders.service.js';

const rider = {
  id: '11111111-1111-4111-8111-111111111111',
  tenant_id: '22222222-2222-4222-8222-222222222222',
  name: 'Ana Rider',
  phone: null,
  status: 'offline' as const,
  is_active: true,
  created_at: new Date('2026-09-20T00:00:00.000Z'),
  updated_at: new Date('2026-09-20T00:00:00.000Z'),
};

describe('RidersService', () => {
  it('creates an active rider in offline status', async () => {
    const values = vi.fn().mockReturnValue({
      returningAll: () => ({ executeTakeFirstOrThrow: vi.fn().mockResolvedValue(rider) }),
    });
    const database = {
      insertInto: vi.fn(() => ({ values })),
    } as unknown as DatabaseService;
    const service = new RidersService(database);

    const result = await service.create(rider.tenant_id, {
      tenantId: rider.tenant_id,
      name: rider.name,
      phone: null,
    });

    expect(values).toHaveBeenCalledWith({
      tenant_id: rider.tenant_id,
      name: rider.name,
      phone: null,
      status: 'offline',
      is_active: true,
    });
    expect(result.status).toBe('offline');
  });

  it('changes an offline rider to available', async () => {
    const updatedRider = { ...rider, status: 'available' as const };
    const database = transactionDatabase({ rider, updatedRider });
    const service = new RidersService(database);

    const result = await service.updateAvailability(rider.tenant_id, rider.id, 'available');

    expect(database.writes.rider).toMatchObject({ status: 'available' });
    expect(result.status).toBe('available');
  });

  it('does not allow an actively assigned rider to go offline', async () => {
    const database = transactionDatabase({
      rider: { ...rider, status: 'busy' as const },
      activeAssignment: { id: 'assignment-1' },
    });
    const service = new RidersService(database);

    await expect(service.updateAvailability(rider.tenant_id, rider.id, 'offline')).rejects.toMatchObject({
      response: { code: 'rider_has_active_assignment' },
      status: 409,
    } satisfies Partial<ConflictException>);
  });
});

function transactionDatabase(options: {
  rider: typeof rider;
  updatedRider?: typeof rider;
  activeAssignment?: { id: string };
}) {
  const writes: { rider?: Record<string, unknown> } = {};
  const selectFrom = vi.fn((table: string) => query(table === 'riders' ? options.rider : options.activeAssignment));
  const updateTable = vi.fn((table: string) => {
    const builder = {
      set: (values: Record<string, unknown>) => {
        if (table === 'riders') {
          writes.rider = values;
        }
        return builder;
      },
      where: () => builder,
      returningAll: () => builder,
      executeTakeFirstOrThrow: vi.fn().mockResolvedValue(options.updatedRider ?? options.rider),
    };
    return builder;
  });
  const trx = { selectFrom, updateTable };

  return {
    writes,
    transaction: vi.fn(() => ({ execute: (callback: (value: typeof trx) => Promise<unknown>) => callback(trx) })),
  } as unknown as DatabaseService & { writes: typeof writes };
}

function query(result: unknown) {
  const builder = {
    selectAll: () => builder,
    select: () => builder,
    where: () => builder,
    forUpdate: () => builder,
    executeTakeFirst: vi.fn().mockResolvedValue(result),
  };
  return builder;
}

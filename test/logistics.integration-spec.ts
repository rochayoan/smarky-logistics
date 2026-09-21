import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { AssignmentsService } from '../src/assignments/assignments.service.js';
import type { Database } from '../src/database/database.types.js';
import { DeliveriesService } from '../src/deliveries/deliveries.service.js';
import { RidersService } from '../src/riders/riders.service.js';

const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';
const integrationDescribe = runIntegrationTests ? describe : describe.skip;
const runId = randomUUID();
const testPrefix = `integration-logistics-${runId}`;

let database: Kysely<Database>;
let tenantId: string;
let restaurantId: string;
let branchId: string;
let riderOneId: string;
let riderThreeId: string;

integrationDescribe('Smarky Logistics PostgreSQL integration', () => {
  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;

    if (connectionString === undefined || connectionString.length === 0) {
      throw new Error('DATABASE_URL is required when RUN_INTEGRATION_TESTS=true');
    }

    database = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: withoutSslConnectionParameters(connectionString),
          ssl: process.env.DATABASE_SSL === 'false'
            ? false
            : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' },
        }),
      }),
    });

    const tenant = await database
      .insertInto('tenants')
      .values({ name: `${testPrefix}-tenant` })
      .returning('id')
      .executeTakeFirstOrThrow();
    tenantId = tenant.id;

    const restaurant = await database
      .insertInto('restaurants')
      .values({ tenant_id: tenantId, name: `${testPrefix}-restaurant` })
      .returning('id')
      .executeTakeFirstOrThrow();
    restaurantId = restaurant.id;

    const branch = await database
      .insertInto('branches')
      .values({
        tenant_id: tenantId,
        restaurant_id: restaurantId,
        name: `${testPrefix}-branch`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    branchId = branch.id;

    const ridersService = new RidersService(database as never);
    const [riderOne, , riderThree] = await Promise.all([
      ridersService.create(tenantId, { tenantId, name: `${testPrefix}-rider-1`, phone: null }),
      ridersService.create(tenantId, { tenantId, name: `${testPrefix}-rider-2`, phone: null }),
      ridersService.create(tenantId, { tenantId, name: `${testPrefix}-rider-3`, phone: null }),
    ]);
    riderOneId = riderOne.id;
    riderThreeId = riderThree.id;
  });

  afterAll(async () => {
    if (database === undefined) {
      return;
    }

    try {
      if (tenantId !== undefined) {
        await database.deleteFrom('delivery_events').where('tenant_id', '=', tenantId).execute();
        await database.deleteFrom('delivery_assignments').where('tenant_id', '=', tenantId).execute();
        await database.deleteFrom('deliveries').where('tenant_id', '=', tenantId).execute();
        await database.deleteFrom('riders').where('tenant_id', '=', tenantId).execute();
        await database.deleteFrom('branches').where('tenant_id', '=', tenantId).execute();
        await database.deleteFrom('restaurants').where('tenant_id', '=', tenantId).execute();
        await database.deleteFrom('tenants').where('id', '=', tenantId).execute();
      }
    } finally {
      await database.destroy();
    }
  });

  it('completes the delivery lifecycle and frees the rider for a new assignment', async () => {
    const ridersService = new RidersService(database as never);
    const deliveriesService = new DeliveriesService(database as never);
    const assignmentsService = new AssignmentsService(database as never);

    await ridersService.updateAvailability(tenantId, riderOneId, 'available');
    const deliveryOne = await createDelivery(deliveriesService, 'delivery-1');
    expect(deliveryOne).toMatchObject({ status: 'pending', deliveryVersion: 1 });

    const assigned = await assignmentsService.assign(tenantId, deliveryOne.id, riderOneId);
    expect(assigned).toMatchObject({ status: 'assigned', deliveryStatus: 'assigned', deliveryVersion: 2 });
    await expectRiderStatus(riderOneId, 'busy');

    const accepted = await assignmentsService.accept(tenantId, deliveryOne.id, riderOneId);
    expect(accepted).toMatchObject({ status: 'accepted', deliveryStatus: 'accepted', deliveryVersion: 3 });
    await expectRiderStatus(riderOneId, 'busy');

    const pickedUp = await assignmentsService.pickedUp(tenantId, deliveryOne.id, riderOneId);
    expect(pickedUp).toMatchObject({ status: 'accepted', deliveryStatus: 'picked_up', deliveryVersion: 4 });
    await expectRiderStatus(riderOneId, 'busy');

    const delivered = await assignmentsService.delivered(tenantId, deliveryOne.id, riderOneId);
    expect(delivered).toMatchObject({
      status: 'completed',
      deliveryStatus: 'delivered',
      deliveryVersion: 5,
    });
    expect(delivered.completedAt).toBeInstanceOf(Date);
    await expectRiderStatus(riderOneId, 'available');

    const assignmentOne = await database
      .selectFrom('delivery_assignments')
      .selectAll()
      .where('delivery_id', '=', deliveryOne.id)
      .executeTakeFirstOrThrow();
    expect(assignmentOne).toMatchObject({ status: 'completed' });
    expect(assignmentOne.completed_at).toBeInstanceOf(Date);

    const events = await database
      .selectFrom('delivery_events')
      .select('event_type')
      .where('delivery_id', '=', deliveryOne.id)
      .orderBy('created_at')
      .execute();
    expect(events.map((event) => event.event_type)).toEqual([
      'delivery_created',
      'rider_assigned',
      'rider_accepted',
      'delivery_picked_up',
      'delivery_delivered',
    ]);

    const deliveryTwo = await createDelivery(deliveriesService, 'delivery-2');
    const assignmentTwo = await assignmentsService.assign(tenantId, deliveryTwo.id, riderOneId);
    expect(assignmentTwo).toMatchObject({ status: 'assigned', deliveryStatus: 'assigned' });
    await expectRiderStatus(riderOneId, 'busy');

    const assignments = await database
      .selectFrom('delivery_assignments')
      .select(['delivery_id', 'status'])
      .where('rider_id', '=', riderOneId)
      .orderBy('created_at')
      .execute();
    expect(assignments).toEqual([
      { delivery_id: deliveryOne.id, status: 'completed' },
      { delivery_id: deliveryTwo.id, status: 'assigned' },
    ]);
  });

  it('enforces the active-assignment rider index under concurrent inserts', async () => {
    const deliveriesService = new DeliveriesService(database as never);
    const [deliveryThree, deliveryFour] = await Promise.all([
      createDelivery(deliveriesService, 'delivery-3'),
      createDelivery(deliveriesService, 'delivery-4'),
    ]);

    const attempts = await Promise.allSettled([
      database
        .insertInto('delivery_assignments')
        .values({
          tenant_id: tenantId,
          delivery_id: deliveryThree.id,
          rider_id: riderThreeId,
          status: 'assigned',
        })
        .returning('id')
        .executeTakeFirstOrThrow(),
      database
        .insertInto('delivery_assignments')
        .values({
          tenant_id: tenantId,
          delivery_id: deliveryFour.id,
          rider_id: riderThreeId,
          status: 'assigned',
        })
        .returning('id')
        .executeTakeFirstOrThrow(),
    ]);

    const fulfilled = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: '23505' });
  });

  it('returns the original delivery ID for a duplicate external order', async () => {
    const deliveriesService = new DeliveriesService(database as never);
    const original = await createDelivery(deliveriesService, 'duplicate-external-order');

    await expect(
      createDelivery(deliveriesService, 'duplicate-external-order'),
    ).rejects.toMatchObject({
      response: {
        code: 'delivery_already_exists',
        deliveryId: original.id,
      },
      status: 409,
    } satisfies Partial<ConflictException>);
  });
});

async function createDelivery(deliveriesService: DeliveriesService, suffix: string) {
  return deliveriesService.create(tenantId, {
    tenantId,
    restaurantId,
    branchId,
    externalOrderId: `${testPrefix}-${suffix}`,
    sourceSystem: 'integration-test',
    pickupAddress: null,
    pickupLatitude: null,
    pickupLongitude: null,
    dropoffAddress: `${testPrefix}-${suffix}-dropoff`,
    dropoffLatitude: null,
    dropoffLongitude: null,
    customerName: null,
    customerPhone: null,
    customerNotes: null,
    deliveryFee: null,
  });
}

async function expectRiderStatus(riderId: string, status: 'available' | 'busy') {
  const rider = await database
    .selectFrom('riders')
    .select('status')
    .where('id', '=', riderId)
    .executeTakeFirstOrThrow();

  expect(rider.status).toBe(status);
}

function withoutSslConnectionParameters(connectionString: string): string {
  const url = new URL(connectionString);

  for (const parameter of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslcrl']) {
    url.searchParams.delete(parameter);
  }

  return url.toString();
}

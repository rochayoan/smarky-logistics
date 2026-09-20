import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Selectable, Transaction } from 'kysely';
import { DatabaseService } from '../database/database.service.js';
import type { Database } from '../database/database.types.js';
import type { AssignRiderDto } from './dto/assign-rider.dto.js';
import type { AssignmentResponseDto } from './dto/assignment-response.dto.js';

type DeliveryRow = Selectable<Database['deliveries']>;
type RiderRow = Selectable<Database['riders']>;
type AssignmentRow = Selectable<Database['delivery_assignments']>;

@Injectable()
export class AssignmentsService {
  constructor(private readonly database: DatabaseService) {}

  async assign(
    deliveryId: string,
    assignRiderDto: AssignRiderDto,
  ): Promise<AssignmentResponseDto> {
    try {
      return await this.database.transaction().execute(async (trx) => {
        const delivery = await lockDelivery(trx, deliveryId);

        if (delivery === undefined) {
          throw new NotFoundException(`Delivery ${deliveryId} was not found`);
        }

        if (delivery.status !== 'pending') {
          throw conflict('delivery_not_assignable', 'Delivery must be pending to assign a rider');
        }

        const rider = await lockRider(trx, assignRiderDto.riderId);

        if (rider === undefined) {
          throw new NotFoundException(`Rider ${assignRiderDto.riderId} was not found`);
        }

        if (rider.tenant_id !== delivery.tenant_id) {
          throw conflict('rider_tenant_mismatch', 'Rider does not belong to the delivery tenant');
        }

        if (!rider.is_active) {
          throw conflict('rider_inactive', 'Rider is inactive');
        }

        if (rider.status !== 'available') {
          throw conflict('rider_unavailable', 'Rider is not available');
        }

        const assignment = await trx
          .insertInto('delivery_assignments')
          .values({
            tenant_id: delivery.tenant_id,
            delivery_id: delivery.id,
            rider_id: rider.id,
            status: 'assigned',
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const now = new Date();
        const updatedDelivery = await trx
          .updateTable('deliveries')
          .set({
            status: 'assigned',
            delivery_version: delivery.delivery_version + 1,
            updated_at: now,
          })
          .where('id', '=', delivery.id)
          .returning(['status', 'delivery_version'])
          .executeTakeFirstOrThrow();

        await trx
          .updateTable('riders')
          .set({ status: 'busy', updated_at: now })
          .where('id', '=', rider.id)
          .execute();

        await trx
          .insertInto('delivery_events')
          .values({
            tenant_id: delivery.tenant_id,
            delivery_id: delivery.id,
            rider_id: rider.id,
            event_type: 'rider_assigned',
            metadata: { assignmentId: assignment.id },
          })
          .execute();

        return toAssignmentResponse(assignment, updatedDelivery);
      });
    } catch (error) {
      if (isActiveAssignmentConflict(error)) {
        throw conflict('assignment_conflict', 'Delivery or rider already has an active assignment');
      }

      throw error;
    }
  }

  async accept(
    deliveryId: string,
    riderId: string,
  ): Promise<AssignmentResponseDto> {
    return this.database.transaction().execute(async (trx) => {
      const delivery = await lockDelivery(trx, deliveryId);

      if (delivery === undefined) {
        throw new NotFoundException(`Delivery ${deliveryId} was not found`);
      }

      if (delivery.status !== 'assigned') {
        throw conflict('delivery_not_awaiting_acceptance', 'Delivery must be assigned to accept it');
      }

      // riderId is request input only until Smarky Rider authentication supplies it.
      const assignment = await trx
        .selectFrom('delivery_assignments')
        .selectAll()
        .where('delivery_id', '=', delivery.id)
        .where('rider_id', '=', riderId)
        .where('status', '=', 'assigned')
        .forUpdate()
        .executeTakeFirst();

      if (assignment === undefined) {
        throw conflict('assignment_not_assignable', 'Rider does not have an assigned delivery');
      }

      const now = new Date();
      const updatedAssignment = await trx
        .updateTable('delivery_assignments')
        .set({ status: 'accepted', accepted_at: now })
        .where('id', '=', assignment.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      const updatedDelivery = await trx
        .updateTable('deliveries')
        .set({
          status: 'accepted',
          delivery_version: delivery.delivery_version + 1,
          updated_at: now,
        })
        .where('id', '=', delivery.id)
        .returning(['status', 'delivery_version'])
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('delivery_events')
        .values({
          tenant_id: delivery.tenant_id,
          delivery_id: delivery.id,
          rider_id: riderId,
          event_type: 'rider_accepted',
          metadata: { assignmentId: assignment.id },
        })
        .execute();

      return toAssignmentResponse(updatedAssignment, updatedDelivery);
    });
  }

  async pickedUp(
    deliveryId: string,
    riderId: string,
  ): Promise<AssignmentResponseDto> {
    return this.database.transaction().execute(async (trx) => {
      const delivery = await lockDelivery(trx, deliveryId);

      if (delivery === undefined) {
        throw new NotFoundException(`Delivery ${deliveryId} was not found`);
      }

      if (delivery.status !== 'accepted') {
        throw conflict('delivery_not_ready_for_pickup', 'Delivery must be accepted to pick it up');
      }

      const assignment = await lockAcceptedAssignment(trx, delivery.id, riderId);

      if (assignment === undefined) {
        throw conflict('assignment_not_accepted', 'Rider does not have an accepted assignment');
      }

      const rider = await lockRider(trx, riderId);

      if (rider === undefined || rider.status !== 'busy') {
        throw conflict('rider_not_busy', 'Rider must be busy to pick up a delivery');
      }

      const now = new Date();
      const updatedDelivery = await trx
        .updateTable('deliveries')
        .set({
          status: 'picked_up',
          delivery_version: delivery.delivery_version + 1,
          updated_at: now,
        })
        .where('id', '=', delivery.id)
        .returning(['status', 'delivery_version'])
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('delivery_events')
        .values({
          tenant_id: delivery.tenant_id,
          delivery_id: delivery.id,
          rider_id: rider.id,
          event_type: 'delivery_picked_up',
          metadata: { assignmentId: assignment.id },
        })
        .execute();

      return toAssignmentResponse(assignment, updatedDelivery);
    });
  }

  async delivered(
    deliveryId: string,
    riderId: string,
  ): Promise<AssignmentResponseDto> {
    return this.database.transaction().execute(async (trx) => {
      const delivery = await lockDelivery(trx, deliveryId);

      if (delivery === undefined) {
        throw new NotFoundException(`Delivery ${deliveryId} was not found`);
      }

      if (delivery.status !== 'picked_up') {
        throw conflict('delivery_not_ready_for_delivery', 'Delivery must be picked up to deliver it');
      }

      const assignment = await lockAcceptedAssignment(trx, delivery.id, riderId);

      if (assignment === undefined) {
        throw conflict('assignment_not_accepted', 'Rider does not have an accepted assignment');
      }

      const rider = await lockRider(trx, riderId);

      if (rider === undefined || rider.status !== 'busy') {
        throw conflict('rider_not_busy', 'Rider must be busy to complete a delivery');
      }

      const now = new Date();
      const updatedDelivery = await trx
        .updateTable('deliveries')
        .set({
          status: 'delivered',
          delivery_version: delivery.delivery_version + 1,
          updated_at: now,
        })
        .where('id', '=', delivery.id)
        .returning(['status', 'delivery_version'])
        .executeTakeFirstOrThrow();

      const updatedAssignment = await trx
        .updateTable('delivery_assignments')
        .set({ status: 'completed', completed_at: now })
        .where('id', '=', assignment.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .updateTable('riders')
        .set({ status: 'available', updated_at: now })
        .where('id', '=', rider.id)
        .execute();

      await trx
        .insertInto('delivery_events')
        .values({
          tenant_id: delivery.tenant_id,
          delivery_id: delivery.id,
          rider_id: rider.id,
          event_type: 'delivery_delivered',
          metadata: { assignmentId: assignment.id },
        })
        .execute();

      return toAssignmentResponse(updatedAssignment, updatedDelivery);
    });
  }
}

function lockDelivery(
  trx: Transaction<Database>,
  deliveryId: string,
): Promise<DeliveryRow | undefined> {
  return trx
    .selectFrom('deliveries')
    .selectAll()
    .where('id', '=', deliveryId)
    .forUpdate()
    .executeTakeFirst();
}

function lockRider(
  trx: Transaction<Database>,
  riderId: string,
): Promise<RiderRow | undefined> {
  return trx
    .selectFrom('riders')
    .selectAll()
    .where('id', '=', riderId)
    .forUpdate()
    .executeTakeFirst();
}

function lockAcceptedAssignment(
  trx: Transaction<Database>,
  deliveryId: string,
  riderId: string,
): Promise<AssignmentRow | undefined> {
  return trx
    .selectFrom('delivery_assignments')
    .selectAll()
    .where('delivery_id', '=', deliveryId)
    .where('rider_id', '=', riderId)
    .where('status', '=', 'accepted')
    .forUpdate()
    .executeTakeFirst();
}

function toAssignmentResponse(
  assignment: AssignmentRow,
  delivery: Pick<DeliveryRow, 'status' | 'delivery_version'>,
): AssignmentResponseDto {
  return {
    id: assignment.id,
    tenantId: assignment.tenant_id,
    deliveryId: assignment.delivery_id,
    riderId: assignment.rider_id,
    status: assignment.status,
    assignedAt: assignment.assigned_at,
    acceptedAt: assignment.accepted_at,
    completedAt: assignment.completed_at,
    createdAt: assignment.created_at,
    deliveryStatus: delivery.status,
    deliveryVersion: delivery.delivery_version,
  };
}

function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function isActiveAssignmentConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === '23505'
  );
}

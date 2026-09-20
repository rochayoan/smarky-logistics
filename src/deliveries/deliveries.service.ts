import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Selectable } from 'kysely';
import { DatabaseService } from '../database/database.service.js';
import type { Database } from '../database/database.types.js';
import type { CreateDeliveryDto } from './dto/create-delivery.dto.js';
import type { DeliveryResponseDto } from './dto/delivery-response.dto.js';

type DeliveryRow = Selectable<Database['deliveries']>;

@Injectable()
export class DeliveriesService {
  constructor(private readonly database: DatabaseService) {}

  async create(createDeliveryDto: CreateDeliveryDto): Promise<DeliveryResponseDto> {
    try {
      return await this.database.transaction().execute(async (trx) => {
        const delivery = await trx
          .insertInto('deliveries')
          .values({
            tenant_id: createDeliveryDto.tenantId,
            restaurant_id: createDeliveryDto.restaurantId,
            branch_id: createDeliveryDto.branchId,
            external_order_id: createDeliveryDto.externalOrderId,
            source_system: createDeliveryDto.sourceSystem,
            delivery_version: 1,
            status: 'pending',
            pickup_address: createDeliveryDto.pickupAddress,
            pickup_latitude: createDeliveryDto.pickupLatitude,
            pickup_longitude: createDeliveryDto.pickupLongitude,
            dropoff_address: createDeliveryDto.dropoffAddress,
            dropoff_latitude: createDeliveryDto.dropoffLatitude,
            dropoff_longitude: createDeliveryDto.dropoffLongitude,
            customer_name: createDeliveryDto.customerName,
            customer_phone: createDeliveryDto.customerPhone,
            customer_notes: createDeliveryDto.customerNotes,
            delivery_fee: createDeliveryDto.deliveryFee,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const metadata: Record<string, unknown> = {
          source: 'api',
          sourceSystem: delivery.source_system,
        };

        if (delivery.external_order_id !== null) {
          metadata.externalOrderId = delivery.external_order_id;
        }

        await trx
          .insertInto('delivery_events')
          .values({
            tenant_id: delivery.tenant_id,
            delivery_id: delivery.id,
            event_type: 'delivery_created',
            metadata,
          })
          .execute();

        return toDeliveryResponse(delivery);
      });
    } catch (error) {
      if (isExternalOrderConflict(error)) {
        throw new ConflictException({
          code: 'delivery_already_exists',
          message: 'A delivery already exists for this external order',
        });
      }

      throw error;
    }
  }

  async findOne(id: string): Promise<DeliveryResponseDto> {
    const delivery = await this.database
      .selectFrom('deliveries')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (delivery === undefined) {
      throw new NotFoundException(`Delivery ${id} was not found`);
    }

    return toDeliveryResponse(delivery);
  }
}

function toDeliveryResponse(delivery: DeliveryRow): DeliveryResponseDto {
  return {
    id: delivery.id,
    tenantId: delivery.tenant_id,
    restaurantId: delivery.restaurant_id,
    branchId: delivery.branch_id,
    externalOrderId: delivery.external_order_id,
    sourceSystem: delivery.source_system,
    deliveryVersion: delivery.delivery_version,
    status: delivery.status,
    pickupAddress: delivery.pickup_address,
    pickupLatitude: delivery.pickup_latitude,
    pickupLongitude: delivery.pickup_longitude,
    dropoffAddress: delivery.dropoff_address,
    dropoffLatitude: delivery.dropoff_latitude,
    dropoffLongitude: delivery.dropoff_longitude,
    customerName: delivery.customer_name,
    customerPhone: delivery.customer_phone,
    customerNotes: delivery.customer_notes,
    deliveryFee: delivery.delivery_fee,
    createdAt: delivery.created_at,
    updatedAt: delivery.updated_at,
  };
}

function isExternalOrderConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const databaseError = error as {
    code?: unknown;
    constraint?: unknown;
    detail?: unknown;
  };

  return (
    databaseError.code === '23505' &&
    (databaseError.constraint ===
      'deliveries_tenant_id_source_system_external_order_id_key' ||
      (typeof databaseError.detail === 'string' &&
        databaseError.detail.includes(
          '(tenant_id, source_system, external_order_id)',
        )))
  );
}

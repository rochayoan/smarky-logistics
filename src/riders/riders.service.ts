import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Selectable } from 'kysely';
import { DatabaseService } from '../database/database.service.js';
import type { Database, RiderStatus } from '../database/database.types.js';
import type { CreateRiderDto } from './dto/create-rider.dto.js';
import type { RiderResponseDto } from './dto/rider-response.dto.js';
import type { RiderAvailabilityStatus } from './dto/update-rider-availability.dto.js';

type RiderRow = Selectable<Database['riders']>;

const ACTIVE_ASSIGNMENT_STATUSES = ['assigned', 'accepted'] as const;

@Injectable()
export class RidersService {
  constructor(private readonly database: DatabaseService) {}

  async create(tenantId: string, createRiderDto: CreateRiderDto): Promise<RiderResponseDto> {
    const rider = await this.database
      .insertInto('riders')
      .values({
        tenant_id: tenantId,
        name: createRiderDto.name,
        phone: createRiderDto.phone,
        status: 'offline',
        is_active: true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toRiderResponse(rider);
  }

  async list(tenantId: string, status?: RiderStatus): Promise<RiderResponseDto[]> {
    let query = this.database
      .selectFrom('riders')
      .selectAll()
      .where('tenant_id', '=', tenantId);

    if (status !== undefined) {
      query = query.where('status', '=', status);
    }

    const riders = await query.orderBy('created_at', 'desc').execute();

    return riders.map(toRiderResponse);
  }

  async updateAvailability(
    tenantId: string, riderId: string, status: RiderAvailabilityStatus,
  ): Promise<RiderResponseDto> {
    return this.database.transaction().execute(async (trx) => {
      let riderQuery = trx
        .selectFrom('riders')
        .selectAll()
        .where('id', '=', riderId);
      riderQuery = riderQuery.where('tenant_id', '=', tenantId);
      const rider = await riderQuery.forUpdate().executeTakeFirst();

      if (rider === undefined) {
        throw new NotFoundException(`Rider ${riderId} was not found`);
      }

      if (status === 'offline') {
        const activeAssignment = await trx
          .selectFrom('delivery_assignments')
          .select('id')
          .where('rider_id', '=', riderId)
          .where('tenant_id', '=', tenantId)
          .where('status', 'in', ACTIVE_ASSIGNMENT_STATUSES)
          .forUpdate()
          .executeTakeFirst();

        if (activeAssignment !== undefined) {
          throw new ConflictException({
            code: 'rider_has_active_assignment',
            message: 'A rider with an active assignment cannot go offline',
          });
        }
      }

      const updatedRider = await trx
        .updateTable('riders')
        .set({ status, updated_at: new Date() })
        .where('id', '=', riderId)
        .where('tenant_id', '=', tenantId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return toRiderResponse(updatedRider);
    });
  }
}

function toRiderResponse(rider: RiderRow): RiderResponseDto {
  return {
    id: rider.id,
    tenantId: rider.tenant_id,
    name: rider.name,
    phone: rider.phone,
    status: rider.status,
    isActive: rider.is_active,
    createdAt: rider.created_at,
    updatedAt: rider.updated_at,
  };
}

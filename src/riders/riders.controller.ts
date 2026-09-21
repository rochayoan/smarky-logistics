import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { parseCreateRiderDto, parseTenantId } from './dto/create-rider.dto.js';
import type { RiderResponseDto } from './dto/rider-response.dto.js';
import {
  parseUpdateRiderAvailabilityDto,
  type RiderAvailabilityStatus,
} from './dto/update-rider-availability.dto.js';
import { RidersService } from './riders.service.js';
import { CurrentTenant } from '../auth/auth.decorators.js';
import type { TenantContext } from '../auth/auth.types.js';
import { assertTenantContext } from '../auth/tenant-context.js';

@Controller('v1/riders')
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Post()
  create(@Body() body: unknown, @CurrentTenant() context: TenantContext): Promise<RiderResponseDto> {
    const dto = parseCreateRiderDto(body); assertTenantContext(context, dto.tenantId); return this.ridersService.create(context.tenantId, dto);
  }

  @Get()
  list(
    @Query('tenantId') tenantIdValue: unknown,
    @Query('status') status: RiderAvailabilityStatus | 'busy' | undefined, @CurrentTenant() context: TenantContext,
  ): Promise<RiderResponseDto[]> {
    if (status !== undefined && status !== 'offline' && status !== 'available' && status !== 'busy') {
      throw new BadRequestException('status must be offline, available, or busy');
    }

    const tenantId = tenantIdValue === undefined ? context.tenantId : parseTenantId(tenantIdValue); assertTenantContext(context, tenantId); return this.ridersService.list(context.tenantId, status);
  }

  @Patch(':id/availability')
  updateAvailability(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown, @CurrentTenant() context: TenantContext,
  ): Promise<RiderResponseDto> {
    return this.ridersService.updateAvailability(
      context.tenantId, id, parseUpdateRiderAvailabilityDto(body).status,
    );
  }
}

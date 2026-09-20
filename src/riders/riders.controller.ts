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

@Controller('v1/riders')
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Post()
  create(@Body() body: unknown): Promise<RiderResponseDto> {
    return this.ridersService.create(parseCreateRiderDto(body));
  }

  @Get()
  list(
    @Query('tenantId') tenantIdValue: unknown,
    @Query('status') status?: RiderAvailabilityStatus | 'busy',
  ): Promise<RiderResponseDto[]> {
    if (status !== undefined && status !== 'offline' && status !== 'available' && status !== 'busy') {
      throw new BadRequestException('status must be offline, available, or busy');
    }

    return this.ridersService.list(parseTenantId(tenantIdValue), status);
  }

  @Patch(':id/availability')
  updateAvailability(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<RiderResponseDto> {
    return this.ridersService.updateAvailability(
      id,
      parseUpdateRiderAvailabilityDto(body).status,
    );
  }
}

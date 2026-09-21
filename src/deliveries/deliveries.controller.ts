import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  parseCreateDeliveryDto,
  type CreateDeliveryDto,
} from './dto/create-delivery.dto.js';
import type { DeliveryResponseDto } from './dto/delivery-response.dto.js';
import { DeliveriesService } from './deliveries.service.js';
import { CurrentTenant } from '../auth/auth.decorators.js';
import type { TenantContext } from '../auth/auth.types.js';
import { assertTenantContext } from '../auth/tenant-context.js';

@Controller('v1/deliveries')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Post()
  create(@Body() body: unknown, @CurrentTenant() context: TenantContext): Promise<DeliveryResponseDto> {
    const createDeliveryDto: CreateDeliveryDto = parseCreateDeliveryDto(body);

    assertTenantContext(context, createDeliveryDto.tenantId); return this.deliveriesService.create(context.tenantId, createDeliveryDto);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentTenant() context: TenantContext): Promise<DeliveryResponseDto> {
    return this.deliveriesService.findOne(context.tenantId, id);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  parseCreateDeliveryDto,
  type CreateDeliveryDto,
} from './dto/create-delivery.dto.js';
import type { DeliveryResponseDto } from './dto/delivery-response.dto.js';
import { DeliveriesService } from './deliveries.service.js';

@Controller('v1/deliveries')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Post()
  create(@Body() body: unknown): Promise<DeliveryResponseDto> {
    const createDeliveryDto: CreateDeliveryDto = parseCreateDeliveryDto(body);

    return this.deliveriesService.create(createDeliveryDto);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<DeliveryResponseDto> {
    return this.deliveriesService.findOne(id);
  }
}

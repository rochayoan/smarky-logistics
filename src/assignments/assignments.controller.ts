import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { parseAssignRiderDto } from './dto/assign-rider.dto.js';
import type { AssignmentResponseDto } from './dto/assignment-response.dto.js';
import { AssignmentsService } from './assignments.service.js';
import { CurrentTenant } from '../auth/auth.decorators.js';
import type { TenantContext } from '../auth/auth.types.js';

@Controller('v1/deliveries')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post(':deliveryId/assign')
  assign(
    @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
    @Body() body: unknown, @CurrentTenant() context: TenantContext,
  ): Promise<AssignmentResponseDto> {
    return this.assignmentsService.assign(context.tenantId, deliveryId, parseAssignRiderDto(body).riderId);
  }

  @Post(':deliveryId/accept')
  accept(
    @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
    @Body() body: unknown, @CurrentTenant() context: TenantContext,
  ): Promise<AssignmentResponseDto> {
    return this.assignmentsService.accept(context.tenantId, deliveryId, parseAssignRiderDto(body).riderId);
  }

  @Post(':deliveryId/picked-up')
  pickedUp(
    @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
    @Body() body: unknown, @CurrentTenant() context: TenantContext,
  ): Promise<AssignmentResponseDto> {
    return this.assignmentsService.pickedUp(
      context.tenantId, deliveryId, parseAssignRiderDto(body).riderId,
    );
  }

  @Post(':deliveryId/delivered')
  delivered(
    @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
    @Body() body: unknown, @CurrentTenant() context: TenantContext,
  ): Promise<AssignmentResponseDto> {
    return this.assignmentsService.delivered(
      context.tenantId, deliveryId, parseAssignRiderDto(body).riderId,
    );
  }
}

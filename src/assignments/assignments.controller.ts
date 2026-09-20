import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { parseAssignRiderDto } from './dto/assign-rider.dto.js';
import type { AssignmentResponseDto } from './dto/assignment-response.dto.js';
import { AssignmentsService } from './assignments.service.js';

@Controller('v1/deliveries')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post(':deliveryId/assign')
  assign(
    @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
    @Body() body: unknown,
  ): Promise<AssignmentResponseDto> {
    return this.assignmentsService.assign(deliveryId, parseAssignRiderDto(body));
  }

  @Post(':deliveryId/accept')
  accept(
    @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
    @Body() body: unknown,
  ): Promise<AssignmentResponseDto> {
    return this.assignmentsService.accept(deliveryId, parseAssignRiderDto(body).riderId);
  }

  @Post(':deliveryId/picked-up')
  pickedUp(
    @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
    @Body() body: unknown,
  ): Promise<AssignmentResponseDto> {
    return this.assignmentsService.pickedUp(
      deliveryId,
      parseAssignRiderDto(body).riderId,
    );
  }

  @Post(':deliveryId/delivered')
  delivered(
    @Param('deliveryId', new ParseUUIDPipe()) deliveryId: string,
    @Body() body: unknown,
  ): Promise<AssignmentResponseDto> {
    return this.assignmentsService.delivered(
      deliveryId,
      parseAssignRiderDto(body).riderId,
    );
  }
}

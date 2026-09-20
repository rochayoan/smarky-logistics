import type { DeliveryAssignmentStatus, DeliveryStatus } from '../../database/database.types.js';

export interface AssignmentResponseDto {
  id: string;
  tenantId: string;
  deliveryId: string;
  riderId: string;
  status: DeliveryAssignmentStatus;
  assignedAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  deliveryStatus: DeliveryStatus;
  deliveryVersion: number;
}

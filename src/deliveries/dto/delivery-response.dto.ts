import type { DeliveryStatus } from '../../database/database.types.js';

export interface DeliveryResponseDto {
  id: string;
  tenantId: string;
  restaurantId: string;
  branchId: string;
  externalOrderId: string | null;
  sourceSystem: string;
  deliveryVersion: number;
  status: DeliveryStatus;
  pickupAddress: string | null;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  dropoffAddress: string;
  dropoffLatitude: number | null;
  dropoffLongitude: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerNotes: string | null;
  deliveryFee: string | null;
  createdAt: Date;
  updatedAt: Date;
}

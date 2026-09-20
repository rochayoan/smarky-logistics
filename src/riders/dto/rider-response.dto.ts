import type { RiderStatus } from '../../database/database.types.js';

export interface RiderResponseDto {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  status: RiderStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

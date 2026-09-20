import { BadRequestException } from '@nestjs/common';

export interface CreateDeliveryDto {
  tenantId: string;
  restaurantId: string;
  branchId: string;
  externalOrderId: string | null;
  sourceSystem: string;
  pickupAddress: string | null;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  dropoffAddress: string;
  dropoffLatitude: number | null;
  dropoffLongitude: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerNotes: string | null;
  deliveryFee: number | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCreateDeliveryDto(value: unknown): CreateDeliveryDto {
  if (!isRecord(value)) {
    throw new BadRequestException('Request body must be an object');
  }

  if ('deliveryVersion' in value) {
    throw new BadRequestException('deliveryVersion is managed by the server');
  }

  return {
    tenantId: requiredUuid(value, 'tenantId'),
    restaurantId: requiredUuid(value, 'restaurantId'),
    branchId: requiredUuid(value, 'branchId'),
    externalOrderId: optionalString(value, 'externalOrderId'),
    sourceSystem: optionalSourceSystem(value),
    pickupAddress: optionalString(value, 'pickupAddress'),
    pickupLatitude: optionalNumber(value, 'pickupLatitude'),
    pickupLongitude: optionalNumber(value, 'pickupLongitude'),
    dropoffAddress: requiredString(value, 'dropoffAddress'),
    dropoffLatitude: optionalNumber(value, 'dropoffLatitude'),
    dropoffLongitude: optionalNumber(value, 'dropoffLongitude'),
    customerName: optionalString(value, 'customerName'),
    customerPhone: optionalString(value, 'customerPhone'),
    customerNotes: optionalString(value, 'customerNotes'),
    deliveryFee: optionalDeliveryFee(value),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredUuid(value: Record<string, unknown>, field: string): string {
  const uuid = value[field];

  if (typeof uuid !== 'string' || !UUID_PATTERN.test(uuid)) {
    throw new BadRequestException(`${field} must be a UUID`);
  }

  return uuid;
}

function requiredString(value: Record<string, unknown>, field: string): string {
  const string = value[field];

  if (typeof string !== 'string' || string.trim().length === 0) {
    throw new BadRequestException(`${field} must be a non-empty string`);
  }

  return string;
}

function optionalString(value: Record<string, unknown>, field: string): string | null {
  const string = value[field];

  if (string === undefined || string === null) {
    return null;
  }

  if (typeof string !== 'string') {
    throw new BadRequestException(`${field} must be a string`);
  }

  return string;
}

function optionalNumber(value: Record<string, unknown>, field: string): number | null {
  const number = value[field];

  if (number === undefined || number === null) {
    return null;
  }

  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new BadRequestException(`${field} must be a finite number`);
  }

  return number;
}

function optionalDeliveryFee(value: Record<string, unknown>): number | null {
  const deliveryFee = optionalNumber(value, 'deliveryFee');

  if (deliveryFee !== null && deliveryFee < 0) {
    throw new BadRequestException('deliveryFee must be greater than or equal to zero');
  }

  return deliveryFee;
}

function optionalSourceSystem(value: Record<string, unknown>): string {
  const sourceSystem = value.sourceSystem;

  if (sourceSystem === undefined || sourceSystem === null) {
    return 'smarky-orders';
  }

  if (typeof sourceSystem !== 'string' || sourceSystem.trim().length === 0) {
    throw new BadRequestException('sourceSystem must be a non-empty string');
  }

  return sourceSystem;
}

import type { ColumnType, Generated } from 'kysely';

export type RiderStatus = 'offline' | 'available' | 'busy';

export type DeliveryStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'picked_up'
  | 'delivered'
  | 'cancelled';

export type DeliveryAssignmentStatus =
  | 'assigned'
  | 'accepted'
  | 'rejected'
  | 'cancelled';

type Numeric = ColumnType<string, string | number, string | number>;

interface TenantsTable {
  id: Generated<string>;
  name: string;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface RestaurantsTable {
  id: Generated<string>;
  tenant_id: string;
  name: string;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface BranchesTable {
  id: Generated<string>;
  tenant_id: string;
  restaurant_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface RidersTable {
  id: Generated<string>;
  tenant_id: string;
  name: string;
  phone: string | null;
  status: Generated<RiderStatus>;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface DeliveriesTable {
  id: Generated<string>;
  tenant_id: string;
  restaurant_id: string;
  branch_id: string | null;
  external_order_id: string | null;
  status: Generated<DeliveryStatus>;
  pickup_address: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  dropoff_address: string;
  dropoff_latitude: number | null;
  dropoff_longitude: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_notes: string | null;
  delivery_fee: Numeric | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

interface DeliveryAssignmentsTable {
  id: Generated<string>;
  tenant_id: string;
  delivery_id: string;
  rider_id: string;
  status: Generated<DeliveryAssignmentStatus>;
  assigned_at: Generated<Date>;
  accepted_at: Date | null;
  rejected_at: Date | null;
  cancelled_at: Date | null;
  created_at: Generated<Date>;
}

interface DeliveryEventsTable {
  id: Generated<string>;
  tenant_id: string;
  delivery_id: string;
  event_type: string;
  rider_id: string | null;
  metadata: Generated<Record<string, unknown>>;
  created_at: Generated<Date>;
}

export interface Database {
  tenants: TenantsTable;
  restaurants: RestaurantsTable;
  branches: BranchesTable;
  riders: RidersTable;
  deliveries: DeliveriesTable;
  delivery_assignments: DeliveryAssignmentsTable;
  delivery_events: DeliveryEventsTable;
}

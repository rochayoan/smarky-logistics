create table api_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_type text not null
    check (client_type in ('internal_service', 'tenant_client')),

  tenant_id uuid
    references tenants(id)
    on delete restrict,

  token_hash text not null unique
    check (char_length(token_hash) = 64),

  token_prefix text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (client_type = 'internal_service' and tenant_id is null)
    or
    (client_type = 'tenant_client' and tenant_id is not null)
  )
);

create index api_clients_active_token_hash_idx
  on api_clients (token_hash)
  where is_active;
